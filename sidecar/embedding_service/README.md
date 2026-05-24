# Embedding Service — Shadow E-Spider sidecar

Local-CPU embedding service for Shadow E-Spider bridge-line queries (BP030 / Bushel 60 Phase C).

## Stack

- `sentence-transformers` `all-MiniLM-L6-v2` (~80 MB, 384-dim, normalized)
- `faiss-cpu` `IndexFlatIP` (cosine via inner product on normalized vectors)
- `FastAPI` + `uvicorn` on `http://127.0.0.1:8765`
- Persistent index at `~/.lb_substrate/embeddings/eblet_index.{faiss,meta.json}`

## Run

```powershell
pip install -r requirements.txt
python server.py
```

## Endpoints

| Method | Path        | Purpose                                          |
|--------|-------------|--------------------------------------------------|
| POST   | `/embed`    | `{ texts: [...] }` -> 384-dim embeddings         |
| POST   | `/index`    | Add or replace Eblets in the persistent index    |
| POST   | `/similar`  | k-NN cosine search on the index                  |
| GET    | `/health`   | Liveness probe                                   |
| GET    | `/stats`    | Index size, model name, dim                      |

## Architecture reference

`BISHOP_DROPZONE/14_CanonicalReferences/LOCAL_CPU_COMPUTE_ARCHITECTURE_SPRITES_SPIDERS_BP030.md`  §4
