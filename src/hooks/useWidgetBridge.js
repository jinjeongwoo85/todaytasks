// 네이티브 홈 위젯 ↔ 앱 양방향 브리지를 한 곳에 모은다(웹은 모든 경로가 no-op).
//  1) handleSync   — 설정 "지금 동기화": refresh() 후 위젯 스냅샷 즉시 갱신.
//  2) 디바운스 effect — tasks/isSignedIn 변경 시 1.5s 디바운스로 위젯 스냅샷 갱신
//     (tasks가 단일 출처라 추가/완료/수정/삭제/하위/순서 등 모든 변경이 여기로 모인다).
//  3) consumeWidgetRoute — 위젯 탭이 Preferences('tt_widget_route')에 적어둔 라우팅을 읽고
//     화면 전환 후 삭제. 콜드 스타트(mount) + 이미 떠 있을 때(resume) 모두 처리.
// 화면 전환은 App이 주입한 콜백(openDetail/openWidgetAdd/goToday)에 위임 — ref로 최신화해
// resume 리스너는 마운트 시 1회만 등록(stale closure 방지).
import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { TodaySnapshot } from '../native/todaySnapshot';

export function useWidgetBridge({ tasks, isSignedIn, refresh, openDetail, openWidgetAdd, goToday }) {
  // 데이터 동기화 + (네이티브) 위젯 스냅샷 갱신. 설정의 "지금 동기화" 버튼용.
  const handleSync = async () => {
    await refresh();
    if (Capacitor.isNativePlatform()) {
      try {
        const r = await TodaySnapshot.refreshTodaySnapshot();
        console.log('[TodaySnapshot] count=', r?.count, r?.snapshot);
      } catch (e) {
        console.warn('[TodaySnapshot] failed', e);
      }
    }
  };

  // 트리거① — 앱 내 변경 시 위젯 스냅샷 즉시(디바운스) 갱신.
  // 디바운스 1.5s: 연속 편집 폭주 방지 + 직전 API 변경이 서버에 반영될 여유. (네이티브에서만, 로그인 후.)
  const snapshotTimer = useRef(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isSignedIn) return;
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => {
      TodaySnapshot.refreshTodaySnapshot().catch(() => {});
    }, 1500);
    return () => { if (snapshotTimer.current) clearTimeout(snapshotTimer.current); };
  }, [tasks, isSignedIn]);

  // 라우팅 콜백을 ref로 최신화 → consumeWidgetRoute를 안정 식별자로 유지(resume 리스너 1회 등록).
  const routeRef = useRef({ openDetail, openWidgetAdd, goToday });
  routeRef.current = { openDetail, openWidgetAdd, goToday };

  const consumeWidgetRoute = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: 'tt_widget_route' });
    if (!value) return;
    await Preferences.remove({ key: 'tt_widget_route' });
    let r;
    try { r = JSON.parse(value); } catch { return; }
    if (!r?.route) return;
    const { openDetail, openWidgetAdd, goToday } = routeRef.current;
    if (r.route === 'detail' && r.taskId) {
      openDetail(r.taskId); // tasks 로드 후 모달이 열림
    } else if (r.route === 'add') {
      openWidgetAdd();
    } else { // 'today'
      goToday();
    }
  }, []);

  useEffect(() => {
    consumeWidgetRoute(); // mount
    let remove;
    (async () => {
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('resume', () => { consumeWidgetRoute(); });
      remove = () => handle.remove();
    })();
    return () => { if (remove) remove(); };
  }, [consumeWidgetRoute]);

  return { handleSync };
}
