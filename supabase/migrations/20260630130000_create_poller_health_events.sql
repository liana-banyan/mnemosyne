-- K20 Module 6: poller health telemetry table
-- BP099→BP100 MnemosyneC v0.8.13
-- Records crash, restart, ollama_down/up, split-brain events from Electron main process.

CREATE TABLE IF NOT EXISTS poller_health_events (
  id              BIGSERIAL PRIMARY KEY,
  peer_id         TEXT NOT NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN (
                    'crash','restart','ollama_down','ollama_up',
                    'split_brain_detected','split_brain_recovery','fatal_crashloop'
                  )),
  event_data      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE poller_health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members write own poller events"
  ON poller_health_events FOR INSERT TO authenticated
  WITH CHECK (peer_id = (current_setting('request.jwt.claims', true)::jsonb->>'peer_id'));

CREATE INDEX idx_poller_health_events_peer_created
  ON poller_health_events (peer_id, created_at DESC);

CREATE INDEX idx_poller_health_events_event_type
  ON poller_health_events (event_type, created_at DESC);
