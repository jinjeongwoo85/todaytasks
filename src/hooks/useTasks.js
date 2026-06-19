import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/googleTasks';
import { db, saveTasksToDb, loadTasksFromDb } from '../db/localDB';

const newId = () => `opt-${Date.now()}-${Math.random()}`;
const isTemp = (id) => id.startsWith('opt-');

// 새 항목을 형제 목록 맨 끝에 붙이기 위한 `previous`(앞 형제) id.
// Google Tasks는 previous 없이 만들면 맨 위에 저장 → 재로드 시 생성순서가 뒤집힌다.
// 서버에 실제로 존재하는(=temp 아닌) 마지막 항목 id를 반환(없으면 undefined → 맨 위, 첫 항목일 때만 발생).
function lastRealId(items) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (!isTemp(items[i].id)) return items[i].id;
  }
  return undefined;
}

function gToLocal(gTask, listId) {
  return {
    id: gTask.id,
    text: gTask.title || '',
    done: gTask.status === 'completed',
    dueDate: gTask.due ? gTask.due.split('T')[0] : null,
    date: null,
    notes: gTask.notes || '',
    expanded: false,
    subtasks: [],
    _listId: listId,
    _parentId: gTask.parent || null,
  };
}

function dueParam(iso) {
  return iso ? `${iso}T00:00:00.000Z` : undefined;
}

// 오프라인 중 쌓인 pending ops를 순서대로 API에 재생
async function flushPendingOps(token, listId) {
  const ops = await db.pendingOps.orderBy('id').toArray();
  if (ops.length === 0) return;

  const tempIdMap = {}; // opt-xxx → 실제 Google ID
  const resolve = (id) => tempIdMap[id] ?? id;
  // 이번 배치에서 만든 최상위/하위 항목의 마지막 id를 추적 → previous로 체이닝해 생성 순서 유지.
  // (배치 내 상대 순서만 보장; 기존 항목 대비 첫 항목 위치는 Google 기본값을 따른다.)
  let lastTaskId;
  const lastSubByParent = {};

  for (const op of ops) {
    try {
      const { payload: p } = op;

      if (op.type === 'addTask') {
        const g = await api.createTask(token, listId, {
          title: p.text,
          due: dueParam(p.dueDate),
          status: 'needsAction',
        }, { previous: lastTaskId });
        lastTaskId = g.id;
        tempIdMap[p.tempId] = g.id;
        await db.tasks.delete(p.tempId);
        await db.tasks.put({ id: g.id, _listId: listId, _parentId: null, text: p.text, done: false, dueDate: p.dueDate, date: null, notes: '' });

      } else if (op.type === 'updateTask') {
        await api.patchTask(token, listId, resolve(p.id), p.gPatch);

      } else if (op.type === 'toggleTask') {
        await api.patchTask(token, listId, resolve(p.id), { status: p.done ? 'completed' : 'needsAction' });

      } else if (op.type === 'removeTask') {
        const id = resolve(p.id);
        if (!isTemp(id)) await api.deleteTask(token, listId, id);

      } else if (op.type === 'addSubtask') {
        const parentId = resolve(p.taskId);
        const g = await api.createTask(token, listId, { title: p.text, status: 'needsAction' }, { parent: parentId, previous: lastSubByParent[parentId] });
        lastSubByParent[parentId] = g.id;
        tempIdMap[p.tempId] = g.id;
        await db.tasks.delete(p.tempId);
        await db.tasks.put({ id: g.id, _listId: listId, _parentId: parentId, text: p.text, done: false, dueDate: null, date: null, notes: '' });

      } else if (op.type === 'toggleSubtask') {
        await api.patchTask(token, listId, resolve(p.subId), { status: p.done ? 'completed' : 'needsAction' });

      } else if (op.type === 'removeSubtask') {
        const id = resolve(p.subId);
        if (!isTemp(id)) await api.deleteTask(token, listId, id);
      }

      await db.pendingOps.delete(op.id);
    } catch {
      break; // 순서 보장을 위해 실패 시 중단 (다음 online 이벤트에서 재시도)
    }
  }
}

