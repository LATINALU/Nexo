-- Nexo - Esquema inicial PostgreSQL (se ejecuta automáticamente al iniciar el backend)

-- ============================================================
-- Perfiles de usuario
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nexo_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,  -- id en un proveedor de identidad externo (opcional)
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(100),
    user_code VARCHAR(10) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'free',
    avatar_url TEXT,
    preferred_language VARCHAR(5) DEFAULT 'es',
    preferred_agents TEXT[] DEFAULT '{}',
    max_agents_per_task INT DEFAULT 10,
    monthly_query_limit INT DEFAULT 50,
    queries_used_this_month INT DEFAULT 0,
    last_query_reset TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexo_profiles_auth_user ON public.nexo_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_nexo_profiles_username ON public.nexo_profiles(username);
CREATE INDEX IF NOT EXISTS idx_nexo_profiles_user_code ON public.nexo_profiles(user_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nexo_profiles_email_lower
    ON public.nexo_profiles (lower(email)) WHERE email IS NOT NULL;

-- ============================================================
-- Conversations (persistent chat history per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nexo_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,
    conversation_id VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL DEFAULT 'Nueva conversación',
    model VARCHAR(100),
    agents TEXT[] DEFAULT '{}',
    message_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON public.nexo_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.nexo_conversations(updated_at DESC);

-- ============================================================
-- Messages (individual messages within conversations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nexo_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.nexo_conversations(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,  -- orden dentro de la conversación
    role VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    agent_id VARCHAR(100),
    model VARCHAR(100),
    tokens_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.nexo_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.nexo_messages(created_at);

-- ============================================================
-- User Memory (persistent context per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nexo_user_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,
    key VARCHAR(200) NOT NULL,
    value TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',  -- 'general', 'preference', 'context', 'instruction'
    importance INT DEFAULT 5,  -- 1-10
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_memory_user ON public.nexo_user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_category ON public.nexo_user_memory(user_id, category);

-- ============================================================
-- User Preferences (settings & customization)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nexo_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'dark',
    language VARCHAR(5) DEFAULT 'es',
    default_model VARCHAR(100),
    default_agents TEXT[] DEFAULT '{}',
    auto_save_conversations BOOLEAN DEFAULT TRUE,
    show_agent_thinking BOOLEAN DEFAULT FALSE,
    notification_enabled BOOLEAN DEFAULT TRUE,
    custom_instructions TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preferences_user ON public.nexo_user_preferences(user_id);

-- ============================================================
-- Usage Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nexo_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,  -- '2026-02'
    queries_used INT DEFAULT 0,
    tokens_consumed BIGINT DEFAULT 0,
    agents_used TEXT[] DEFAULT '{}',
    models_used TEXT[] DEFAULT '{}',
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_month ON public.nexo_usage(user_id, month);

-- ============================================================
-- API Keys (for programmatic access)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nexo_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,  -- 'nexo_xxxx' for display
    permissions TEXT[] DEFAULT '{read,write}',
    last_used TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.nexo_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.nexo_api_keys(key_hash);

-- ============================================================
-- Subscription Plans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nexo_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.nexo_profiles(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL DEFAULT 'free',  -- 'free', 'pro', 'enterprise'
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    monthly_queries INT DEFAULT 50,
    max_agents INT DEFAULT 10,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    payment_id VARCHAR(200),
    amount DECIMAL(10,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.nexo_subscriptions(user_id);

-- ============================================================
-- Helper function: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.nexo_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-update
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated') THEN
        CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.nexo_profiles
            FOR EACH ROW EXECUTE FUNCTION public.nexo_update_timestamp();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conversations_updated') THEN
        CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.nexo_conversations
            FOR EACH ROW EXECUTE FUNCTION public.nexo_update_timestamp();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_memory_updated') THEN
        CREATE TRIGGER trg_memory_updated BEFORE UPDATE ON public.nexo_user_memory
            FOR EACH ROW EXECUTE FUNCTION public.nexo_update_timestamp();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_preferences_updated') THEN
        CREATE TRIGGER trg_preferences_updated BEFORE UPDATE ON public.nexo_user_preferences
            FOR EACH ROW EXECUTE FUNCTION public.nexo_update_timestamp();
    END IF;
END$$;
