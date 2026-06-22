import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/googleTasks';
import { db, saveTasksToDb, loadTasksFromDb } from '../db/localDB';
import { googleToTask, googleToSubtask, taskToGoogleBody, patchToGoogleBody, byPosition } from '../utils/taskModel';

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

// 로컬↔Google 매핑·정렬(byPosition)은 utils/taskModel.js로 일원화.

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
        const g = await api.createTask(token, listId,
          taskToGoogleBody({ text: p.text, dueDate: p.dueDate, notes: p.notes || '', date: p.date, time: p.time, done: false }),
          { previous: lastTaskId });
        lastTaskId = g.id;
        tempIdMap[p.tempId] = g.id;
        await db.tasks.delete(p.tempId);
        await db.tasks.put({ id: g.id, _listId: listId, _parentId: null, text: p.text, done: false, dueDate: p.dueDate, date: p.date ?? null, time: p.time ?? null, notes: p.notes || '' });

      } else if (op.type === 'updateTask') {
        await api.patchTask(token, listId, resolve(p.id), p.gPatch);

      } else if (op.type === 'toggleTask') {
        await api.patchTask(token, listId, resolve(p.id), { status: p.done ? 'completed' : 'needsAction' });

      } else if (op.type === 'removeTask') {
        const id = resolve(p.id);
        if (!isTemp(id)) await api.deleteTask(token, listId, id);

      } else if (op.type === 'addSubtask') {
        const parentId = resolve(p.taskId);
        const g = await api.createTask(token, listId, taskToGoogleBody({ text: p.text, done: false }), { parent: parentId, previous: lastSubByParent[parentId] });
        lastSubByParent[parentId] = g.id;
        tempIdMap[p.tempId] = g.id;
        await db.tasks.delete(p.tempId);
        await db.tasks.put({ id: g.id, _listId: listId, _parentId: parentId, text: p.text, done: false, dueDate: null, date: null, notes: '' });

      } else if (op.type === 'toggleSubtask') {
        await api.patchTask(token, listId, resolve(p.subId), { status: p.done ? 'completed' : 'needsAction' });

      } else if (op.type === 'updateSubtask') {
        await api.patchTask(token, listId, resolve(p.subId), { title: p.text });

      } else if (op.type === 'removeSubtask') {
        const id = resolve(p.subId);
        if (!isTemp(id)) await api.deleteTask(token, listId, id);

      } else if (op.type === 'moveTask') {
        const id = resolve(p.id);
        if (!isTemp(id)) {
          await api.moveTask(token, listId, id, {
            parent: p.parent ? resolve(p.parent) : undefined,
            previous: p.previous ? resolve(p.previous) : undefined,
          });
        }
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

  // 큐 재생 → tasks 재로드 (온라인 복귀 / 네이티브 앱 resume / 콜드 스타트 공용)
  const syncPending = useCallback(async () => {
    if (!navigator.onLine) return;
    const token = accessTokenRef.current;
    const lid = listIdRef.current;
    if (!token || !lid) return;
    await flushPendingOps(token, lid);
    setRefreshCount((c) => c + 1);
  }, []);

  // 온라인/오프라인 이벤트
  useEffect(() => {
    const onOnline = () => { setIsOffline(false); syncPending(); };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [syncPending]);

  // 네이티브(Capacitor) 앱 복귀(resume) 시 동기화 — 모바일은 자주 죽고 재개되므로.
  // 웹에선 isNativePlatform()=false → 리스너 미등록(기존 동작 유지).
  useEffect(() => {
    let remove;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor?.isNativePlatform?.()) return;
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('resume', () => { syncPending(); });
      remove = () => handle.remove();
    })();
    return () => { if (remove) remove(); };
  }, [syncPending]);

  // 콜드 스타트: listId 확보 후(온라인이면) 1회 큐 재생.
  // 앱을 새로 켰을 땐 'online' 이벤트가 안 오므로, 오프라인 중 쌓인 큐를 여기서 flush.
  const coldStartDone = useRef(false);
  useEffect(() => {
    if (coldStartDone.current) return;
    if (!accessToken || !listId) return;
    coldStartDone.current = true;
    syncPending();
  }, [accessToken, listId, syncPending]);

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

          const parents = gTasks.filter((t) => !t.parent).sort(byPosition);
          const children = gTasks.filter((t) => t.parent);
          const local = parents.map((pt) => ({
            ...googleToTask(pt, lid),
            _position: pt.position || '', // 매퍼는 필드 변환만 — 정렬용 _position은 여기서 부착
            subtasks: children
              .filter((ct) => ct.parent === pt.id)
              .sort(byPosition)
              .map((ct) => ({ ...googleToSubtask(ct), _position: ct.position || '' })),
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

  // 부모 1개 + 하위할일들 생성 공통 코어 (addTask·copyTask 공유).
  // localParent = { text, dueDate, date, time, notes }, subTexts = 하위할일 텍스트 배열.
  // 낙관적 UI + IndexedDB 반영 + (온라인: API 생성·temp→실제 id 재조정 | 오프라인: pendingOps 큐잉).
  const createTaskWithSubtasks = useCallback(async (localParent, subTexts, opts = {}) => {
    if (!listId) return null;
    // previous 명시되면 그 뒤에, 아니면 기존 마지막 할일 뒤(맨 끝)에 삽입.
    // 명시 전달(다중 복사 체이닝)은 tasksRef 갱신 타이밍에 의존하지 않게 해줌.
    const previous = opts.previous !== undefined ? opts.previous : lastRealId(tasksRef.current);
    const oid = newId();
    const { text, dueDate = null, date = null, time = null, notes = '' } = localParent;
    setTasks((prev) => [...prev, { id: oid, text, done: false, dueDate, date, time, notes, expanded: false, subtasks: [], _listId: listId, _parentId: null }]);
    db.tasks.put({ id: oid, _listId: listId, _parentId: null, text, done: false, dueDate, date, time, notes }).catch(() => {});

    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'addTask', payload: { tempId: oid, text, dueDate, notes, date, time }, createdAt: Date.now() }).catch(() => {});
      // 오프라인: 임시 부모 id(oid) 밑으로 하위할일 큐잉 — 큐 재생 시 temp→실제 id 매핑됨.
      for (const subText of subTexts) {
        const subOid = newId();
        setTasks((prev) => prev.map((t) => t.id === oid ? { ...t, subtasks: [...t.subtasks, { id: subOid, text: subText, done: false }] } : t));
        db.tasks.put({ id: subOid, _listId: listId, _parentId: oid, text: subText, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});
        db.pendingOps.add({ type: 'addSubtask', payload: { tempId: subOid, taskId: oid, text: subText }, createdAt: Date.now() }).catch(() => {});
      }
      return oid; // 오프라인: 임시 부모 id 반환(체이닝 무해)
    }
    try {
      const g = await api.createTask(accessToken, listId, taskToGoogleBody({ text, dueDate, notes, date, time, done: false }), { previous });
      setTasks((prev) => prev.map((t) => t.id === oid ? { ...t, id: g.id } : t));
      db.tasks.delete(oid).then(() => db.tasks.put({ id: g.id, _listId: listId, _parentId: null, text, done: false, dueDate, date, time, notes })).catch(() => {});

      // 부모 생성 후 각 하위할일을 부모 밑에 순서대로 생성(직전 하위 뒤에 체이닝 → 입력 순서 유지).
      let prevSub;
      for (const subText of subTexts) {
        const subOid = newId();
        setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: [...t.subtasks, { id: subOid, text: subText, done: false }] } : t));
        db.tasks.put({ id: subOid, _listId: listId, _parentId: g.id, text: subText, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});
        try {
          const sg = await api.createTask(accessToken, listId, taskToGoogleBody({ text: subText, done: false }), { parent: g.id, previous: prevSub });
          prevSub = sg.id;
          setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: t.subtasks.map((s) => s.id === subOid ? { ...s, id: sg.id } : s) } : t));
          db.tasks.delete(subOid).then(() => db.tasks.put({ id: sg.id, _listId: listId, _parentId: g.id, text: subText, done: false, dueDate: null, date: null, notes: '' })).catch(() => {});
        } catch {
          setTasks((prev) => prev.map((t) => t.id === g.id ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subOid) } : t));
          db.tasks.delete(subOid).catch(() => {});
        }
      }
      return g.id; // 생성된 실제 부모 id 반환(다음 복사의 previous로 체이닝)
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== oid));
      db.tasks.delete(oid).catch(() => {});
      return null;
    }
  }, [accessToken, listId]);

  const addTask = useCallback(async (text, dueDate, { notes = '', subtasks = [], date = null, time = null } = {}) => {
    const subTexts = subtasks.map((s) => (s.text || '').trim()).filter(Boolean); // 새 할일 모달 draft의 하위할일
    await createTaskWithSubtasks({ text, dueDate, notes, date, time }, subTexts);
  }, [createTaskWithSubtasks]);

  const updateTask = useCallback(async (id, patch) => {
    // notes/date/time는 한 칸(notes)에 함께 인코딩되므로, 하나만 바뀌어도 "병합된 최신 상태"로
    // 재인코딩해야 나머지 값이 유실되지 않는다. tasksRef.current는 이번 패치 이전 상태라,
    // 여기에 patch를 덮어써 최신 전체 상태(merged)를 만든다.
    const cur = tasksRef.current.find((t) => t.id === id) || {};
    const merged = { ...cur, ...patch };

    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    db.tasks.update(id, patch).catch(() => {});
    if (!listId) return;

    // notes/date/time 중 하나라도 바뀌면 병합된 최신값으로 재인코딩(나머지 유실 방지) → patchToGoogleBody에 merged 전달.
    const touchesNotes = 'notes' in patch || 'date' in patch || 'time' in patch;
    const gPatch = patchToGoogleBody(
      touchesNotes ? { ...patch, notes: merged.notes, date: merged.date, time: merged.time } : patch
    );
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

  // 여러 할일의 펼침 상태를 한 번에 설정(헤더의 "하위할일 일괄 보기/감추기"용)
  const setExpandedFor = useCallback((ids, expanded) => {
    const set = new Set(ids);
    setTasks((prev) => prev.map((t) => set.has(t.id) ? { ...t, expanded } : t));
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

  const updateSubtask = useCallback((taskId, subId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => s.id === subId ? { ...s, text: trimmed } : s) } : t));
    db.tasks.update(subId, { text: trimmed }).catch(() => {});
    if (!listId) return;
    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'updateSubtask', payload: { subId, text: trimmed }, createdAt: Date.now() }).catch(() => {});
    } else {
      api.patchTask(accessToken, listId, subId, { title: trimmed }).catch(() => {});
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

  // 최상위 할일 순서 변경 — newOrder(보이는 목록의 새 id 순서)에서 movedId 앞 항목을 previous로.
  // 낙관적: 전체 tasks 배열에서 movedId를 previous 뒤(없으면 맨 앞)로 이동. 서버는 move API로 동기화.
  const reorderTask = useCallback((movedId, newOrder) => {
    const idx = newOrder.indexOf(movedId);
    if (idx === -1) return;
    const previous = idx > 0 ? newOrder[idx - 1] : undefined;
    setTasks((prev) => {
      const moved = prev.find((t) => t.id === movedId);
      if (!moved) return prev;
      const rest = prev.filter((t) => t.id !== movedId);
      const at = previous ? rest.findIndex((t) => t.id === previous) + 1 : 0;
      rest.splice(at, 0, moved);
      return rest;
    });
    if (!listId) return;
    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'moveTask', payload: { id: movedId, previous }, createdAt: Date.now() }).catch(() => {});
    } else {
      api.moveTask(accessToken, listId, movedId, { previous }).catch(() => {});
    }
  }, [accessToken, listId]);

  // 하위할일 순서 변경 — 같은 부모 내. newSubOrder에서 movedSubId 앞 항목을 previous로.
  const reorderSubtask = useCallback((taskId, movedSubId, newSubOrder) => {
    const idx = newSubOrder.indexOf(movedSubId);
    if (idx === -1) return;
    const previous = idx > 0 ? newSubOrder[idx - 1] : undefined;
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const moved = t.subtasks.find((s) => s.id === movedSubId);
      if (!moved) return t;
      const rest = t.subtasks.filter((s) => s.id !== movedSubId);
      const at = previous ? rest.findIndex((s) => s.id === previous) + 1 : 0;
      rest.splice(at, 0, moved);
      return { ...t, subtasks: rest };
    }));
    if (!listId) return;
    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'moveTask', payload: { id: movedSubId, parent: taskId, previous }, createdAt: Date.now() }).catch(() => {});
    } else {
      api.moveTask(accessToken, listId, movedSubId, { parent: taskId, previous }).catch(() => {});
    }
  }, [accessToken, listId]);

  const copyTask = useCallback(async (task, targetDueDate, previous) => {
    // 복사: 종료일은 대상 날짜로, 시작일은 단일화(null), 시각은 유지, 완료상태는 리셋(false).
    // previous를 명시하면 그 항목 뒤에 삽입 → 다중 복사 시 선택 순서 보존(체이닝).
    const subTexts = task.subtasks.map((s) => (s.text || '').trim()).filter(Boolean);
    return createTaskWithSubtasks({ text: task.text, dueDate: targetDueDate, notes: task.notes || '', date: null, time: task.time ?? null }, subTexts, { previous });
  }, [createTaskWithSubtasks]);

  return { tasks, loading, isOffline, refresh: syncPending, addTask, updateTask, toggleTask, removeTask, toggleExpand, setExpandedFor, addSubtask, toggleSubtask, updateSubtask, removeSubtask, reorderTask, reorderSubtask, copyTask };
}
