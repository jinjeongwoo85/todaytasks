const BASE = 'https://tasks.googleapis.com/tasks/v1';

const h = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export async function fetchTaskLists(token) {
  const res = await fetch(`${BASE}/users/@me/lists`, { headers: h(token) });
  const data = await res.json();
  return data.items || [];
}

export async function fetchTasks(token, listId) {
  const res = await fetch(
    `${BASE}/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
    { headers: h(token) }
  );
  const data = await res.json();
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
  return res.json();
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
  return res.json();
}

export async function patchTask(token, listId, taskId, body) {
  const res = await fetch(`${BASE}/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteTask(token, listId, taskId) {
  await fetch(`${BASE}/lists/${listId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: h(token),
  });
}
