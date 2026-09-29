// 08 단계에서 Fastify + Drizzle 로 채운다. 지금은 dev 스크립트가 도는 최소 서버.
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8787);
createServer((req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, mock: process.env.MOCK_MODE !== 'false' }));
}).listen(port, () => console.log(`server :${port}`));
