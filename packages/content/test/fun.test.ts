import { describe, it, expect } from 'vitest';
import { calcSaju } from '@naman/engine';
import {
  starSignOf, starToday, STAR_SIGNS, bloodToday, BLOOD_TYPES, tarotDraw, TAROT_DECK, tarotSide, DREAMS, searchDream, normDream,
  factbomb, mbtiResult, MBTI_TYPES, tarotSpread, smallSaju, oneLineSaju,
} from '../src/index';

const me = calcSaju({ year: 1968, month: 3, day: 15, hour: 7, calendar: 'solar', gender: 'M' });
const D = new Date('2026-09-30T03:00:00Z');

describe('별자리', () => {
  it('경계일', () => {
    expect(starSignOf(3, 20)).toBe('pisces');
    expect(starSignOf(3, 21)).toBe('aries');
    expect(starSignOf(1, 19)).toBe('capricorn');
    expect(starSignOf(1, 20)).toBe('aquarius');
    expect(starSignOf(12, 24)).toBe('sagittarius');
    expect(starSignOf(12, 25)).toBe('capricorn');
    expect(starSignOf(8, 23)).toBe('virgo');
    expect(starSignOf(9, 24)).toBe('libra');
  });
  it('12별자리 모두 결과, 같은 입력 같은 결과', () => {
    for (const s of STAR_SIGNS) {
      const r = starToday(s.id, D, 'p1');
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.oneLine && r.love && r.money && r.work && r.item && r.time).toBeTruthy();
      expect(r.intro).toHaveLength(3);
      expect(starToday(s.id, D, 'p1')).toEqual(r);
    }
  });
});

describe('혈액형', () => {
  it('4종 결과 + 잘 맞는 혈액형', () => {
    for (const t of BLOOD_TYPES) {
      const r = bloodToday(t, me, D, 'p1');
      expect(r.oneLine.length).toBeGreaterThan(5);
      expect(BLOOD_TYPES).toContain(r.best);
      expect(r.match.length).toBeGreaterThan(5);
      expect(bloodToday(t, me, D, 'p1')).toEqual(r);
    }
  });
});

describe('타로', () => {
  it('78장, 오늘 3장은 서로 다르고 같은 날 같은 카드', () => {
    expect(TAROT_DECK).toHaveLength(78);
    const a = tarotDraw(D, 'p1');
    expect(new Set(a.map((x) => x.card.id)).size).toBe(3);
    expect(tarotDraw(D, 'p1')).toEqual(a);
    expect(tarotSide(a[0]).message).toHaveLength(2);
  });
});

describe('꿈 해몽', () => {
  it('300개 이상, 8분류', () => {
    expect(DREAMS.length).toBeGreaterThanOrEqual(300);
    expect(new Set(DREAMS.map((d) => d.category)).size).toBe(8);
  });
  it('띄어쓰기·동의어·이빨/치아 표기 무시', () => {
    expect(normDream('이빨 빠지는 꿈')).toBe(normDream('이 빠지는꿈'));
    const r = searchDream('치아 빠지는 꿈');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(searchDream('돼지 꿈').hits[0].word).toContain('돼지');
  });
  it('초성 검색', () => {
    expect(searchDream('ㄷㅈ').hits.length).toBeGreaterThan(0);
  });
  it('결과 없으면 가까운 표제어 5개', () => {
    const r = searchDream('우주선 타는 꿈 아닌 무언가');
    if (!r.hits.length) expect(r.near).toHaveLength(5);
  });
});

describe('팩폭·MBTI', () => {
  it('팩폭 카드는 사람마다 고정', () => {
    const a = factbomb(me, 'p1');
    expect(a.title.length).toBeGreaterThan(5);
    expect(a.bombs).toHaveLength(3);
    expect(factbomb(me, 'p1')).toEqual(a);
    expect(a.buddy).toContain('기토'); // 갑 일간의 합 = 기
  });
  it('MBTI 16유형 + 사주 연결', () => {
    expect(MBTI_TYPES).toHaveLength(16);
    const r = mbtiResult('INFP', me)!;
    expect(r.element).toBe('wood');
    expect(r.saju.length).toBeGreaterThan(5);
  });
});

describe('v3 타로 스프레드 · 스몰사주 · 한줄사주', () => {
  it('스프레드: 같은 주문 = 같은 카드, 켈틱 10장 중복 없음', () => {
    const a = tarotSpread('ord1:tarot_celtic', 10);
    expect(a).toHaveLength(10);
    expect(new Set(a.map((c) => c.card.id)).size).toBe(10);
    expect(tarotSpread('ord1:tarot_celtic', 10)).toEqual(a);
    expect(tarotSpread('ord2:tarot_celtic', 10)).not.toEqual(a);
  });
  it('스몰사주: 사람 고정 + 문구 채움', () => {
    const s = smallSaju(me, 'p1', D);
    expect(s.name).toContain('(');
    expect(s.lines).toHaveLength(3);
    expect(s.strongLine && s.weakLine && s.tip).toBeTruthy();
    expect(smallSaju(me, 'p1', new Date('2026-10-01T03:00:00Z')).strongLine).toBe(s.strongLine);
  });
  it('한줄사주: 십신 10종 모두 문구', () => {
    const r = oneLineSaju(me, 'p1', D);
    expect(r.line).toMatch(/요[.!]?$/);
    for (let i = 0; i < 10; i++) expect(oneLineSaju(me, 'p1', new Date(D.getTime() + i * 86400000)).line).toBeTruthy();
  });
});
