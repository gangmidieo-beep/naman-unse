// 서버 시작 — PORT(기본 8791). DEMO_DATA=true 면 관리자 확인용 데모 데이터(개발 전용).
import { buildApp } from './app.ts';

const { app } = await buildApp({ logger: true, demo: process.env.DEMO_DATA === 'true' });
const port = Number(process.env.PORT || 8791);
await app.listen({ port, host: '0.0.0.0' });
