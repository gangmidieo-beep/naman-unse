// DB 구조(납품물 "DB 구조") — drizzle/ 마이그레이션 SQL 은 이 파일에서 생성(npm run db:generate -w server).
import { pgTable, text, integer, boolean, timestamp, jsonb, bigserial, serial, index } from 'drizzle-orm/pg-core';

const now = () => timestamp({ withTimezone: true }).defaultNow().notNull();

export const users = pgTable('users', {
  id: text().primaryKey(),
  deviceId: text(),
  provider: text(), // google | kakao | naver | mock (null = 게스트)
  providerId: text(),
  email: text(),
  name: text(),
  platform: text(), // web | android
  fontScale: text(),
  pushTime: text(),
  pushToken: text(),
  pushConsent: boolean(),
  mergedInto: text(), // 게스트 → 로그인 계정으로 합쳐지면 대상 id
  createdAt: now(),
  lastSeenAt: now(),
  deletedAt: timestamp({ withTimezone: true }),
}, (t) => [index('users_device').on(t.deviceId), index('users_provider').on(t.provider, t.providerId)]);

export const profiles = pgTable('profiles', {
  id: text().primaryKey(),
  userId: text().notNull(),
  name: text().notNull(),
  relation: text(),
  gender: text().notNull(), // M | F
  birthYear: integer().notNull(),
  birthMonth: integer().notNull(),
  birthDay: integer().notNull(),
  calendar: text().notNull(), // solar | lunar
  leap: boolean().default(false).notNull(),
  birthHour: integer(), // null = 시간 모름
  bloodType: text(),
  mbti: text(),
  isMain: boolean().default(false).notNull(),
  createdAt: now(),
}, (t) => [index('profiles_user').on(t.userId)]);

// 상품 — 초기값은 brand.config.json(=상품카탈로그_v2) seed, 이후 원본은 DB(관리자 상품관리)
export const products = pgTable('products', {
  id: text().primaryKey(),
  kind: text().notNull(), // reading | talisman | subscription | fun | today
  character: text(),
  group: text(),
  title: text().notNull(),
  cardCopy: text(),
  detail: text(),
  price: integer().default(0).notNull(),
  memberPrice: integer(),
  thumbHanja: text(),
  imageUrl: text(),
  badge: text(), // BEST | HOT | NEW | 인기
  visible: boolean().default(true).notNull(),
  sort: integer().default(0).notNull(),
  googleProductId: text(),
  meta: jsonb(),
  // v3 공통 틀 필드
  tab: text(), // unse | tarot | talisman | fun | today | premium
  category: text(), // categories.id (fate | love | fun | photo | tarot ...)
  listPrice: integer(), // 정가(있으면 카드에 할인율% + 취소선)
  showDiscount: boolean().default(true).notNull(),
  buttonLabel: text(),
  resultTitle: text(),
  recommend: jsonb().$type<string[]>(), // 결과 화면 추천 부적 id (talisman-map 기본값)
  detailCopy: jsonb(), // 상세 문구 {subtitle,target,why,contents,say}
  updatedAt: now(),
});

// 탭 → 분류 → 순서 (운세 탭 칩·타로 탭 묶음). 관리자 수정 가능
export const categories = pgTable('categories', {
  id: text().primaryKey(),
  tab: text().notNull(),
  label: text().notNull(),
  sub: text(),
  character: text(),
  groups: jsonb().$type<string[]>(),
  sort: integer().default(0).notNull(),
  visible: boolean().default(true).notNull(),
});

export const orders = pgTable('orders', {
  id: text().primaryKey(),
  userId: text().notNull(),
  profileId: text(),
  productId: text().notNull(),
  kind: text().notNull(), // reading | talisman | subscription
  amount: integer().notNull(),
  discount: integer().default(0).notNull(),
  method: text(), // card | kakaopay | google | ...
  channel: text().notNull(), // google | pg | mock
  status: text().notNull(), // pending | paid | failed | cancelled | refunded
  refundStatus: text(), // requested | done
  providerRef: text(),
  createdAt: now(),
  paidAt: timestamp({ withTimezone: true }),
}, (t) => [index('orders_user').on(t.userId), index('orders_created').on(t.createdAt)]);