export function useTasks(accessToken) {
  const [tasks, setTasks] = useState([]);
  const [listId, setListId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [refreshCount, setRefreshCount] = useState(0);

  // 최신 값을 online 이벤트 핸들러에서 참조하기 위한 refs
  const accessTokenRef = useRef(accessToken);
  const listIdRef = useRef(listId);
  const tasksRef = useRef(tasks);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { listIdRef.current = listId; }, [listId]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // 온라인 복귀 시: 큐 재생 → tasks 재로드
  useEffect(() => {
    const onOnline = async () => {
      setIsOffline(false);
      const token = accessTokenRef.current;
      const lid = listIdRef.current;
      if (!token || !lid) return;
      await flushPendingOps(token, lid);
      setRefreshCount((c) => c + 1);
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // tasks 로드 (accessToken 변경 또는 온라인 복귀 후 refreshCount 증가 시)
  useEffect(() => {
    if (!accessToken) { setTasks([]); setListId(null); return; }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        if (navigator.onLine) {
          const lists = await api.fetchTaskLists(accessToken);
          if (cancelled || lists.length === 0) return;
          const lid = lists[0].id;
          if (!cancelled) setListId(lid);

          const gTasks = await api.fetchTasks(accessToken, lid);
          if (cancelled) return;

          const parents = gTasks.filter((t) => !t.parent);
          const children = gTasks.filter((t) => t.parent);
          const local = parents.map((pt) => ({
            ...gToLocal(pt, lid),
            subtasks: children
              .filter((ct) => ct.parent === pt.id)
              .map((ct) => ({ id: ct.id, text: ct.title || '', done: ct.status === 'completed', dueDate: ct.due ? ct.due.split('T')[0] : null, notes: ct.notes || '' })),
          }));

          if (!cancelled) {
            setTasks(local);
            saveTasksToDb(lid, local).catch(() => {});
          }
        } else {
          const cached = await loadTasksFromDb();
          if (!cancelled && cached.listId) {
            setListId(cached.listId);
            setTasks(cached.tasks);
          }
        }
      } catch {
        if (!cancelled) {
          const cached = await loadTasksFromDb();
          if (cached.listId) { setListId(cached.listId); setTasks(cached.tasks); }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [accessToken, refreshCount]);

  const addTask = useCallback(async (text, dueDate, { notes = '', subtasks = [] } = {}) => {
    if (!listId) return;
    const previous = lastRealId(tasksRef.current); // 기존 마지막 할일 뒤(맨 끝)에 삽입
    const oid = newId();
    setTasks((prev) => [...prev, { id: oid, text, done: false, dueDate, date: null, notes, expanded: false, subtasks: [], _listId: listId, _parentId: null }]);
    db.tasks.put({ id: oid, _listId: listId, _parentId: null, text, done: false, dueDate, date: null, notes }).catch(() => {});

    // 하위할일 텍스트만 추출(빈 항목 제외). 새 할일 모달이 draft에 쌓아둔 것.
    const subTexts = subtasks.map((s) => (s.text || '').trim()).filter(Boolean);

    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'addTask', payload: { tempId: oid, text, dueDate, notes }, createdAt: Date.now() }).catch(() => {});
      // 오프라인: 임시 부모 id(oid) 밑으로 하위할일 큐잉 — 큐 재생 시 temp→실제 id 매핑됨(copyTask와 동일).
      for (const subText of subTexts) {
        const subOid = newId();
        setTasks((prev) => prev.map((t) => t.id === oid ? { ...t, subtasks: [...t.subtasks, { id: subOid, text: subText, done: false }] } : t));
        db.tasks.put({ id: subOid, _listId: listId, _parentId: oid, text: subText, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});
        db.pendingOps.add({ type: 'addSubtask', payload: { tempId: subOid, taskId: oid, text: subText }, createdAt: Date.now() }).catch(() => {});
      }
      return;
    }
    try {
      const g = await api.createTask(accessToken, listId, { title: text, due: dueParam(dueDate), notes, status: 'needsAction' }, { previous });
      setTasks((prev) => prev.map((t) => t.id === oid ? { ...t, id: g.id } : t));
      db.tasks.delete(oid).then(() => db.tasks.put({ id: g.id, _listId: listId, _parentId: null, text, done: false, dueDate, date: null, notes })).catch(() => {});

      // 부모 생성 후 각 하위할일을 부모 밑에 순서대로 생성(직전 하위 뒤에 체이닝 → 입력 순서 유지).
      let prevSub;
      for (const subText of subTexts) {
        const subOid = newId();
        setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: [...t.subtasks, { id: subOid, text: subText, done: false }] } : t));
        db.tasks.put({ id: subOid, _listId: listId, _parentId: g.id, text: subText, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});
        try {
          const sg = await api.createTask(accessToken, listId, { title: subText, status: 'needsAction' }, { parent: g.id, previous: prevSub });
          prevSub = sg.id;
          setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: t.subtasks.map((s) => s.id === subOid ? { ...s, id: sg.id } : s) } : t));
          db.tasks.delete(subOid).then(() => db.tasks.put({ id: sg.id, _listId: listId, _parentId: g.id, text: subText, done: false, dueDate: null, date: null, notes: '' })).catch(() => {});
        } catch {
          setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subOid) } : t));
          db.tasks.delete(subOid).catch(() => {});
        }
      }
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== oid));
      db.tasks.delete(oid).catch(() => {});
    }
  }, [accessToken, listId]);

  const updateTask = useCallback(async (id, patch) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    db.tasks.update(id, patch).catch(() => {});
    if (!listId) return;

    const gPatch = {};
    if ('text' in patch) gPatch.title = patch.text;
    if ('notes' in patch) gPatch.notes = patch.notes || '';
    if ('done' in patch) gPatch.status = patch.done ? 'completed' : 'needsAction';
    if ('dueDate' in patch) gPatch.due = dueParam(patch.dueDate) ?? null;
    if (Object.keys(gPatch).length === 0) return;

    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'updateTask', payload: { id, gPatch }, createdAt: Date.now() }).catch(() => {});
      return;
    }
    api.patchTask(accessToken, listId, id, gPatch).catch(() => {});
  }, [accessToken, listId]);

  const toggleTask = useCallback((id) => {
    const task = tasksRef.current.find((t) => t.id === id);
    if (!task) return;
    const done = !task.done;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done } : t));
    db.tasks.update(id, { done }).catch(() => {});
    if (!listId) return;
    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'toggleTask', payload: { id, done }, createdAt: Date.now() }).catch(() => {});
    } else {
      api.patchTask(accessToken, listId, id, { status: done ? 'completed' : 'needsAction' }).catch(() => {});
    }
  }, [accessToken, listId]);

  const removeTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    db.tasks.delete(id).catch(() => {});
    if (!listId) return;
    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'removeTask', payload: { id }, createdAt: Date.now() }).catch(() => {});
    } else {
      api.deleteTask(accessToken, listId, id).catch(() => {});
    }
  }, [accessToken, listId]);

  const toggleExpand = useCallback((id) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, expanded: !t.expanded } : t));
  }, []);

  const addSubtask = useCallback(async (taskId, text) => {
    const trimmed = text.trim();
    if (!trimmed || !listId) return;
    const parentTask = tasksRef.current.find((t) => t.id === taskId);
    const previous = parentTask ? lastRealId(parentTask.subtasks) : undefined; // 마지막 하위 뒤(맨 끝)에 삽입
    const oid = newId();
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: oid, text: trimmed, done: false }] } : t));
    db.tasks.put({ id: oid, _listId: listId, _parentId: taskId, text: trimmed, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});

    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'addSubtask', payload: { tempId: oid, taskId, text: trimmed }, createdAt: Date.now() }).catch(() => {});
      return;
    }
    try {
      const g = await api.createTask(accessToken, listId, { title: trimmed, status: 'needsAction' }, { parent: taskId, previous });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => s.id === oid ? { ...s, id: g.id } : s) } : t));
      db.tasks.delete(oid).then(() => db.tasks.put({ id: g.id, _listId: listId, _parentId: taskId, text: trimmed, done: false, dueDate: null, date: null, notes: '' })).catch(() => {});
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== oid) } : t));
      db.tasks.delete(oid).catch(() => {});
    }
  }, [accessToken, listId]);

  const toggleSubtask = useCallback((taskId, subId) => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    const sub = task?.subtasks.find((s) => s.id === subId);
    if (!sub) return;
    const done = !sub.done;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => s.id === subId ? { ...s, done } : s) } : t));
    db.tasks.update(subId, { done }).catch(() => {});
    if (!listId) return;
    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'toggleSubtask', payload: { subId, done }, createdAt: Date.now() }).catch(() => {});
    } else {
      api.patchTask(accessToken, listId, subId, { status: done ? 'completed' : 'needsAction' }).catch(() => {});
    }
  }, [accessToken, listId]);

  const removeSubtask = useCallback((taskId, subId) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t));
    db.tasks.delete(subId).catch(() => {});
    if (!listId) return;
    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'removeSubtask', payload: { subId }, createdAt: Date.now() }).catch(() => {});
    } else {
      api.deleteTask(accessToken, listId, subId).catch(() => {});
    }
  }, [accessToken, listId]);

  const copyTask = useCallback(async (task, targetDueDate) => {
    if (!listId) return;
    const previous = lastRealId(tasksRef.current); // 복사본도 맨 끝에 삽입
    const oid = newId();
    setTasks((prev) => [...prev, {
      id: oid, text: task.text, done: false,
      dueDate: targetDueDate, date: null,
      notes: task.notes || '',
      expanded: false, subtasks: [],
      _listId: listId, _parentId: null,
    }]);
    db.tasks.put({ id: oid, _listId: listId, _parentId: null, text: task.text, done: false, dueDate: targetDueDate, date: null, notes: task.notes || '' }).catch(() => {});

    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'addTask', payload: { tempId: oid, text: task.text, dueDate: targetDueDate, notes: task.notes || '' }, createdAt: Date.now() }).catch(() => {});
      for (const sub of task.subtasks) {
        const subOid = newId();
        setTasks((prev) => prev.map((t) => t.id === oid ? { ...t, subtasks: [...t.subtasks, { id: subOid, text: sub.text, done: false }] } : t));
        db.tasks.put({ id: subOid, _listId: listId, _parentId: oid, text: sub.text, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});
        db.pendingOps.add({ type: 'addSubtask', payload: { tempId: subOid, taskId: oid, text: sub.text }, createdAt: Date.now() }).catch(() => {});
      }
      return;
    }

    try {
      const g = await api.createTask(accessToken, listId, {
        title: task.text, due: dueParam(targetDueDate), notes: task.notes || '', status: 'needsAction',
      }, { previous });
      setTasks((prev) => prev.map((t) => t.id === oid ? { ...t, id: g.id } : t));
      db.tasks.delete(oid).then(() => db.tasks.put({ id: g.id, _listId: listId, _parentId: null, text: task.text, done: false, dueDate: targetDueDate, date: null, notes: task.notes || '' })).catch(() => {});

      let prevSub;
      for (const sub of task.subtasks) {
        const subOid = newId();
        setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: [...t.subtasks, { id: subOid, text: sub.text, done: false }] } : t));
        db.tasks.put({ id: subOid, _listId: listId, _parentId: g.id, text: sub.text, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});
        try {
          const sg = await api.createTask(accessToken, listId, { title: sub.text, status: 'needsAction' }, { parent: g.id, previous: prevSub });
          prevSub = sg.id;
          setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: t.subtasks.map((s) => s.id === subOid ? { ...s, id: sg.id } : s) } : t));
          db.tasks.delete(subOid).then(() => db.tasks.put({ id: sg.id, _listId: listId, _parentId: g.id, text: sub.text, done: false, dueDate: null, date: null, notes: '' })).catch(() => {});
        } catch {
          setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subOid) } : t));
          db.tasks.delete(subOid).catch(() => {});
        }
      }
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== oid));
      db.tasks.delete(oid).catch(() => {});
    }
  }, [accessToken, listId]);

  return { tasks, loading, isOffline, addTask, updateTask, toggleTask, removeTask, toggleExpand, addSubtask, toggleSubtask, removeSubtask, copyTask };
}
