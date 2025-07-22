-- Create a custom type for the document status for data integrity
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
        CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected', 'processing_failed');
    END IF;
END$$;

-- Create the table to store individual document metadata
CREATE TABLE IF NOT EXISTS "Documents" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "document_type_id" UUID NOT NULL REFERENCES "DocumentTypes"("id") ON DELETE CASCADE,
    "status" document_status NOT NULL DEFAULT 'pending',
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL, -- This will be the path to the file in Vercel Blob
    "extracted_data" JSONB,
    "schema_snapshot" JSONB, -- A copy of the schema at processing time
    "uploaded_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP WITH TIME ZONE
);

-- Add indexes for columns that will be frequently used in queries
CREATE INDEX IF NOT EXISTS "idx_documents_status" ON "Documents" ("status");
CREATE INDEX IF NOT EXISTS "idx_documents_document_type_id" ON "Documents" ("document_type_id");
