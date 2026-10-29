-- 관리자 업로드 이미지(상품·배너) — 서버 디스크는 배포할 때마다 지워져서 DB 에 보관
CREATE TABLE IF NOT EXISTS "uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