export const subscriptions = pgTable('subscriptions', {
  id: text().primaryKey(),
  userId: text().notNull(),
  plan: text().notNull(), // monthly | yearly
  status: text().notNull(), // active | grace | on_hold | canceled | expired
  channel: text().notNull(),
  amount: integer().notNull(),
  startedAt: now(),
  renewedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  canceledAt: timestamp({ withTimezone: true }),
}, (t) => [index('subs_user').on(t.userId)]);

export const readings = pgTable('readings', {
  id: text().primaryKey(),
  orderId: text().notNull(),
  profileId: text(),
  productId: text().notNull(),
  status: text().notNull(), // queued | generating | done | failed
  content: jsonb(),
  model: text(),
  tokensIn: integer(),
  tokensOut: integer(),
  costKrw: integer(),
  createdAt: now(),
  doneAt: timestamp({ withTimezone: true }),
});

export const talismans = pgTable('talismans', {
  id: text().primaryKey(),
  orderId: text().notNull(),
  userId: text().notNull(),
  talismanId: text().notNull(),
  name: text().notNull(),
  birth: text().notNull(),
  wish: text().notNull(),
  issuedAt: now(),
});

export const events = pgTable('events', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  userId: text(),
  sessionId: text(),
  name: text().notNull(),
  props: jsonb(),
  utmSource: text(),
  utmMedium: text(),
  utmCampaign: text(),
  referrer: text(),
  platform: text(),
  createdAt: now(),
}, (t) => [index('events_name_created').on(t.name, t.createdAt)]);

export const shareLinks = pgTable('share_links', {
  code: text().primaryKey(),
  contentId: text().notNull(),
  path: text().notNull(),
  title: text().notNull(),
  text: text().notNull(),
  userId: text(),
  clicks: integer().default(0).notNull(),
  createdAt: now(),
});

// 홈 롤링 배너 / 이벤트 팝업 / 앱 종료 팝업
export const banners = pgTable('banners', {
  id: text().primaryKey(),
  slot: text().notNull(), // home | event_popup | exit_popup
  title: text().notNull(),
  copy: text(),
  imageUrl: text(),
  link: text(), // 앱 화면 경로 또는 URL
  character: text(),
  startsAt: timestamp({ withTimezone: true }),
  endsAt: timestamp({ withTimezone: true }),
  sort: integer().default(0).notNull(),
  active: boolean().default(true).notNull(),
});

export const pushCampaigns = pgTable('push_campaigns', {
  id: serial().primaryKey(),
  title: text().notNull(),
  body: text().notNull(),
  deepLink: text().notNull(),
  target: text().notNull(), // all | free | premium | dormant7 | dormant30
  scheduledAt: timestamp({ withTimezone: true }),
  status: text().notNull(), // draft | scheduled | sent
  sentCount: integer().default(0).notNull(),
  createdBy: text(),
  createdAt: now(),
});

// 광고 위치별 설정: home_banner | detail_native | rewarded | exit
export const adSettings = pgTable('ad_settings', {
  slot: text().primaryKey(),
  enabled: boolean().default(true).notNull(),
  config: jsonb(),
});

export const admins = pgTable('admins', {
  id: serial().primaryKey(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: text().notNull(), // super | operator
  failedCount: integer().default(0).notNull(),
  lockedUntil: timestamp({ withTimezone: true }),
  createdAt: now(),
});

export const auditLogs = pgTable('audit_logs', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  adminId: integer(),
  action: text().notNull(),
  target: text(),
  detail: jsonb(),
  createdAt: now(),
});
