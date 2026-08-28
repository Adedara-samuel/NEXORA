-- Runs once when the postgres container's data directory is first initialised.
-- Enables the extensions NEXORA depends on across phases:
--   pgvector -> AI embeddings / RAG (Phase 8)
--   pg_trgm  -> fuzzy/full-text search (Phase 5+ search module)
--   uuid-ossp -> UUID primary key generation
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
