// 상품 상세 문구(product-detail.json)의 예전 기본값 지문(sha1) 목록을 만든다 — npm run copy:history
// 서버 시작 때(seed) DB 의 상세 문구가 이 목록 중 하나와 같으면 "관리자가 손대지 않은 예전 기본 문구"로 보고 새 문구로 바꾼다.
// (2026-10-20: 3차에서 고친 상품 26종 설명이 운영 DB 에는 예전 문구로 남아 화면에 안 바뀌던 문제)
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';

const FILE = 'packages/content/data/product-detail.json';
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const sha = (v) => createHash('sha1').update(canon(v)).digest('hex').slice(0, 16);
const out = {};
const versions = execSync(`git log --format=%H -- ${FILE}`).toString().trim().split('\n');
for (const h of versions) {
  const json = JSON.parse(execSync(`git show ${h}:${FILE}`, { maxBuffer: 1 << 26 }).toString());
  for (const [id, v] of Object.entries(json)) if (!id.startsWith('_')) (out[id] ??= new Set()).add(sha(v));
}
const cur = JSON.parse(readFileSync(FILE, 'utf8'));
for (const [id, v] of Object.entries(cur)) if (!id.startsWith('_')) (out[id] ??= new Set()).add(sha(v));
writeFileSync('packages/content/data/product-detail-history.json', JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, s]) => [k, [...s]])), null, 0) + '\n');
console.log(`예전 문구 지문 ${Object.values(out).reduce((n, s) => n + s.size, 0)}개 (${versions.length}개 버전)`);
