# Database Migration to OpenAI Embeddings

## What This Migration Does

This migration updates your RAG system to use OpenAI's superior models:

- **Embeddings**: `text-embedding-3-small` (1536 dimensions) - more accurate than sentence-transformers
- **LLM**: `gpt-4o-mini` - better reasoning than GPT-3.5-turbo  
- **Configuration**: Top-k=5, max_tokens=500, similarity_threshold=0.78

## How to Run the Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard/project/oktdncmkvcvrejohkoar
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `database/migrate_to_openai_embeddings.sql`
4. Click **Run** to execute the migration

### Option 2: Command Line (if you have psql installed)

```bash
psql "postgresql://postgres:m7yYvyU09odUuwGQ@db.oktdncmkvcvrejohkoar.supabase.co:5432/postgres" -f database/migrate_to_openai_embeddings.sql
```

## What Happens After Migration

1. **Existing chunks are cleared** (they have old 384-dim embeddings)
2. **Database schema updated** to 1536 dimensions
3. **Documents reset to PENDING** status for reprocessing
4. **New uploads will use OpenAI embeddings** automatically

## Add Your OpenAI API Key

Update these files with your actual OpenAI API key:

```bash
# In .env
OPENAI_API_KEY=sk-your-actual-openai-key-here

# In services/document-processing/.env  
OPENAI_API_KEY=sk-your-actual-openai-key-here

# In services/query-processing/.env
OPENAI_API_KEY=sk-your-actual-openai-key-here
```

## Test the System

1. Upload a new document (it will use OpenAI embeddings)
2. Ask questions about the document (responses will use GPT-4o-mini)
3. Enjoy superior RAG performance! 🚀

## Fallback Behavior

If no OpenAI API key is provided:
- **Embeddings**: Falls back to sentence-transformers (all-MiniLM-L6-v2)
- **LLM**: Uses enhanced mock responses with context
- **System still works** but with reduced quality