-- Migration: Update to OpenAI text-embedding-3-small (1536 dimensions)
-- This migration updates the database to use OpenAI embeddings instead of sentence-transformers

-- Step 1: Drop existing chunks (they have old 384-dim embeddings)
TRUNCATE TABLE document_chunks;

-- Step 2: Update embedding column to 1536 dimensions
ALTER TABLE document_chunks ALTER COLUMN embedding TYPE VECTOR(1536);

-- Step 3: Update the match_documents function for new dimensions
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

-- Step 4: Update vector index for new dimensions
DROP INDEX IF EXISTS document_chunks_embedding_idx;
CREATE INDEX document_chunks_embedding_idx 
ON document_chunks USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Step 5: Reset document processing status so they get reprocessed with new embeddings
UPDATE documents SET processing_status = 'PENDING' WHERE processing_status = 'COMPLETED';

SELECT 'Migration completed: Updated to OpenAI text-embedding-3-small (1536 dimensions)' as status;