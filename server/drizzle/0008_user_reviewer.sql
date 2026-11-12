-- 구글 플레이 심사용 접근: 심사 코드를 넣은 기기(계정)는 유료 상품을 결제 없이 받음 — 2026-11-12 Play 등록
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reviewer" boolean DEFAULT false NOT NULL;
