# NEXORA AI Service

Python / FastAPI service — the NEXORA Intelligence Layer (AI Gateway, model
abstraction, RAG, AI tool registry, permission-aware retrieval). See
architecture sections 37–48.

**Not started.** This service is built in **Phase 7 (NEXORA AI Foundation)**
onward, after the Core API's auth, organisation, module and permission
systems exist for it to enforce against — the AI must never bypass NEXORA
authorization (section 45), so it depends on that foundation being real
first.

This development machine currently has no Python interpreter installed;
that will need to be provisioned before Phase 7 begins.

Planned stack: FastAPI, Pydantic, PyTorch (where required), Hugging Face
ecosystem, sentence-transformers, PostgreSQL + pgvector for vector storage
(already enabled in `infrastructure/database/init.sql`).
