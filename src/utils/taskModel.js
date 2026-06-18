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
//  - "시작날짜(date)"에 해당하는 필드가 Google에 없다 → 로컬 전용으로만 보관.
//  따라서 time/recurrence는 향후 로컬(IndexedDB)·notes 등으로 보관하는 전략이 필요하며,
//  이 모델에 예약 필드로 형태만 미리 잡아둔다.

// ── 작업 객체의 표준 형태 (참고용 문서) ───────────────────────────────
// Task = {
//   id: string,
//   text: string,
//   done: boolean,
//   dueDate: 'YYYY-MM-DD' | null,   // Google `due` (날짜 단위)
//   date:   'YYYY-MM-DD' | null,    // 시작일 — 로컬 전용(Google 미지원)
//   notes:  string,
//   // 예약(미구현, 형태만): time: 'HH:mm' | null, recurrence: RRULE 문자열 | null
//   expanded: boolean,              // UI 전용
//   subtasks: Subtask[],
//   _listId: string,
//   _parentId: string | null,
// }
// Subtask = { id, text, done, dueDate, notes }  // 상위와 동일 필드 집합(날짜/노트 보존)
// ──────────────────────────────────────────────────────────────────

// 'YYYY-MM-DD' → Google `due`용 RFC3339 (자정 UTC). 없으면 undefined.
export const dueParam = (iso) => (iso ? `${iso}T00:00:00.000Z` : undefined);

// Google `due` 문자열 → 'YYYY-MM-DD'
const dueToIso = (due) => (due ? due.split('T')[0] : null);

// Google task → 로컬 상위 작업 형태(subtasks는 호출부에서 트리 조립).
export function googleToTask(g, listId) {
  return {
    id: g.id,
    text: g.title || '',
    done: g.status === 'completed',
    dueDate: dueToIso(g.due),
    date: null,                 // Google엔 시작일 없음 → 로컬 전용
    notes: g.notes || '',
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
  if (task.notes) body.notes = task.notes;
  return body;
}

// 로컬 patch(부분 업데이트) → Google patchTask body.
// 기존 updateTask의 인라인 gPatch 조립 로직과 동일한 규칙.
export function patchToGoogleBody(patch) {
  const g = {};
  if ('text' in patch) g.title = patch.text;
  if ('notes' in patch) g.notes = patch.notes || '';
  if ('done' in patch) g.status = patch.done ? 'completed' : 'needsAction';
  if ('dueDate' in patch) g.due = dueParam(patch.dueDate) ?? null;
  return g;
}
