const BASE = 'https://tasks.googleapis.com/tasks/v1';

const h = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

// HTTP 오류를 던진다 — 조용히 삼키면 실패한 오프라인 op가 큐에서 지워져 영구 유실/desync된다(버그 2).
// 던지면 flushPendingOps가 그 op를 큐에 남겨 다음 동기화에 재시도한다.
async function jsonOrThrow(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTaskLists(token) {
  const res = await fetch(`${BASE}/users/@me/lists`, { headers: h(token) });
  const data = await jsonOrThrow(res);
  return data.items || [];
}

export async function fetchTasks(token, listId) {
  const res = await fetch(
    `${BASE}/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
    { headers: h(token) }
  );
  const data = await jsonOrThrow(res);
  return data.items || [];
}

// parent/previous는 반드시 쿼리 파라미터로 보내야 한다.
// Google Tasks `tasks.insert`는 body의 parent를 무시하므로, body에 넣으면 하위 할일이
// 부모 밑에 중첩되지 않고 최상위로 생성된다(버그 B의 원인).
export async function createTask(token, listId, body, { parent, previous } = {}) {
  const params = new URLSearchParams();
  if (parent) params.set('parent', parent);
  if (previous) params.set('previous', previous);
  const qs = params.toString();
  const res = await fetch(`${BASE}/lists/${listId}/tasks${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

// 할일을 형제 목록 내에서 이동(순서 변경). parent/previous는 쿼리 파라미터로 전달.
// previous 없으면 형제 중 맨 위로, 있으면 그 형제 바로 뒤로 위치(=서버 position 갱신).
export async function moveTask(token, listId, taskId, { parent, previous } = {}) {
  const params = new URLSearchParams();
  if (parent) params.set('parent', parent);
  if (previous) params.set('previous', previous);
  const qs = params.toString();
  const res = await fetch(`${BASE}/lists/${listId}/tasks/${taskId}/move${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: h(token),
  });
  return jsonOrThrow(res);
}

export async function patchTask(token, listId, taskId, body) {
  const res = await fetch(`${BASE}/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

export async function deleteTask(token, listId, taskId) {
  const res = await fetch(`${BASE}/lists/${listId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: h(token),
  });
  // 이미 없는 항목(404/410)은 삭제 성공과 동일하게 취급(idempotent) — 큐가 막히지 않게.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`HTTP ${res.status}`);
  }
}
