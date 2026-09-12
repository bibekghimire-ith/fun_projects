# RAG

Source -> parse -> metadata -> chunk -> embed -> vector store -> retrieve -> optional rerank ->
context -> answer.

Use PostgreSQL/pgvector by default, with provider-neutral embeddings. Maintain per-user
isolation, source metadata, deletion propagation and citations.

Sources can include uploads, approved local directories, URLs, Notion and GitHub when enabled.
