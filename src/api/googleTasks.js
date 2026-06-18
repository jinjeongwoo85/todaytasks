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

export async function createTask(token, listId, body) {
  const res = await fetch(`${BASE}/lists/${listId}/tasks`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify(body),
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
