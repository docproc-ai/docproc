-- Enable UUID generation if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the table to store different document types (schemas)
CREATE TABLE IF NOT EXISTS "DocumentTypes" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "webhook_url" TEXT,
    "webhook_method" TEXT DEFAULT 'POST',
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add an index on the name for faster lookups
CREATE INDEX IF NOT EXISTS "idx_documenttypes_name" ON "DocumentTypes" ("name");
