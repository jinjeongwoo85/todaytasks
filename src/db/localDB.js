import Dexie from 'dexie';
import { byPosition } from '../utils/taskModel';

export const db = new Dexie('TodayTasksDB');

db.version(1).stores({
  taskLists: 'id',
  tasks: 'id, _listId, _parentId',
});

db.version(2).stores({
  taskLists: 'id',
  tasks: 'id, _listId, _parentId',
  pendingOps: '++id, createdAt',
});

export async function saveTasksToDb(listId, tasks) {
  const flat = [];
  for (const t of tasks) {
    flat.push({
      id: t.id, _listId: listId, _parentId: null,
      text: t.text, done: t.done, dueDate: t.dueDate, date: t.date, time: t.time ?? null, notes: t.notes,
      _position: t._position ?? '',
    });
    for (const s of t.subtasks) {
      flat.push({
        id: s.id, _listId: listId, _parentId: t.id,
        // 하위 할일의 날짜/노트 보존 (기존엔 null/''로 버렸음 — 버그 B 데이터 모델 측면)
        text: s.text, done: s.done, dueDate: s.dueDate ?? null, date: null, notes: s.notes ?? '',
        _position: s._position ?? '',
      });
    }
  }
  await db.taskLists.put({ id: listId });
  await db.tasks.where('_listId').equals(listId).delete();
  await db.tasks.bulkPut(flat);
}

export async function loadTasksFromDb() {
  const lists = await db.taskLists.toArray();
  if (lists.length === 0) return { listId: null, tasks: [] };
  const listId = lists[0].id;

  const all = await db.tasks.where('_listId').equals(listId).toArray();
  // Dexie toArray()는 id순이라 순서 미보존 → Google position(사전식 문자열)으로 정렬(taskModel.byPosition 공용).
  const parents = all.filter((t) => !t._parentId).sort(byPosition);
  const children = all.filter((t) => t._parentId).sort(byPosition);

  const tasks = parents.map((p) => ({
    id: p.id, text: p.text, done: p.done,
    dueDate: p.dueDate, date: p.date, time: p.time ?? null, notes: p.notes,
    expanded: false, _listId: listId, _parentId: null, _position: p._position ?? '',
    subtasks: children
      .filter((c) => c._parentId === p.id)
      .map((c) => ({ id: c.id, text: c.text, done: c.done, dueDate: c.dueDate ?? null, notes: c.notes ?? '', _position: c._position ?? '' })),
  }));

  return { listId, tasks };
}
