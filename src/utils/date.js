// 날짜 유틸 — 기존 TodayTasks.jsx 최상단에 있던 함수들을 이동.
//
// 핵심 수정: 기존에는 모듈 로드 시점에 TODAY_ISO/TOMORROW_ISO를 1회 계산해 상수로 박아두어,
// 앱을 자정 넘겨 켜두면 "오늘"이 어제로 고정되는 버그가 있었다. 여기서는 todayISO()/tomorrowISO()
// 함수로 바꿔 호출 시점마다 다시 계산한다. dateTone()도 today를 매 호출 재계산(기본값)한다.

import { TONE } from '../styles/tokens';

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// Date → 'YYYY-MM-DD' (로컬 타임존 기준)
export const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 호출 시점의 오늘/내일 ISO (모듈 상수 아님 — 자정 stale 방지)
export const todayISO = () => toISO(new Date());
export const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISO(d);
};

// 'YYYY-MM-DD' → Date (로컬 자정)
export const isoToDate = (iso) => new Date(iso + 'T00:00:00');

// 6.16(화)
export const formatDate = (iso) => {
  const d = isoToDate(iso);
  return `${d.getMonth() + 1}.${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
};

// 6.16
export const formatShort = (iso) => {
  const d = isoToDate(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

// dueDate가 과거/오늘/미래/없음인지. today는 매 호출 재계산(기본값)이라 자정 경계에도 정확.
export const dateTone = (iso, today = todayISO()) => {
  if (!iso) return 'none';
  if (iso < today) return 'overdue';
  if (iso === today) return 'today';
  return 'future';
};

// 톤 키 → 색상 객체
export const toneStyle = (iso, today = todayISO()) => TONE[dateTone(iso, today)];

// 할일이 특정 날짜에 표시되는가. 시작~종료 범위가 있으면 그 사이 모든 날, 없으면 dueDate 당일.
export const isTaskOnDate = (t, iso) => {
  if (t.date && t.dueDate && t.date <= t.dueDate) {
    return iso >= t.date && iso <= t.dueDate;
  }
  return t.dueDate === iso;
};

// 행에 표시할 날짜 라벨. 범위면 '6.16~6.20', 단일이면 '6.16(화)', 없으면 null.
export const rowDateLabel = (t) => {
  if (t.date && t.dueDate && t.date <= t.dueDate && t.date !== t.dueDate) {
    return `${formatShort(t.date)}~${formatShort(t.dueDate)}`;
  }
  return t.dueDate ? formatDate(t.dueDate) : null;
};
