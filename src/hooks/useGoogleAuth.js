import { useState, useEffect, useRef, useCallback } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/tasks';
const STORAGE_KEY = 'tt_auth';
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55분 (구글 토큰 유효시간 60분보다 5분 여유)

function loadStoredToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { token, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > TOKEN_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

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

  useEffect(() => {
    if (accessToken) return; // 저장된 토큰이 있으면 GIS 초기화 불필요

    const deadline = Date.now() + 5000; // GIS 로드 최대 5초 대기
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              saveToken(response.access_token);
            }
            setIsSilentTrying(false);
          },
          error_callback: () => {
            setIsSilentTrying(false);
          },
        });
        setIsReady(true);
        tokenClientRef.current.requestAccessToken({ prompt: 'none' });
      } else if (Date.now() < deadline) {
        setTimeout(check, 100);
      } else {
        setIsSilentTrying(false); // GIS 로드 실패 → 로그인 화면 표시
      }
    };
    check();
  }, [accessToken]);

  // 저장된 토큰이 있어도 signIn은 필요할 수 있으므로 별도 초기화
  useEffect(() => {
    const check = () => {
      if (window.google?.accounts?.oauth2 && !tokenClientRef.current) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              saveToken(response.access_token);
            }
          },
        });
        setIsReady(true);
      } else if (!window.google?.accounts?.oauth2) {
        setTimeout(check, 100);
      }
    };
    check();
  }, []);

  const signIn = useCallback(() => {
    tokenClientRef.current?.requestAccessToken({ prompt: 'select_account' });
  }, []);

  const signOut = useCallback(() => {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearToken();
    setAccessToken(null);
  }, [accessToken]);

  return { accessToken, isSignedIn: !!accessToken, signIn, signOut, isReady, isSilentTrying };
}
