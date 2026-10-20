-- Nexo - Documentos adjuntos (RAG) y equipos guardados

CREATE TABLE IF NOT EXISTS public.nexo_documents (
    id UUID PRIMARY KEY,
    owner_id UUID REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,  -- NULL = invitado
    name VARCHAR(200) NOT NULL,
    mime VARCHAR(100),
    size INT NOT NULL DEFAULT 0,
    char_count INT NOT NULL DEFAULT 0,
    chunk_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nexo_documents_owner ON public.nexo_documents(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.nexo_document_chunks (
    document_id UUID NOT NULL REFERENCES public.nexo_documents(id) ON DELETE CASCADE,
    ord INT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (document_id, ord)
);

CREATE TABLE IF NOT EXISTS public.nexo_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    emoji VARCHAR(16) DEFAULT '👥',
    description VARCHAR(300) DEFAULT '',
    agents TEXT[] NOT NULL DEFAULT '{}',
    mode VARCHAR(20) NOT NULL DEFAULT 'parallel',
    synthesize BOOLEAN NOT NULL DEFAULT TRUE,
    web_search BOOLEAN NOT NULL DEFAULT FALSE,
    instructions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nexo_teams_user ON public.nexo_teams(user_id, updated_at DESC);
