CREATE TABLE "ad_settings" (
	"slot" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"action" text NOT NULL,
	"target" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" text PRIMARY KEY NOT NULL,
	"slot" text NOT NULL,
	"title" text NOT NULL,
	"copy" text,
	"image_url" text,
	"link" text,
	"character" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text,
	"session_id" text,
	"name" text NOT NULL,
	"props" jsonb,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"referrer" text,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" text,
	"product_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"method" text,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"refund_status" text,
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"character" text,
	"group" text,
	"title" text NOT NULL,
	"card_copy" text,
	"detail" text,
	"price" integer DEFAULT 0 NOT NULL,
	"member_price" integer,
	"thumb_hanja" text,
	"image_url" text,
	"badge" text,
	"visible" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"google_product_id" text,
	"meta" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"relation" text,
	"gender" text NOT NULL,
	"birth_year" integer NOT NULL,
	"birth_month" integer NOT NULL,
	"birth_day" integer NOT NULL,
	"calendar" text NOT NULL,
	"leap" boolean DEFAULT false NOT NULL,
	"birth_hour" integer,
	"blood_type" text,
	"mbti" text,
	"is_main" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"deep_link" text NOT NULL,
	"target" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"status" text NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"profile_id" text,
	"product_id" text NOT NULL,
	"status" text NOT NULL,
	"content" jsonb,
	"model" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_krw" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"code" text PRIMARY KEY NOT NULL,
	"content_id" text NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"user_id" text,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"channel" text NOT NULL,
	"amount" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"renewed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"canceled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "talismans" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"talisman_id" text NOT NULL,
	"name" text NOT NULL,
	"birth" text NOT NULL,
	"wish" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text,
	"provider" text,
	"provider_id" text,
	"email" text,
	"name" text,
	"platform" text,
	"font_scale" text,
	"push_time" text,
	"push_token" text,
	"push_consent" boolean,
	"merged_into" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "events_name_created" ON "events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "orders_user" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_created" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "profiles_user" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subs_user" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_device" ON "users" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "users_provider" ON "users" USING btree ("provider","provider_id");