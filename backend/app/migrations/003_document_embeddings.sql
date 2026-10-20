-- Nexo - Caché de embeddings por documento y modelo (búsqueda semántica opcional)
CREATE TABLE IF NOT EXISTS public.nexo_document_embeddings (
    document_id UUID NOT NULL REFERENCES public.nexo_documents(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    ord INT NOT NULL,
    embedding REAL[] NOT NULL,
    PRIMARY KEY (document_id, model, ord)
);
