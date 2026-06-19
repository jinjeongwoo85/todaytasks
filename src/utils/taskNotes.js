// 시작일·시각을 Google Tasks의 notes(세부정보) 안에 숨겨 저장하기 위한 마커 인코딩/디코딩.
//
// 왜 필요한가:
//  - Google Tasks 공개 API엔 "시작일"·"시각" 필드가 없다. `due`는 날짜 단위(시각은 버려짐).
//  - 그래서 종료일만 `due`에 네이티브로 저장하고, 시작일·시각은 notes 끝줄에 ⟦tt …⟧ 마커로
//    끼워 넣은 뒤, 앱에서 읽을 때 다시 분리한다.
//
// 안전 원칙(중요):
//  - 디코드는 "관대하게" 동작한다 — 마커가 깨져 있어도 사용자 메모는 절대 버리지 않는다.
//  - 넣을 값(시작일·시각)이 하나도 없으면 마커를 아예 만들지 않는다 → 메모만 남고 흔적 없음.
//  - ⟦ ⟧(U+27E6/27E7)는 일반 입력에 거의 안 쓰이는 문자라 사용자 메모와 충돌 가능성이 매우 낮다.

// notes 끝에 붙은 마커 한 개(앞쪽 공백/줄바꿈 포함). 끝(`$`)에 고정해 본문 중간은 건드리지 않는다.
const MARKER_RE = /\n*⟦tt[^⟧]*⟧[ \t]*$/;

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// 깨끗한 메모 + { date(시작일), time(시각) } → Google notes 문자열.
// 시작일·시각이 둘 다 없으면 마커 없이 메모만 반환.
export function encodeNotes(cleanNotes, { date = null, time = null } = {}) {
  // 들어온 메모에 혹시 이전 마커가 남아 있으면 먼저 제거(중복 부착 방지).
  const clean = (cleanNotes || '').replace(MARKER_RE, '');

  const parts = [];
  if (date && isDate(date)) parts.push(`start=${date}`);
  if (time && isTime(time)) parts.push(`time=${time}`);
  if (parts.length === 0) return clean; // 넣을 값 없음 → 메모 원본 그대로(흔적 없음)

  const marker = `⟦tt ${parts.join(' ')}⟧`;
  const trimmed = clean.replace(/[ \t\n]+$/, ''); // 마커 앞 꼬리 공백 정리
  return trimmed ? `${trimmed}\n${marker}` : marker;
}

// Google notes 문자열 → { notes(깨끗한 메모), date(시작일|null), time(시각|null) }.
export function decodeNotes(raw) {
  const s = raw || '';
  const m = s.match(MARKER_RE);
  if (!m) return { notes: s, date: null, time: null };

  const seg = m[0];
  const sd = seg.match(/start=(\d{4}-\d{2}-\d{2})/);
  const tm = seg.match(/time=(([01]\d|2[0-3]):[0-5]\d)/);
  const date = sd && isDate(sd[1]) ? sd[1] : null;
  const time = tm && isTime(tm[1]) ? tm[1] : null;

  return { notes: s.replace(MARKER_RE, ''), date, time };
}
