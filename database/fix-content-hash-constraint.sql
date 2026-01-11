-- Fix content_hash constraint to be per-user instead of global
-- This allows different users to upload the same document

-- Drop the existing global unique constraint on content_hash
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_content_hash_key;

-- Add a new unique constraint that combines user_id and content_hash
-- This allows the same document to be uploaded by different users
-- but prevents the same user from uploading the same document twice
ALTER TABLE documents ADD CONSTRAINT documents_user_content_unique UNIQUE (user_id, content_hash);

-- Update the index for better performance
DROP INDEX IF EXISTS idx_documents_content_hash;
CREATE INDEX idx_documents_user_content_hash ON documents(user_id, content_hash);