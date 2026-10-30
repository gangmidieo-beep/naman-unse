-- 공유 카드: 상품 대표 썸네일 경로·공유한 곳(web|app) — 2026-10-30 대표님 공유 기능 요청
ALTER TABLE "share_links" ADD COLUMN IF NOT EXISTS "image" text;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN IF NOT EXISTS "source" text;
