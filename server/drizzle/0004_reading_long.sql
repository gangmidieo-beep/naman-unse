ALTER TABLE "readings" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;