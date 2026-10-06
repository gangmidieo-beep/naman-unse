// 나만의 운세 앱 설정. appId 는 스토어 첫 업로드 후 바꿀 수 없음(결정필요 D7) — 확정 전 임시값.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: process.env.APP_ID || 'com.namanunse.app',
  appName: '나만의 운세',
  webDir: '../web/dist', // 번들된 정적 파일로 동작(서버 주소를 불러오는 방식 아님)
  android: { path: 'android', backgroundColor: '#F5EFE1' },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#F5EFE1', showSpinner: false, androidScaleType: 'CENTER_CROP' },
    StatusBar: { backgroundColor: '#F5EFE1', style: 'LIGHT', overlaysWebView: false },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};
export default config;
