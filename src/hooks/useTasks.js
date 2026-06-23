import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/googleTasks';
import { db, saveTasksToDb, loadTasksFromDb } from '../db/localDB';
import { googleToTask, googleToSubtask, taskToGoogleBody, patchToGoogleBody, byPosition } from '../utils/taskModel';
import { newTempId, isTempId } from '../utils/id';

const statusOf = (done) => (done ? 'completed' : 'needsAction');

// 새 항목을 형제 목록 맨 끝에 붙이기 위한 `previous`(앞 형제) id.
// Google Tasks는 previous 없이 만들면 맨 위에 저장 → 재로드 시 생성순서가 뒤집힌다.
// 서버에 실제로 존재하는(=temp 아닌) 마지막 항목 id를 반환(없으면 undefined → 맨 위, 첫 항목일 때만 발생).
function lastRealId(items) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (!isTempId(items[i].id)) return items[i].id;
  }
  return undefined;
}

// 로컬↔Google 매핑·정렬(byPosition)은 utils/taskModel.js로 일원화.

// 큐에 쌓이는 op 1건을 Google API에 적용 — "어떻게 호출하는가"의 단일 출처.
// 온라인 직접 경로(sendOp)와 오프라인 재생 경로(flushPendingOps)가 공유한다.
// resolve: temp-id → 실제 id 매핑(재생 배치 안에서만 의미; 온라인 직접 경로에선 항등함수).
// 생성(addTask/addSubtask)은 temp-id 재조정이 경로마다 달라 여기서 다루지 않고 각 경로가 전담.
async function applyOp(op, { token, listId, resolve = (x) => x }) {
  const p = op.payload;
  switch (op.type) {
    case 'updateTask':
      return api.patchTask(token, listId, resolve(p.id), p.gPatch);
    case 'toggleTask':
      return api.patchTask(token, listId, resolve(p.id), { status: statusOf(p.done) });
    case 'removeTask': {
      const id = resolve(p.id);
      if (!isTempId(id)) await api.deleteTask(token, listId, id);
      return;
    }
    case 'toggleSubtask':
      return api.patchTask(token, listId, resolve(p.subId), { status: statusOf(p.done) });
    case 'updateSubtask':
      return api.patchTask(token, listId, resolve(p.subId), { title: p.text });
    case 'removeSubtask': {
      const id = resolve(p.subId);
      if (!isTempId(id)) await api.deleteTask(token, listId, id);
      return;
    }
    case 'moveTask': {
      const id = resolve(p.id);
      if (!isTempId(id)) {
        await api.moveTask(token, listId, id, {
          parent: p.parent ? resolve(p.parent) : undefined,
          previous: p.previous ? resolve(p.previous) : undefined,
        });
      }
      return;
    }
  }
}

