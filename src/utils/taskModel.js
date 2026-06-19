// 작업 데이터 모델 + 로컬↔Google Tasks 매핑 (단일 출처).
//
// 왜 이 파일이 있나:
//  - 기존에는 매핑이 흩어져 있었다: useTasks의 gToLocal, addTask의 body 직접 작성,
//    updateTask의 gPatch 인라인 조립 등. 필드 하나 추가하려면 여러 곳을 고쳐야 했다.
//  - 여기로 모으면 새 필드(time/recurrence 등)는 매퍼 한 곳만 고치면 된다.
//  - 데이터/동기화 층을 렌더에서 분리 → 향후 안드로이드 앱·위젯 포팅 시 모델 재사용.
//
// Google Tasks 공개 API의 한계(중요):
//  - `due`는 RFC3339 datetime을 받지만 Google이 "날짜 단위"로 절삭한다. 시각(time)은 무시됨.
//  - 반복(recurrence) 일정은 공개 API로 생성/수정 불가(구글 UI 전용).
//  - "시작날짜(date)"·"시각(time)"에 해당하는 필드가 Google에 없다.
//  대응: 종료일(dueDate)만 `due`에 네이티브로 저장하고, 시작일(date)·시각(time)은
//  notes(세부정보) 끝줄에 ⟦tt …⟧ 마커로 끼워 저장한다(taskNotes.js). 읽을 때 다시 분리.
//  → 폰↔태블릿 등 기기 간에도 동기화된다(notes는 실제 동기화 필드).

// ── 작업 객체의 표준 형태 (참고용 문서) ───────────────────────────────
// Task = {
//   id: string,
//   text: string,
//   done: boolean,
//   dueDate: 'YYYY-MM-DD' | null,   // 종료일(기본) — Google `due`(날짜 단위)에 네이티브 저장
//   date:   'YYYY-MM-DD' | null,    // 시작일 — notes 마커에 저장
//   time:   'HH:mm' | null,         // 시각(종료일의 시간) — notes 마커에 저장
//   notes:  string,                 // 마커 제거된 깨끗한 메모(앱·DB는 항상 이 형태로 보관)
//   // 예약(미구현, 형태만): recurrence: RRULE 문자열 | null
//   expanded: boolean,              // UI 전용
//   subtasks: Subtask[],
//   _listId: string,
//   _parentId: string | null,
// }
// Subtask = { id, text, done, dueDate, notes }  // 상위와 동일 필드 집합(날짜/노트 보존)
// ──────────────────────────────────────────────────────────────────

import { encodeNotes, decodeNotes } from './taskNotes';

// 'YYYY-MM-DD' → Google `due`용 RFC3339 (자정 UTC). 없으면 undefined.
export const dueParam = (iso) => (iso ? `${iso}T00:00:00.000Z` : undefined);

// Google `due` 문자열 → 'YYYY-MM-DD'
const dueToIso = (due) => (due ? due.split('T')[0] : null);

// Google task → 로컬 상위 작업 형태(subtasks는 호출부에서 트리 조립).
export function googleToTask(g, listId) {
  const { notes, date, time } = decodeNotes(g.notes || ''); // 시작일·시각·깨끗한 메모 분리
  return {
    id: g.id,
    text: g.title || '',
    done: g.status === 'completed',
    dueDate: dueToIso(g.due),   // 종료일 = Google due(네이티브)
    date,                       // 시작일 = notes 마커에서 복원
    time,                       // 시각  = notes 마커에서 복원
    notes,
    expanded: false,
    subtasks: [],
    _listId: listId,
    _parentId: g.parent || null,
  };
}

// Google task(자식) → 로컬 하위 작업 형태. 기존엔 {id,text,done}만 남겨 due/notes를 버렸으나
// 여기서 보존한다(버그 B 대응의 데이터 모델 측면).
export function googleToSubtask(g) {
  return {
    id: g.id,
    text: g.title || '',
    done: g.status === 'completed',
    dueDate: dueToIso(g.due),
    notes: g.notes || '',
  };
}

// 로컬 작업/하위작업 → Google createTask body.
// parent는 body가 아니라 쿼리 파라미터로 보내야 하므로 여기 포함하지 않는다(2단계에서 처리).
export function taskToGoogleBody(task) {
  const body = {
    title: task.text || '',
    status: task.done ? 'completed' : 'needsAction',
  };
  if (task.dueDate) body.due = dueParam(task.dueDate);
  const notes = encodeNotes(task.notes || '', { date: task.date, time: task.time }); // 시작일·시각 마커 부착
  if (notes) body.notes = notes;
  return body;
}

// 로컬 patch(부분 업데이트) → Google patchTask body.
// 주의: notes엔 시작일·시각이 함께 인코딩되므로, notes/date/time 중 하나만 바뀌어도
// "병합된 최신 상태"로 재인코딩해야 나머지 값이 유실되지 않는다. 그래서 이 함수에 넘기는 patch는
// 반드시 {notes,date,time}이 모두 채워진(병합된) 것이어야 한다. 실제 병합은 useTasks.updateTask가 한다.
export function patchToGoogleBody(patch) {
  const g = {};
  if ('text' in patch) g.title = patch.text;
  if ('done' in patch) g.status = patch.done ? 'completed' : 'needsAction';
  if ('dueDate' in patch) g.due = dueParam(patch.dueDate) ?? null;
  if ('notes' in patch || 'date' in patch || 'time' in patch) {
    g.notes = encodeNotes(patch.notes || '', { date: patch.date, time: patch.time });
  }
  return g;
}
