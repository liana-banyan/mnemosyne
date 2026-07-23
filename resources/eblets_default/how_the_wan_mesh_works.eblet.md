# How the WAN Mesh Works (No LAN, No IP Setup)

MnemosyneC peers find each other through a Supabase-hosted relay, not through
local-network discovery or hardcoded IP addresses. This means two installs on
opposite sides of the world can cooperate exactly like two installs on the same
Wi-Fi network — the relay is the rendezvous point, not the transport shortcut.

## The three moving parts

1. **Presence publish** — each running app periodically tells the relay
   "I'm here, this is what I can do" (installed domains, hardware tier, model).
2. **Relay-answer poller** — each running app also polls the relay for questions
   routed to it, answers them locally, and posts the answer back.
3. **Route poll / Plow** — when you run a distributed test (for example, a public
   benchmark like MMLU-Pro), your app splits the work into questions, routes them
   to peers over the relay, collects answers, and scores them.

## Why this matters for the one-click test

The one-click benchmark demo works precisely because presence + relay-answer are
both running in the background. If a fresh install shows zero results or a
"mesh is dark" message, check that both of those are actually started (this is
exactly what BP132's mesh-revival work fixed: both were fully built but never
called at boot time).
