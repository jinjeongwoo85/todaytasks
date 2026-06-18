import Dexie from 'dexie';

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
      text: t.text, done: t.done, dueDate: t.dueDate, date: t.date, notes: t.notes,
    });
    for (const s of t.subtasks) {
      flat.push({
        id: s.id, _listId: listId, _parentId: t.id,
        text: s.text, done: s.done, dueDate: null, date: null, notes: '',
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
  const parents = all.filter((t) => !t._parentId);
  const children = all.filter((t) => t._parentId);

  const tasks = parents.map((p) => ({
    id: p.id, text: p.text, done: p.done,
    dueDate: p.dueDate, date: p.date, notes: p.notes,
    expanded: false, _listId: listId, _parentId: null,
    subtasks: children
      .filter((c) => c._parentId === p.id)
      .map((c) => ({ id: c.id, text: c.text, done: c.done })),
  }));

  return { listId, tasks };
}
