import { useState, useEffect, useRef, useCallback } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/tasks';
const STORAGE_KEY = 'tt_auth';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55분 (구글 토큰 유효시간 60분보다 5분 여유)
const REFRESH_AT_MS = 50 * 60 * 1000; // 발급 50분 뒤 조용히 자동 갱신(만료 전) → 로그인 유지

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
  const [isReady, setIsReady] = useState(false);
  const [isSilentTrying, setIsSilentTrying] = useState(!loadStoredToken());
  const tokenClientRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // 자동 갱신 예약 — savedAt 기준 REFRESH_AT_MS 뒤에 조용히(prompt:none) 새 토큰 발급.
  // 구글 세션이 살아있으면 팝업 없이 갱신되어 "1시간마다 재로그인"이 사라진다.
  const scheduleRefresh = useCallback((savedAt) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = Math.max(savedAt + REFRESH_AT_MS - Date.now(), 2000);
    refreshTimerRef.current = setTimeout(() => {
      tokenClientRef.current?.requestAccessToken({ prompt: 'none' });
    }, delay);
  }, []);

  // GIS 초기화(마운트 1회): tokenClient 1회 생성 + 저장 토큰 없으면 조용한 로그인 시도 +
  // 토큰이 있으면 만료 전 자동 갱신 예약.
  useEffect(() => {
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
    tokenClientRef.current?.requestAccessToken({ prompt: 'select_account' });
  }, []);

  const signOut = useCallback(() => {
    if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearToken();
    setAccessToken(null);
  }, [accessToken]);

  return { accessToken, isSignedIn: !!accessToken, signIn, signOut, isReady, isSilentTrying };
}
