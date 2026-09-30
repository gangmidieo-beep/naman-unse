import { describe, it, expect } from 'vitest';
import { adProvider } from './ads';

describe('광고 플랫폼 분기', () => {
  it('프리미엄은 앱·웹 모두 광고 0', () => {
    expect(adProvider({ premium: true, native: true, adsenseClient: 'ca-pub-1' })).toBe('none');
    expect(adProvider({ premium: true, native: false, adsenseClient: 'ca-pub-1' })).toBe('none');
  });
  it('앱(Capacitor)에서는 애드센스 ID 가 있어도 AdMob', () => {
    expect(adProvider({ premium: false, native: true, adsenseClient: 'ca-pub-1' })).toBe('admob');
  });
  it('웹은 애드센스 ID 가 있을 때만 애드센스', () => {
    expect(adProvider({ premium: false, native: false, adsenseClient: 'ca-pub-1' })).toBe('adsense');
    expect(adProvider({ premium: false, native: false, adsenseClient: '' })).toBe('placeholder');
  });
});
