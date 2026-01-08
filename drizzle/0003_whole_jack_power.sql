ALTER TYPE "public"."document_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "document_type" ADD COLUMN "validation_instructions" text;