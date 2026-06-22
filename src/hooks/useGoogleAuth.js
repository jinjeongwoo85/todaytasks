import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { GoogleAuthNative } from '../native/googleAuthNative';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/tasks';
const STORAGE_KEY = 'tt_auth';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55분 (구글 토큰 유효시간 60분보다 5분 여유)
const REFRESH_AT_MS = 50 * 60 * 1000; // 발급 50분 뒤 조용히 자동 갱신(만료 전) → 로그인 유지

// 네이티브(Capacitor) 앱이면 GIS 웹 로그인 대신 네이티브 플러그인으로 토큰을 발급한다.
// (WebView는 file:// 출처라 GIS가 초기화되지 않음 + 1시간 만료/리프레시 없음 → 네이티브로 영구 로그인)
const IS_NATIVE = Capacitor.isNativePlatform();

// 저장된 토큰 { token, savedAt } (만료 지났으면 제거 후 null)
function getStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > TOKEN_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
const loadStoredToken = () => getStored()?.token ?? null;

function saveToken(token) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, savedAt: Date.now() }));
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useGoogleAuth() {
  const [accessToken, setAccessToken] = useState(() => loadStoredToken());
  const [isReady, setIsReady] = useState(IS_NATIVE); // 네이티브는 GIS 로드 대기 불필요 → 바로 준비됨
  const [isSilentTrying, setIsSilentTrying] = useState(!loadStoredToken());
  const tokenClientRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // 네이티브 토큰 발급 결과를 상태에 반영(저장 + 다음 갱신 예약). scheduleRefresh보다 먼저 선언.
  const applyToken = useCallback((token) => {
    setAccessToken(token);
    saveToken(token);
  }, []);

  // 자동 갱신 예약 — savedAt 기준 REFRESH_AT_MS 뒤에 조용히 새 토큰 발급.
  // 구글 세션이 살아있으면 화면 없이 갱신되어 "1시간마다 재로그인"이 사라진다.
  const scheduleRefresh = useCallback((savedAt) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(savedAt + REFRESH_AT_MS - Date.now(), 2000);
    refreshTimerRef.current = setTimeout(() => {
      if (IS_NATIVE) {
        GoogleAuthNative.getAccessToken({ silent: true })
          .then((r) => { if (r?.accessToken) { applyToken(r.accessToken); scheduleRefresh(Date.now()); } })
          .catch(() => {});
      } else {
        tokenClientRef.current?.requestAccessToken({ prompt: 'none' });
      }
    }, delay);
  }, [applyToken]);

  // ===== 네이티브 경로: 마운트 시 조용한 자동 로그인 시도 =====
  useEffect(() => {
    if (!IS_NATIVE) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await GoogleAuthNative.getAccessToken({ silent: true });
        if (!cancelled && r?.accessToken) {
          applyToken(r.accessToken);
          scheduleRefresh(Date.now());
        }
      } catch {
        // 자동 로그인 실패(계정/동의 없음) → 로그인 화면 표시
      } finally {
        if (!cancelled) setIsSilentTrying(false);
      }
    })();
    return () => { cancelled = true; if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [applyToken, scheduleRefresh]);

  // ===== 웹(GIS) 경로 (기존 동작 그대로) =====
  // GIS 초기화(마운트 1회): tokenClient 1회 생성 + 저장 토큰 없으면 조용한 로그인 시도 +
  // 토큰이 있으면 만료 전 자동 갱신 예약.
  useEffect(() => {
    if (IS_NATIVE) return;
    const needSilent = !accessToken;
    const deadline = Date.now() + 5000; // GIS 로드 최대 5초 대기
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        if (!tokenClientRef.current) {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
              if (response.access_token) {
                setAccessToken(response.access_token);
                saveToken(response.access_token);
                scheduleRefresh(Date.now()); // 다음 갱신 재예약
              }
              setIsSilentTrying(false);
            },
            error_callback: () => setIsSilentTrying(false),
          });
        }
        setIsReady(true);
        if (needSilent) {
          tokenClientRef.current.requestAccessToken({ prompt: 'none' });
        } else {
          setIsSilentTrying(false);
          const stored = getStored(); // 캐시 토큰 기준으로 만료 전 갱신 예약
          if (stored) scheduleRefresh(stored.savedAt);
        }
      } else if (Date.now() < deadline) {
        setTimeout(check, 100);
      } else {
        setIsSilentTrying(false); // GIS 로드 실패 → 로그인 화면 표시
      }
    };
    check();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(() => {
    if (IS_NATIVE) {
      GoogleAuthNative.getAccessToken({ silent: false })
        .then((r) => { if (r?.accessToken) { applyToken(r.accessToken); scheduleRefresh(Date.now()); } })
        .catch(() => {});
    } else {
      tokenClientRef.current?.requestAccessToken({ prompt: 'select_account' });
    }
  }, [applyToken, scheduleRefresh]);

  const signOut = useCallback(() => {
    if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }
    if (IS_NATIVE) {
      GoogleAuthNative.signOut().catch(() => {});
    } else if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearToken();
    setAccessToken(null);
  }, [accessToken]);

  return { accessToken, isSignedIn: !!accessToken, signIn, signOut, isReady, isSilentTrying };
}
