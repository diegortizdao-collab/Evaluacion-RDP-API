CREATE TABLE IF NOT EXISTS rdp_evals (
  key        TEXT PRIMARY KEY,           -- evaluador__circulo (normalizado)
  evaluador  TEXT NOT NULL,
  circle     TEXT NOT NULL,
  scores     JSONB NOT NULL,             -- {"c1":3,"c2":4,...}
  total      NUMERIC(6,2) NOT NULL,
  pct        INTEGER NOT NULL,
  ts         BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS rdp_evals_circle_idx ON rdp_evals (lower(circle));
