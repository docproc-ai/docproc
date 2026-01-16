ALTER TABLE "document" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "document_type" ADD COLUMN "slug_pattern" text;--> statement-breakpoint
CREATE INDEX "idx_document_slug" ON "document" USING btree ("slug");