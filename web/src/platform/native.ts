// 앱(Capacitor) 전용 기능 — 상태바·스플래시·뒤로가기/종료 팝업·AdMob 배너·푸시·이미지 저장/공유.
// 웹에서는 아무것도 불러오지 않는다(플러그인은 앱일 때만 동적 import).
import { apiAuth, isNativeApp, loadGooglePlay } from './payments';

const TEST_BANNER = 'ca-app-pub-3940256099942544/6300978111'; // 구글 공식 테스트 배너 ID(운영 ID 는 VITE 빌드 변수 ADMOB_BANNER_ID)
const BANNER_ID = (import.meta.env.VITE_ADMOB_BANNER_ID as string | undefined) || TEST_BANNER;

let started = false;
export async function initNative(nav: (to: string) => void) {
  if (!isNativeApp() || started) return;
  started = true;
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([import('@capacitor/app'), import('@capacitor/status-bar'), import('@capacitor/splash-screen')]);
  StatusBar.setBackgroundColor({ color: '#F5EFE1' }).catch(() => {});
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  SplashScreen.hide().catch(() => {});
  void loadGooglePlay();
  // 뒤로가기: 들어온 화면이 있으면 뒤로, 홈이면 종료 팝업
  App.addListener('backButton', ({ canGoBack }) => {
    const home = location.pathname === '/' || location.pathname === '';
    if (!home && canGoBack) history.back();
    else if (!home) nav('/');
    else window.dispatchEvent(new CustomEvent('naman:exit'));
  });
  // 알림을 눌러 들어오면 해당 화면으로
  import('@capacitor/push-notifications').then(({ PushNotifications }) => {
    PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const link = (a.notification.data as any)?.link;
      if (typeof link === 'string' && link.startsWith('/')) nav(link);
    });
  }).catch(() => {});
  import('@capacitor-community/admob').then(({ AdMob }) => AdMob.initialize({ initializeForTesting: BANNER_ID === TEST_BANNER })).catch(() => {});
}
export async function exitApp() {
  if (!isNativeApp()) return;
  const { App } = await import('@capacitor/app');
  App.exitApp();
}

/* ---------- AdMob 배너: 하단 탭 바로 위에 띄움. 화면을 떠나면 숨김 ---------- */
let bannerUsers = 0;
export async function showBanner() {
  if (!isNativeApp()) return;
  bannerUsers++;
  const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob');
  const tabbar = 82; // --tabbar-h
  await AdMob.showBanner({ adId: BANNER_ID, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin: tabbar, isTesting: BANNER_ID === TEST_BANNER }).catch(() => {});
}
export async function hideBanner() {
  if (!isNativeApp()) return;
  bannerUsers = Math.max(0, bannerUsers - 1);
  if (bannerUsers > 0) return;
  const { AdMob } = await import('@capacitor-community/admob');
  await AdMob.hideBanner().catch(() => {});
}

/* ---------- 푸시: 오늘의 운세를 본 뒤 사용자가 "알림 받기"를 누르면 그때 권한 요청 ---------- */
export async function enablePush(time = '07:00'): Promise<'granted' | 'denied' | 'web'> {
  if (!isNativeApp()) return 'web';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let p = await PushNotifications.checkPermissions();
  if (p.receive !== 'granted') p = await PushNotifications.requestPermissions();
  if (p.receive !== 'granted') return 'denied';
  await PushNotifications.createChannel({ id: 'daily', name: '오늘의 운세 알림', importance: 4 }).catch(() => {});
  await new Promise<void>((resolve) => {
    PushNotifications.addListener('registration', async (t) => { await apiAuth('/me/push', { method: 'POST', body: JSON.stringify({ token: t.value, consent: true, time }) }).catch(() => {}); resolve(); });
    PushNotifications.addListener('registrationError', () => resolve()); // google-services.json 없으면 여기로
    PushNotifications.register();
    setTimeout(resolve, 8000);
  });
  return 'granted';
}

/* ---------- 결과 카드 이미지: 앱에서는 사진첩(Documents) 저장 + 공유 시트 ---------- */
export async function saveImageNative(dataUrl: string, filename: string): Promise<boolean> {
  if (!isNativeApp()) return false;
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const name = filename.replace(/[^\w가-힣.-]+/g, '_');
  const r = await Filesystem.writeFile({ path: name, data: dataUrl.split(',')[1], directory: Directory.Cache });
  await Share.share({ title: '나만의 운세', files: [r.uri] }).catch(() => {});
  return true;
}
