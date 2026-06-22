// 네이티브 Google 로그인 플러그인(GoogleAuthPlugin.java) JS 브리지.
// 메서드: getAccessToken({ silent }) → { accessToken }, signOut() → void.
// 웹(브라우저)에선 호출되지 않음 — useGoogleAuth가 Capacitor.isNativePlatform()로 분기.
import { registerPlugin } from '@capacitor/core';

export const GoogleAuthNative = registerPlugin('GoogleAuth');
