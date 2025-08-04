ALTER TABLE "document" DROP CONSTRAINT "document_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "document" DROP CONSTRAINT "document_updated_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "document_type" DROP CONSTRAINT "document_type_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "document_type" DROP CONSTRAINT "document_type_updated_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "document_type" ADD COLUMN "webhook_config" json;
--> statement-breakpoint
-- Migrate existing webhook data to new format
UPDATE "document_type" 
SET "webhook_config" = json_build_object(
  'events', json_build_object(
    'approved', json_build_object(
      'enabled', CASE WHEN "webhook_url" IS NOT NULL AND "webhook_url" != '' THEN true ELSE false END,
      'url', COALESCE("webhook_url", ''),
      'method', COALESCE("webhook_method", 'POST'),
      'headers', json_build_array()
    )
  )
)
WHERE "webhook_url" IS NOT NULL AND "webhook_url" != '';
--> statement-breakpoint
-- Drop old webhook columns
ALTER TABLE "document_type" DROP COLUMN "webhook_url";
--> statement-breakpoint
ALTER TABLE "document_type" DROP COLUMN "webhook_method";
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_type" ADD CONSTRAINT "document_type_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_type" ADD CONSTRAINT "document_type_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
