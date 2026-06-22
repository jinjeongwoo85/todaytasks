// 위젯용 "오늘 할일 스냅샷"을 네이티브에서 생성·저장하는 플러그인(TodaySnapshotPlugin.java) JS 브리지.
// refreshTodaySnapshot() → { count, snapshot(JSON 문자열) }.
// 네이티브에서만 동작 — 호출부에서 Capacitor.isNativePlatform()로 분기할 것.
import { registerPlugin } from '@capacitor/core';

export const TodaySnapshot = registerPlugin('TodaySnapshot');