// 오프라인 중 쌓인 pending ops를 순서대로 API에 재생.
// 생성(addTask/addSubtask)만 여기서 temp→실제 id 매핑·DB 재조정을 인라인 처리하고,
// 나머지 단순 작업은 applyOp(온라인 경로와 공용)에 위임한다.
async function flushPendingOps(token, listId) {
  const ops = await db.pendingOps.orderBy('id').toArray();
  if (ops.length === 0) return;

  const tempIdMap = {}; // opt-xxx → 실제 Google ID
  const resolve = (id) => tempIdMap[id] ?? id;
  // 이번 배치에서 만든 최상위/하위 항목의 마지막 id를 추적 → previous로 체이닝해 생성 순서 유지.
  let lastTaskId;
  const lastSubByParent = {};

  for (const op of ops) {
    try {
      const { payload: p } = op;

      if (op.type === 'addTask') {
        // 배치 내 연속 생성은 lastTaskId로 체이닝, 첫 항목은 큐에 기록된 previous(기존 마지막 형제)로 → 맨 끝 삽입.
        const g = await api.createTask(token, listId,
          taskToGoogleBody({ text: p.text, dueDate: p.dueDate, notes: p.notes || '', date: p.date, time: p.time, done: false }),
          { previous: lastTaskId ?? resolve(p.previous) });
        lastTaskId = g.id;
        tempIdMap[p.tempId] = g.id;
        await db.tasks.delete(p.tempId);
        await db.tasks.put({ id: g.id, _listId: listId, _parentId: null, text: p.text, done: false, dueDate: p.dueDate, date: p.date ?? null, time: p.time ?? null, notes: p.notes || '' });

      } else if (op.type === 'addSubtask') {
        const parentId = resolve(p.taskId);
        // 같은 부모 내 연속 생성은 lastSubByParent 체이닝, 첫 항목은 기록된 previous(기존 마지막 하위)로.
        const g = await api.createTask(token, listId, taskToGoogleBody({ text: p.text, done: false }), { parent: parentId, previous: lastSubByParent[parentId] ?? resolve(p.previous) });
        lastSubByParent[parentId] = g.id;
        tempIdMap[p.tempId] = g.id;
        await db.tasks.delete(p.tempId);
        await db.tasks.put({ id: g.id, _listId: listId, _parentId: parentId, text: p.text, done: false, dueDate: null, date: null, notes: '' });

      } else {
        await applyOp(op, { token, listId, resolve });
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
  // 생성 중(temp id)인 부모의 실제 id를 가리키는 Promise 맵 { [tempId]: Promise<realId|null> }.
  // 갓 만든 할일에 곧바로 하위할일을 추가할 때(부모 생성 미완료) addSubtask가 이를 await해
  // 임시 부모 id가 Google `parent`로 새어나가 하위가 최상위로 생성되는 race를 막는다.
  const inflightParentRef = useRef({});
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { listIdRef.current = listId; }, [listId]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // 콜드 스타트 가속(stale-while-revalidate): 네트워크 응답을 기다리지 않고 IndexedDB 캐시를
  // 즉시 그려 첫 화면을 빠르게 띄운다(캐시는 토큰 불필요). 이후 아래 네트워크 load가 최신으로 교체.
  // 가드: 이미 네트워크 결과가 들어왔으면(목록 있음) 덮어쓰지 않음.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadTasksFromDb();
      if (cancelled || !cached.listId) return;
      setListId((cur) => cur ?? cached.listId);
      setTasks((cur) => (cur.length === 0 ? cached.tasks : cur));
    })();
    return () => { cancelled = true; };
  }, []);

  // 큐 재생 → tasks 재로드 (온라인 복귀 / 네이티브 앱 resume / 콜드 스타트 공용)
  // 동시 실행 가드: online 이벤트와 resume가 동시에 부르면 같은 큐를 이중 처리(중복 생성/순서 깨짐)할 수 있어 막는다.
  const flushingRef = useRef(false);
  const syncPending = useCallback(async () => {
    if (!navigator.onLine || flushingRef.current) return;
    const token = accessTokenRef.current;
    const lid = listIdRef.current;
    if (!token || !lid) return;
    flushingRef.current = true;
    try {
      await flushPendingOps(token, lid);
    } finally {
      flushingRef.current = false;
    }
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
  const hadTokenRef = useRef(false); // 토큰을 가진 적 있는지 — "재인증 중 토큰 없음"과 "로그아웃" 구분
  useEffect(() => {
    if (!accessToken) {
      // 콜드 스타트/재인증 중(아직 토큰 없음)엔 hydrate한 캐시를 유지하고, 명시적 로그아웃(토큰 보유→해제)에만 비운다.
      if (hadTokenRef.current) { setTasks([]); setListId(null); }
      return;
    }
    hadTokenRef.current = true;
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

  // 단순 작업(생성 제외)의 공통 전송: 오프라인이면 큐잉, 온라인이면 applyOp 실행(단일 출처).
  const sendOp = useCallback((op) => {
    if (!navigator.onLine) {
      db.pendingOps.add({ type: op.type, payload: op.payload, createdAt: Date.now() }).catch(() => {});
    } else {
      applyOp(op, { token: accessToken, listId }).catch(() => {});
    }
  }, [accessToken, listId]);

  // 단순 작업 공통 디스패치: 낙관적 UI + 로컬DB 반영 후, listId 있으면 sendOp로 전송.
  const dispatch = useCallback((op, { optimistic, local } = {}) => {
    if (optimistic) setTasks(optimistic);
    if (local) local();
    if (listId) sendOp(op);
  }, [listId, sendOp]);

  // 부모 1개 + 하위할일들 생성 공통 코어 (addTask·copyTask 공유).
  // localParent = { text, dueDate, date, time, notes }, subTexts = 하위할일 텍스트 배열.
  // 낙관적 UI + IndexedDB 반영 + (온라인: API 생성·temp→실제 id 재조정 | 오프라인: pendingOps 큐잉).
  const createTaskWithSubtasks = useCallback(async (localParent, subTexts, opts = {}) => {
    if (!listId) return null;
    // previous 명시되면 그 뒤에, 아니면 기존 마지막 할일 뒤(맨 끝)에 삽입.
    const previous = opts.previous !== undefined ? opts.previous : lastRealId(tasksRef.current);
    const oid = newTempId();
    const { text, dueDate = null, date = null, time = null, notes = '' } = localParent;
    setTasks((prev) => [...prev, { id: oid, text, done: false, dueDate, date, time, notes, expanded: false, subtasks: [], _listId: listId, _parentId: null }]);
    db.tasks.put({ id: oid, _listId: listId, _parentId: null, text, done: false, dueDate, date, time, notes }).catch(() => {});

    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'addTask', payload: { tempId: oid, text, dueDate, notes, date, time, previous }, createdAt: Date.now() }).catch(() => {});
      // 오프라인: 임시 부모 id(oid) 밑으로 하위할일 큐잉 — 큐 재생 시 temp→실제 id 매핑됨.
      for (const subText of subTexts) {
        const subOid = newTempId();
        setTasks((prev) => prev.map((t) => t.id === oid ? { ...t, subtasks: [...t.subtasks, { id: subOid, text: subText, done: false }] } : t));
        db.tasks.put({ id: subOid, _listId: listId, _parentId: oid, text: subText, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});
        db.pendingOps.add({ type: 'addSubtask', payload: { tempId: subOid, taskId: oid, text: subText }, createdAt: Date.now() }).catch(() => {});
      }
      return oid; // 오프라인: 임시 부모 id 반환(체이닝 무해)
    }
    // 부모 생성 구간을 Promise로 노출 → 생성 중(temp id)인 부모에 곧바로 하위할일을 달면
    // addSubtask가 이를 await해 실제 부모 id를 사용. 키는 지우지 않고 resolve된 채 남겨
    // (id 스왑~리렌더 사이 짧은 틈에 들어오는 늦은 addSubtask도 즉시 실제 id를 얻게) 둔다.
    let resolveParent;
    inflightParentRef.current[oid] = new Promise((r) => { resolveParent = r; });
    try {
      const g = await api.createTask(accessToken, listId, taskToGoogleBody({ text, dueDate, notes, date, time, done: false }), { previous });
      setTasks((prev) => prev.map((t) => t.id === oid ? { ...t, id: g.id } : t));
      db.tasks.delete(oid).then(() => db.tasks.put({ id: g.id, _listId: listId, _parentId: null, text, done: false, dueDate, date, time, notes })).catch(() => {});
      resolveParent(g.id);

      // 부모 생성 후 각 하위할일을 부모 밑에 순서대로 생성(직전 하위 뒤에 체이닝 → 입력 순서 유지).
      let prevSub;
      for (const subText of subTexts) {
        const subOid = newTempId();
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
      resolveParent(null); // 부모 생성 실패 → 대기 중인 addSubtask가 고아 만들지 않게 null 통지
      return null;
    }
  }, [accessToken, listId]);

  const addTask = useCallback(async (text, dueDate, { notes = '', subtasks = [], date = null, time = null } = {}) => {
    const subTexts = subtasks.map((s) => (s.text || '').trim()).filter(Boolean); // 새 할일 모달 draft의 하위할일
    await createTaskWithSubtasks({ text, dueDate, notes, date, time }, subTexts);
  }, [createTaskWithSubtasks]);

  const updateTask = useCallback((id, patch) => {
    // notes/date/time는 한 칸(notes)에 함께 인코딩되므로, 하나만 바뀌어도 "병합된 최신 상태"로
    // 재인코딩해야 나머지 값이 유실되지 않는다. tasksRef.current는 이번 패치 이전 상태라,
    // 여기에 patch를 덮어써 최신 전체 상태(merged)를 만든다.
    const cur = tasksRef.current.find((t) => t.id === id) || {};
    const merged = { ...cur, ...patch };

    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    db.tasks.update(id, patch).catch(() => {});
    if (!listId) return;

    const touchesNotes = 'notes' in patch || 'date' in patch || 'time' in patch;
    const gPatch = patchToGoogleBody(
      touchesNotes ? { ...patch, notes: merged.notes, date: merged.date, time: merged.time } : patch
    );
    if (Object.keys(gPatch).length === 0) return; // 서버에 보낼 변경 없음
    sendOp({ type: 'updateTask', payload: { id, gPatch } });
  }, [listId, sendOp]);

  const toggleTask = useCallback((id) => {
    const task = tasksRef.current.find((t) => t.id === id);
    if (!task) return;
    const done = !task.done;
    dispatch(
      { type: 'toggleTask', payload: { id, done } },
      {
        optimistic: (prev) => prev.map((t) => t.id === id ? { ...t, done } : t),
        local: () => db.tasks.update(id, { done }).catch(() => {}),
      }
    );
  }, [dispatch]);

  const removeTask = useCallback((id) => {
    dispatch(
      { type: 'removeTask', payload: { id } },
      {
        optimistic: (prev) => prev.filter((t) => t.id !== id),
        local: () => db.tasks.delete(id).catch(() => {}),
      }
    );
  }, [dispatch]);

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
    const oid = newTempId();
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: oid, text: trimmed, done: false }] } : t));
    db.tasks.put({ id: oid, _listId: listId, _parentId: taskId, text: trimmed, done: false, dueDate: null, date: null, notes: '' }).catch(() => {});

    if (!navigator.onLine) {
      db.pendingOps.add({ type: 'addSubtask', payload: { tempId: oid, taskId, text: trimmed, previous }, createdAt: Date.now() }).catch(() => {});
      return;
    }

    // 갓 만든 부모(temp id)면 부모 생성이 끝나 실제 id가 될 때까지 기다린다 → 임시 id가 Google
    // `parent`로 새어나가 하위가 최상위로 생성되는 race 차단. 추적 불가/부모 생성 실패면 낙관적 하위 철회.
    let parentId = taskId;
    if (isTempId(parentId)) {
      const real = await (inflightParentRef.current[parentId] ?? Promise.resolve(null));
      if (!real) {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== oid) } : t));
        db.tasks.delete(oid).catch(() => {});
        return;
      }
      parentId = real; // 이후 재조정은 실제 부모 id 기준(낙관적 하위는 id 스왑 때 부모 따라 이동됨)
    }

    try {
      const g = await api.createTask(accessToken, listId, taskToGoogleBody({ text: trimmed, done: false }), { parent: parentId, previous });
      setTasks((prev) => prev.map((t) => t.id === parentId ? { ...t, subtasks: t.subtasks.map((s) => s.id === oid ? { ...s, id: g.id } : s) } : t));
      db.tasks.delete(oid).then(() => db.tasks.put({ id: g.id, _listId: listId, _parentId: parentId, text: trimmed, done: false, dueDate: null, date: null, notes: '' })).catch(() => {});
    } catch {
      setTasks((prev) => prev.map((t) => t.id === parentId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== oid) } : t));
      db.tasks.delete(oid).catch(() => {});
    }
  }, [accessToken, listId]);

  const toggleSubtask = useCallback((taskId, subId) => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    const sub = task?.subtasks.find((s) => s.id === subId);
    if (!sub) return;
    const done = !sub.done;
    dispatch(
      { type: 'toggleSubtask', payload: { subId, done } },
      {
        optimistic: (prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => s.id === subId ? { ...s, done } : s) } : t),
        local: () => db.tasks.update(subId, { done }).catch(() => {}),
      }
    );
  }, [dispatch]);

  const updateSubtask = useCallback((taskId, subId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    dispatch(
      { type: 'updateSubtask', payload: { subId, text: trimmed } },
      {
        optimistic: (prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => s.id === subId ? { ...s, text: trimmed } : s) } : t),
        local: () => db.tasks.update(subId, { text: trimmed }).catch(() => {}),
      }
    );
  }, [dispatch]);

  const removeSubtask = useCallback((taskId, subId) => {
    dispatch(
      { type: 'removeSubtask', payload: { subId } },
      {
        optimistic: (prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t),
        local: () => db.tasks.delete(subId).catch(() => {}),
      }
    );
  }, [dispatch]);

  // 최상위 할일 순서 변경 — newOrder(보이는 목록의 새 id 순서)에서 movedId 앞 항목을 previous로.
  // 낙관적: 전체 tasks 배열에서 movedId를 previous 뒤(없으면 맨 앞)로 이동. 서버는 move API로 동기화.
  const reorderTask = useCallback((movedId, newOrder) => {
    const idx = newOrder.indexOf(movedId);
    if (idx === -1) return;
    const previous = idx > 0 ? newOrder[idx - 1] : undefined;
    dispatch(
      { type: 'moveTask', payload: { id: movedId, previous } },
      {
        optimistic: (prev) => {
          const moved = prev.find((t) => t.id === movedId);
          if (!moved) return prev;
          const rest = prev.filter((t) => t.id !== movedId);
          const at = previous ? rest.findIndex((t) => t.id === previous) + 1 : 0;
          rest.splice(at, 0, moved);
          return rest;
        },
      }
    );
  }, [dispatch]);

  // 하위할일 순서 변경 — 같은 부모 내. newSubOrder에서 movedSubId 앞 항목을 previous로.
  const reorderSubtask = useCallback((taskId, movedSubId, newSubOrder) => {
    const idx = newSubOrder.indexOf(movedSubId);
    if (idx === -1) return;
    const previous = idx > 0 ? newSubOrder[idx - 1] : undefined;
    dispatch(
      { type: 'moveTask', payload: { id: movedSubId, parent: taskId, previous } },
      {
        optimistic: (prev) => prev.map((t) => {
          if (t.id !== taskId) return t;
          const moved = t.subtasks.find((s) => s.id === movedSubId);
          if (!moved) return t;
          const rest = t.subtasks.filter((s) => s.id !== movedSubId);
          const at = previous ? rest.findIndex((s) => s.id === previous) + 1 : 0;
          rest.splice(at, 0, moved);
          return { ...t, subtasks: rest };
        }),
      }
    );
  }, [dispatch]);

  const copyTask = useCallback(async (task, targetDueDate, previous) => {
    // 복사: 종료일은 대상 날짜로, 시작일은 단일화(null), 시각은 유지, 완료상태는 리셋(false).
    // previous를 명시하면 그 항목 뒤에 삽입 → 다중 복사 시 선택 순서 보존(체이닝).
    const subTexts = task.subtasks.map((s) => (s.text || '').trim()).filter(Boolean);
    return createTaskWithSubtasks({ text: task.text, dueDate: targetDueDate, notes: task.notes || '', date: null, time: task.time ?? null }, subTexts, { previous });
  }, [createTaskWithSubtasks]);

  return { tasks, loading, isOffline, refresh: syncPending, addTask, updateTask, toggleTask, removeTask, toggleExpand, setExpandedFor, addSubtask, toggleSubtask, updateSubtask, removeSubtask, reorderTask, reorderSubtask, copyTask };
}
