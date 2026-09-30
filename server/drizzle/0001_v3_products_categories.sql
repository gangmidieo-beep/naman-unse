CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tab" text NOT NULL,
	"label" text NOT NULL,
	"sub" text,
	"character" text,
	"groups" jsonb,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tab" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "list_price" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "show_discount" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "button_label" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "result_title" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "recommend" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "detail_copy" jsonb;