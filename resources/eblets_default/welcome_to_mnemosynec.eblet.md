# Welcome to MnemosyneC

MnemosyneC is a cooperative-AI substrate app. It runs a local model on your own
machine (via Ollama) and, once you opt in, can join a WAN mesh of other peers'
machines over a Supabase relay — no LAN or manual IP configuration required.

## What "the mesh" means

Every MnemosyneC install can:
- Answer questions routed to it from other peers (relay-answer poller).
- Publish its presence so other peers can find it (WAN relay, not local network).
- Contribute compute to distributed test runs (the "Plow" pipeline) — for example,
  running a slice of a public benchmark and reporting back a verified answer.

## Why you might see an empty substrate on first launch

This is a fresh install. The "eblet store" (this app's long-term memory of facts,
canon, and verified answers) starts empty for a new user by design — no
demographic or personal data is collected, and no proprietary canon ships inside
the public installer. As you use the app (ask questions, verify answers, drop
your own notes into the app's eblet folder), your own local substrate grows.

## Where your own eblets live

Your personal eblet folder lives under this app's user-data directory (per-OS
"userData" path, e.g. `%APPDATA%\MnemosyneC\eblets` on Windows). Anything you
place there — or that the app writes there from verified answers — becomes part
of what future Asks can recall.
