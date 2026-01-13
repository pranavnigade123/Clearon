-- FRESH CLEAN SCHEMA FOR RAG PLATFORM
-- Simple, well-designed database from scratch
-- No complex migrations, no confusion - just clean design

-- ============================================================================
-- EXTENSIONS AND TYPES
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create simple, clear types
CREATE TYPE source_type AS ENUM ('PDF', 'WEB', 'CSV');
CREATE TYPE processing_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- ============================================================================
-- CORE TABLES - SIMPLE AND CLEAN
-- ============================================================================

-- Users table - main user profiles (one per person)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User authentication mapping (links auth.users to our users)
CREATE TABLE user_auth_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auth_user_id UUID UNIQUE NOT NULL, -- References auth.users(id)
    provider TEXT NOT NULL DEFAULT 'email', -- 'email', 'google', 'github'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    chunk_size INTEGER DEFAULT 512,
    chunk_overlap INTEGER DEFAULT 102,
    max_results INTEGER DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.78,
    preferred_citation_style TEXT DEFAULT 'APA',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type source_type NOT NULL,
    title TEXT NOT NULL,
    original_filename TEXT,
    url TEXT,
    s3_key TEXT, -- For S3 storage
    local_path TEXT, -- For local storage (development)
    content_hash TEXT NOT NULL,
    file_size BIGINT,
    processing_status processing_status DEFAULT 'PENDING',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate uploads per user
    UNIQUE(user_id, content_hash)
);

-- Document chunks with embeddings
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    token_count INTEGER,
    source_location JSONB NOT NULL,
    embedding VECTOR(1536), -- text-embedding-3-small embeddings (1536 dimensions)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(document_id, chunk_index)
);

-- Query history for analytics
CREATE TABLE query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    response_text TEXT,
    sources_used JSONB DEFAULT '[]',
    processing_time_ms INTEGER,
    confidence_score FLOAT,
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_auth_mapping_auth_user_id ON user_auth_mapping(auth_user_id);
CREATE INDEX idx_user_auth_mapping_user_id ON user_auth_mapping(user_id);

-- Document indexes
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_content_hash ON documents(content_hash);

-- Chunk indexes
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_chunk_index ON document_chunks(document_id, chunk_index);

-- Vector similarity search index
CREATE INDEX document_chunks_embedding_idx 
ON document_chunks USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Query history indexes
CREATE INDEX idx_query_history_user_id ON query_history(user_id);
CREATE INDEX idx_query_history_created_at ON query_history(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_auth_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_history ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT user_id 
        FROM user_auth_mapping 
        WHERE auth_user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simple RLS policies
CREATE POLICY "Users can view their own profile" ON users
    FOR ALL USING (id = get_current_user_id());

CREATE POLICY "Users can view their auth mapping" ON user_auth_mapping
    FOR ALL USING (auth_user_id = auth.uid());

CREATE POLICY "Users can manage their preferences" ON user_preferences
    FOR ALL USING (user_id = get_current_user_id());

CREATE POLICY "Users can manage their documents" ON documents
    FOR ALL USING (user_id = get_current_user_id());

CREATE POLICY "Users can manage their document chunks" ON document_chunks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM documents 
            WHERE documents.id = document_chunks.document_id 
            AND documents.user_id = get_current_user_id()
        )
    );

CREATE POLICY "Users can manage their query history" ON query_history
    FOR ALL USING (user_id = get_current_user_id());

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create user on auth signup
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_user_id UUID;
    new_user_id UUID;
    user_name TEXT;
BEGIN
    -- Extract name from metadata
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Check if user with this email already exists
    SELECT id INTO existing_user_id FROM users WHERE email = NEW.email;
    
    IF existing_user_id IS NOT NULL THEN
        -- Link to existing user
        INSERT INTO user_auth_mapping (user_id, auth_user_id, provider)
        VALUES (
            existing_user_id,
            NEW.id,
            COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
        ) ON CONFLICT (auth_user_id) DO NOTHING;
        
        -- Update last login
        UPDATE users 
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = existing_user_id;
    ELSE
        -- Create new user
        INSERT INTO users (email, name, avatar_url, last_login_at)
        VALUES (
            NEW.email,
            user_name,
            NEW.raw_user_meta_data->>'avatar_url',
            NOW()
        ) RETURNING id INTO new_user_id;
        
        -- Link auth user to new user
        INSERT INTO user_auth_mapping (user_id, auth_user_id, provider)
        VALUES (
            new_user_id,
            NEW.id,
            COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
        );
        
        -- Create default preferences
        INSERT INTO user_preferences (user_id)
        VALUES (new_user_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new auth users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================================
-- RAG UTILITY FUNCTIONS
-- ============================================================================

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.78,
    match_count INT DEFAULT 5,
    filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    source_location JSONB,
    similarity FLOAT,
    document_title TEXT,
    source_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.source_location,
        1 - (dc.embedding <=> query_embedding) AS similarity,
        d.title as document_title,
        d.source_type::TEXT as source_type
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE 
        (filter_user_id IS NULL OR d.user_id = filter_user_id)
        AND d.processing_status = 'COMPLETED'
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(target_user_id UUID)
RETURNS TABLE (
    total_documents BIGINT,
    total_chunks BIGINT,
    documents_by_type JSONB,
    processing_status_counts JSONB,
    total_file_size BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(d.id) as total_documents,
        COALESCE(SUM(chunk_counts.chunk_count), 0) as total_chunks,
        COALESCE(
            JSONB_OBJECT_AGG(d.source_type, COUNT(d.id)) 
            FILTER (WHERE d.source_type IS NOT NULL), 
            '{}'::jsonb
        ) as documents_by_type,
        COALESCE(
            JSONB_OBJECT_AGG(d.processing_status, COUNT(d.id)) 
            FILTER (WHERE d.processing_status IS NOT NULL), 
            '{}'::jsonb
        ) as processing_status_counts,
        COALESCE(SUM(d.file_size), 0) as total_file_size
    FROM documents d
    LEFT JOIN (
        SELECT document_id, COUNT(*) as chunk_count
        FROM document_chunks
        GROUP BY document_id
    ) chunk_counts ON d.id = chunk_counts.document_id
    WHERE d.user_id = target_user_id;
END;
$$;

-- Get current user info (for applications)
CREATE OR REPLACE FUNCTION get_current_user_info()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    name TEXT,
    avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.name, u.avatar_url
    FROM users u
    JOIN user_auth_mapping uam ON u.id = uam.user_id
    WHERE uam.auth_user_id = auth.uid()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Fresh clean schema created successfully!' as status,
       'Ready for user signup and document processing' as next_step;