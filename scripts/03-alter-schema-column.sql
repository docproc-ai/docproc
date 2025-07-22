-- Alter the column type for 'schema' in DocumentTypes to JSON to preserve key order.
-- This is necessary to maintain the user-defined order of fields in the schema builder.
ALTER TABLE "DocumentTypes" ALTER COLUMN "schema" TYPE JSON;

-- Also alter the schema_snapshot in the Documents table for consistency.
ALTER TABLE "Documents" ALTER COLUMN "schema_snapshot" TYPE JSON;
