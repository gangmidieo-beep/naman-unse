ALTER TABLE "subscriptions" ADD COLUMN "rebill_no" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "auto_renew" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "remind_day" text;