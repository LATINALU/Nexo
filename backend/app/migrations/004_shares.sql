-- Nexo - Conversaciones compartidas por link (solo lectura, revocables)
CREATE TABLE IF NOT EXISTS public.nexo_shares (
    id VARCHAR(32) PRIMARY KEY,                -- token aleatorio del link
    owner_id UUID REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,
    owner_key_hash VARCHAR(64) NOT NULL,       -- sha256 de la clave para revocar (invitados)
    title VARCHAR(200) NOT NULL,
    payload JSONB NOT NULL,
    views INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nexo_shares_owner ON public.nexo_shares(owner_id, created_at DESC);
