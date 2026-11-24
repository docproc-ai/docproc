CREATE TABLE "mcp_upload_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"auto_process" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"document_id" uuid,
	"job_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_upload_link_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "mcp_upload_link" ADD CONSTRAINT "mcp_upload_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_upload_link" ADD CONSTRAINT "mcp_upload_link_document_type_id_document_type_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_type"("id") ON DELETE cascade ON UPDATE no action;