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

// iso(또는 미지정 시 오늘)가 속한 달의 1일 Date — 달력 월 네비게이션 초기값에 사용
export const monthStartOf = (iso) => {
  const d = iso ? isoToDate(iso) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

// 6.16(화)
export const formatDate = (iso) => {
  const d = isoToDate(iso);
  return `${d.getMonth() + 1}.${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
};

// 2026.6.16(화) — 연도 포함(검색 기간 표시용)
export const formatDateY = (iso) => {
  const d = isoToDate(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
};

// 6.16
export const formatShort = (iso) => {
  const d = isoToDate(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

// 'HH:mm'(24시간) 그대로 표시. 시각은 종료일에 종속되는 로컬 표시값(Google엔 notes 마커로만 저장).
export const formatTime = (hhmm) => hhmm || '';

// dueDate가 과거/오늘/미래/없음인지. today는 매 호출 재계산(기본값)이라 자정 경계에도 정확.
export const dateTone = (iso, today = todayISO()) => {
  if (!iso) return 'none';
  if (iso < today) return 'overdue';
  if (iso === today) return 'today';
  return 'future';
};

// 톤 키 → 색상 객체
export const toneStyle = (iso, today = todayISO()) => TONE[dateTone(iso, today)];

// 할일이 특정 날짜에 표시되는가. 시작~종료 범위가 있으면 그 사이 모든 날, 없으면 종료일 당일.
// 종료일이 없고 시작일만 있는 예외 상태에선 시작일 당일에 표시(날짜 화면에서 사라지는 것 방지).
// 날짜가 전혀 없으면(미설정) 모든 날짜에 표시 — 날짜 뷰/위젯에서 숨겨지지 않게.
export const isTaskOnDate = (t, iso) => {
  if (t.date && t.dueDate && t.date <= t.dueDate) {
    return iso >= t.date && iso <= t.dueDate;
  }
  if (!t.dueDate && !t.date) return true;
  return (t.dueDate || t.date) === iso;
};

// 행에 표시할 날짜 라벨(기본 날짜 = 종료일 기준). 기간은 시작일을 '~'로 대체.
// 시각은 있으면 항상 뒤에 붙인다(기간/단일 공통). 종료일=오늘인 경우만 요일 없이 '오늘'.
//  - 기간(시작≠종료): '~종료일(요일)' (종료일=오늘이면 '~오늘').  예) ~6.19(목) / ~6.20(토) 18:00 / ~오늘 18:00
//  - 단일 + 종료일=오늘: '오늘'.                                 예) 오늘 / 오늘 18:00
//  - 단일 + 종료일≠오늘: '6.22(화)'.                            예) 6.22(화) / 6.22(화) 18:00
//  - 날짜 미설정(종료·시작 둘 다 없음): '—'(em-dash) — 날짜 칸을 비워두지 않고 표시
//  - 시작일만 있고 종료일 없는 예외 상태: null
export const rowDateLabel = (t, today = todayISO()) => {
  const end = t.dueDate;
  if (!end) return t.date ? null : '—';
  const isRange = t.date && t.date !== end && t.date <= end;
  const time = t.time ? ` ${formatTime(t.time)}` : '';
  if (isRange) {
    const endLabel = end === today ? '오늘' : formatDate(end);
    return `~${endLabel}${time}`;
  }
  if (end === today) return `오늘${time}`;
  return `${formatDate(end)}${time}`;
};
