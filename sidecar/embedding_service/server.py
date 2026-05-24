"""
Embedding Service — Shadow E-Spider sidecar (Bushel 60 Phase C, BP030)
======================================================================

Local-CPU embedding service for Shadow E-Spider bridge-line queries.

Endpoints:
    POST /embed       — Compute embeddings for a list of strings
    POST /similar     — k-NN cosine similarity over the persistent FAISS index
    POST /index       — Add (or replace) Eblets in the persistent index
    GET  /health      — Liveness probe
    GET  /stats       — Index size, model name, embedding dim

Stack:
    sentence-transformers all-MiniLM-L6-v2 (~80MB, 384-dim, normalized)
    FAISS IndexFlatIP (inner-product == cosine on normalized vectors)
    Persistent index at  ~/.lb_substrate/embeddings/

Architecture reference:
    BISHOP_DROPZONE/14_CanonicalReferences/LOCAL_CPU_COMPUTE_ARCHITECTURE_SPRITES_SPIDERS_BP030.md  §4

Authored BP030 by Bishop SEG (Sonnet 4.6) under Bishop Opus 4.7.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import List, Optional

import faiss
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

HOME = Path(os.path.expanduser("~"))
SUBSTRATE_ROOT = HOME / ".lb_substrate"
EMBED_DIR = SUBSTRATE_ROOT / "embeddings"
EMBED_DIR.mkdir(parents=True, exist_ok=True)

INDEX_PATH = EMBED_DIR / "eblet_index.faiss"
META_PATH = EMBED_DIR / "eblet_index.meta.json"

MODEL_NAME = "all-MiniLM-L6-v2"
EMBED_DIM = 384

# ---------------------------------------------------------------------------
# Model + index (lazy load, single-process)
# ---------------------------------------------------------------------------

_model: Optional[SentenceTransformer] = None
_index: Optional[faiss.Index] = None
_meta: List[dict] = []  # parallel to FAISS row IDs
_lock = threading.Lock()


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def get_index() -> faiss.Index:
    """Return the live FAISS index, loading from disk if present."""
    global _index, _meta
    if _index is None:
        if INDEX_PATH.exists() and META_PATH.exists():
            _index = faiss.read_index(str(INDEX_PATH))
            with META_PATH.open("r", encoding="utf-8") as f:
                _meta = json.load(f)
        else:
            _index = faiss.IndexFlatIP(EMBED_DIM)
            _meta = []
    return _index


def persist_index() -> None:
    if _index is None:
        return
    faiss.write_index(_index, str(INDEX_PATH))
    with META_PATH.open("w", encoding="utf-8") as f:
        json.dump(_meta, f, ensure_ascii=False, indent=2)


def encode_normalized(texts: List[str]) -> np.ndarray:
    model = get_model()
    vecs = model.encode(
        texts,
        batch_size=32,
        convert_to_numpy=True,
        normalize_embeddings=True,  # cosine via IP
        show_progress_bar=False,
    ).astype("float32")
    return vecs


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

app = FastAPI(title="LB Spider Embedding Service", version="1.0.0")


class EmbedRequest(BaseModel):
    texts: List[str]


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    dim: int
    count: int


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    if not req.texts:
        raise HTTPException(400, "texts must be non-empty")
    with _lock:
        vecs = encode_normalized(req.texts)
    return EmbedResponse(
        embeddings=vecs.tolist(), dim=int(vecs.shape[1]), count=int(vecs.shape[0])
    )


class IndexItem(BaseModel):
    id: str            # canonical Eblet identifier (path or stem)
    path: str          # absolute filesystem path
    text: str          # content used for embedding


class IndexRequest(BaseModel):
    items: List[IndexItem]
    replace_all: bool = False  # rebuild from scratch


class IndexResponse(BaseModel):
    added: int
    total: int
    replaced: bool


@app.post("/index", response_model=IndexResponse)
def index_items(req: IndexRequest) -> IndexResponse:
    global _index, _meta
    if not req.items:
        raise HTTPException(400, "items must be non-empty")
    with _lock:
        if req.replace_all:
            _index = faiss.IndexFlatIP(EMBED_DIM)
            _meta = []
        else:
            get_index()
        # Dedupe: skip items whose id is already indexed
        existing_ids = {m["id"] for m in _meta}
        fresh = [it for it in req.items if it.id not in existing_ids]
        if fresh:
            vecs = encode_normalized([it.text for it in fresh])
            _index.add(vecs)
            for it in fresh:
                _meta.append({"id": it.id, "path": it.path})
        persist_index()
        return IndexResponse(
            added=len(fresh), total=int(_index.ntotal), replaced=req.replace_all
        )


class SimilarRequest(BaseModel):
    text: Optional[str] = None
    embedding: Optional[List[float]] = None
    k: int = 10
    exclude_ids: List[str] = []


class SimilarHit(BaseModel):
    id: str
    path: str
    similarity: float
    rank: int


class SimilarResponse(BaseModel):
    hits: List[SimilarHit]


@app.post("/similar", response_model=SimilarResponse)
def similar(req: SimilarRequest) -> SimilarResponse:
    if req.text is None and req.embedding is None:
        raise HTTPException(400, "must provide text or embedding")
    with _lock:
        idx = get_index()
        if idx.ntotal == 0:
            return SimilarResponse(hits=[])
        if req.embedding is not None:
            q = np.array([req.embedding], dtype="float32")
        else:
            q = encode_normalized([req.text])
        # over-fetch to allow exclusion filtering, then trim
        k = min(req.k + len(req.exclude_ids) + 1, idx.ntotal)
        sims, ids = idx.search(q, k)
        excl = set(req.exclude_ids)
        hits: List[SimilarHit] = []
        rank = 0
        for sim, row in zip(sims[0].tolist(), ids[0].tolist()):
            if row < 0 or row >= len(_meta):
                continue
            meta = _meta[row]
            if meta["id"] in excl:
                continue
            hits.append(
                SimilarHit(
                    id=meta["id"],
                    path=meta["path"],
                    similarity=float(sim),
                    rank=rank,
                )
            )
            rank += 1
            if len(hits) >= req.k:
                break
        return SimilarResponse(hits=hits)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME}


@app.get("/stats")
def stats() -> dict:
    idx = get_index()
    return {
        "model": MODEL_NAME,
        "dim": EMBED_DIM,
        "ntotal": int(idx.ntotal),
        "index_path": str(INDEX_PATH),
        "meta_path": str(META_PATH),
        "loaded": _model is not None,
    }


if __name__ == "__main__":
    import uvicorn

    # warm: load model + index up-front so first request is fast
    get_model()
    get_index()
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
