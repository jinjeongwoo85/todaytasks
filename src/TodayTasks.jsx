import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useTasks } from './hooks/useTasks';
import { C, LONG_PRESS_MS, PRESS_MOVE_TOLERANCE, SWIPE_THRESHOLD } from './styles/tokens';
import { toISO, todayISO, tomorrowISO, formatDate, isTaskOnDate, monthStartOf } from './utils/date';
import Header from './components/Header';
import TaskList from './components/TaskList';
import CalendarSheet from './components/CalendarSheet';
import SettingsSheet from './components/SettingsSheet';
import TaskDetailModal from './components/TaskDetailModal';
import LoginScreen from './components/LoginScreen';

export default function TodayTasks() {
  const [draft, setDraft] = useState('');
  const [subDrafts, setSubDrafts] = useState({});
  const [viewMode, setViewMode] = useState('date');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [modalSubDraft, setModalSubDraft] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [newTaskDraft, setNewTaskDraft] = useState(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [datePickerTask, setDatePickerTask] = useState(null);
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [taskOrder, setTaskOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('todaytasks_order') || '[]'); } catch { return []; }
  });
  const [subtaskOrders, setSubtaskOrders] = useState({});
  const [dragInfo, setDragInfo] = useState(null);

  const { accessToken, isSignedIn, signIn, signOut, isReady, isSilentTrying } = useGoogleAuth();
  const { tasks, loading, isOffline, addTask: apiAddTask, updateTask, toggleTask, removeTask, toggleExpand, addSubtask, toggleSubtask, removeSubtask, copyTask } = useTasks(accessToken);

  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const pressStartPosRef = useRef({ x: 0, y: 0 });
  const pressedIdRef = useRef(null);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const swipeActiveRef = useRef(false);
  const containerRef = useRef(null);
  const swipeCleanupRef = useRef(null);
  const taskRowRefs = useRef({});
  const latestStateRef = useRef({});
  const swipeHandlersRef = useRef({});
  const backEntryPushedRef = useRef(false);

  // anyLayerOpen is a boolean primitive — safe as useEffect dependency
  const anyLayerOpen = calendarOpen || settingsOpen || !!datePickerTask || copyPickerOpen ||
    selectedIds.size > 0 || editingTaskId !== null || newTaskDraft !== null;

  latestStateRef.current = { settingsOpen, copyPickerOpen, datePickerTask, calendarOpen, selectedIds, editingTaskId, newTaskDraft };

  // Push a history entry the moment the first layer opens so the back button
  // has something to pop. Reset when all layers close so the next open re-pushes.
  useEffect(() => {
    if (anyLayerOpen && !backEntryPushedRef.current) {
      history.pushState({ backIntercept: true }, '');
      backEntryPushedRef.current = true;
    } else if (!anyLayerOpen) {
      backEntryPushedRef.current = false;
    }
  }, [anyLayerOpen]);

  // Register popstate once on mount. Reads latest state via ref — no stale closures.
  useEffect(() => {
    history.replaceState({ appBase: true }, '');
    const onPop = () => {
      // Reset so anyLayerOpen effect can re-push if layers remain open
      backEntryPushedRef.current = false;
      const s = latestStateRef.current;
      if (s.editingTaskId !== null) { setEditingTaskId(null); setModalSubDraft(''); return; }
      if (s.newTaskDraft !== null) { setNewTaskDraft(null); return; }
      if (s.settingsOpen) { setSettingsOpen(false); return; }
      if (s.copyPickerOpen) { setCopyPickerOpen(false); return; }
      if (s.datePickerTask) { setDatePickerTask(null); return; }
      if (s.calendarOpen) { setCalendarOpen(false); return; }
      if (s.selectedIds.size > 0) { setSelectedIds(new Set()); return; }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const getOrderedTasks = () => {
    const base = viewMode === 'all' ? tasks : tasks.filter((t) => isTaskOnDate(t, selectedDate));
    const inOrder = taskOrder.map((id) => base.find((t) => t.id === id)).filter(Boolean);
    const rest = base.filter((t) => !taskOrder.includes(t.id));
    return [...inOrder, ...rest];
  };

  const allForDate = getOrderedTasks();
  const visibleTasks = allForDate.filter((t) => !hideCompleted || !t.done);
  const completed = allForDate.filter((t) => t.done).length;
  const total = allForDate.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const editingTask = tasks.find((t) => t.id === editingTaskId) || null;

  const dateLabel = () => {
    if (viewMode === 'all') return '전체';
    if (selectedDate === todayISO()) return `오늘 - ${formatDate(todayISO())}`;
    if (selectedDate === tomorrowISO()) return `내일 - ${formatDate(tomorrowISO())}`;
    return formatDate(selectedDate);
  };

  const openCalendar = () => setCalendarOpen((v) => !v);

  const selectFromCalendar = (iso) => {
    setSelectedDate(iso);
    setViewMode('date');
    setCalendarOpen(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startPress = (id, e) => {
    longPressFiredRef.current = false;
    pressedIdRef.current = null;
    const point = e.touches ? e.touches[0] : e;
    pressStartPosRef.current = { x: point.clientX, y: point.clientY };
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      pressedIdRef.current = id;
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };
  const handlePressEnd = (id) => {
    cancelPress();
    if (dragInfo) return;
    if (longPressFiredRef.current && pressedIdRef.current) {
      toggleSelect(pressedIdRef.current);
      longPressFiredRef.current = false;
      pressedIdRef.current = null;
    }
  };
  const handlePressMove = (e) => {
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - pressStartPosRef.current.x;
    const dy = point.clientY - pressStartPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!longPressFiredRef.current) {
      if (dist > PRESS_MOVE_TOLERANCE) cancelPress();
    } else if (pressedIdRef.current && !dragInfo && Math.abs(dy) > 5 && Math.abs(dy) > Math.abs(dx)) {
      const orderedVisible = getOrderedTasks();
      const idx = orderedVisible.findIndex((t) => t.id === pressedIdRef.current);
      setDragInfo({ id: pressedIdRef.current, startY: point.clientY, currentY: point.clientY, originalIndex: idx });
      pressedIdRef.current = null;
    }
  };

  const shiftSelectedDate = (days) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toISO(d));
  };

  const updateDragY = (clientY) => {
    if (!dragInfo) return;
    setDragInfo((prev) => prev ? { ...prev, currentY: clientY } : null);
  };

  const computeDropIndex = (clientY) => {
    const rows = visibleTasks.map((t) => {
      const el = taskRowRefs.current[t.id];
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { id: t.id, midY: rect.top + rect.height / 2 };
    }).filter(Boolean);
    let idx = rows.length;
    for (let i = 0; i < rows.length; i++) {
      if (clientY < rows[i].midY) { idx = i; break; }
    }
    return idx;
  };

  const commitDrag = (clientY) => {
    if (!dragInfo) return;
    const fromIdx = dragInfo.originalIndex;
    const toIdx = computeDropIndex(clientY);
    if (fromIdx !== toIdx && toIdx !== fromIdx + 1) {
      const newOrder = visibleTasks.map((t) => t.id);
      const [moved] = newOrder.splice(fromIdx, 1);
      const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
      newOrder.splice(insertAt, 0, moved);
      setTaskOrder(newOrder);
      try { localStorage.setItem('todaytasks_order', JSON.stringify(newOrder)); } catch {}
    }
    setDragInfo(null);
  };

  const reorderSubtasks = (taskId, newIds) => {
    setSubtaskOrders((prev) => ({ ...prev, [taskId]: newIds }));
  };

  // Swipe is tracked via non-passive listeners registered once on mount.
  // swipeHandlersRef.current is updated every render so handlers always see fresh state.
  const handleSwipeStart = (e) => {
    if (!e.touches || e.touches.length !== 1) { swipeActiveRef.current = false; return; }
    const point = e.touches[0];
    swipeStartRef.current = { x: point.clientX, y: point.clientY };
    swipeActiveRef.current = true;
  };
  const handleSwipeMove = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const point = e.touches[0];
    if (dragInfo) {
      e.preventDefault();
      updateDragY(point.clientY);
      return;
    }
    if (!swipeActiveRef.current) return;
    const dx = point.clientX - swipeStartRef.current.x;
    const dy = point.clientY - swipeStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) cancelPress();
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > PRESS_MOVE_TOLERANCE) {
      e.preventDefault();
    }
  };
  const handleSwipeEnd = (e) => {
    if (dragInfo) {
      const point = e.changedTouches && e.changedTouches[0];
      if (point) commitDrag(point.clientY);
      return;
    }
    if (!swipeActiveRef.current) return;
    swipeActiveRef.current = false;
    if (viewMode !== 'date' || calendarOpen || editingTaskId !== null || selectedIds.size > 0) return;
    const point = e.changedTouches && e.changedTouches[0];
    if (!point) return;
    const dx = point.clientX - swipeStartRef.current.x;
    const dy = point.clientY - swipeStartRef.current.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      shiftSelectedDate(dx < 0 ? 1 : -1);
    }
  };

  swipeHandlersRef.current = { start: handleSwipeStart, move: handleSwipeMove, end: handleSwipeEnd };

  // callback ref: React가 DOM 요소가 마운트/언마운트될 때 직접 호출 → useEffect 타이밍 문제 없음
  const containerRefCallback = useCallback((el) => {
    if (swipeCleanupRef.current) {
      swipeCleanupRef.current();
      swipeCleanupRef.current = null;
    }
    containerRef.current = el;
    if (!el) return;
    const onStart = (e) => swipeHandlersRef.current.start(e);
    const onMove = (e) => swipeHandlersRef.current.move(e);
    const onEnd = (e) => swipeHandlersRef.current.end(e);
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    swipeCleanupRef.current = () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  const handleTextClick = (id) => {
    if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
    if (selectedIds.size > 0) {
      toggleSelect(id);
    } else {
      setEditingTaskId(id);
    }
  };

  const copySelectedTo = (targetIso) => {
    const toCopy = tasks.filter((t) => selectedIds.has(t.id));
    if (toCopy.length === 0) return;
    toCopy.forEach((t) => copyTask(t, targetIso));
    setSelectedIds(new Set());
    setSelectedDate(targetIso);
    setViewMode('date');
    setCopyPickerOpen(false);
  };

  const deleteSelected = () => {
    selectedIds.forEach((id) => removeTask(id));
    setSelectedIds(new Set());
  };

  const addTask = () => {
    const text = draft.trim();
    if (!text) return;
    const newDue = viewMode === 'date' ? selectedDate : null;
    apiAddTask(text, newDue);
    setDraft('');
  };

  const openNewTask = () => {
    setNewTaskDraft({
      id: '__new__',
      text: draft.trim(),
      notes: '',
      dueDate: viewMode === 'date' ? selectedDate : null,
      date: null,
      subtasks: [],
    });
    setDraft('');
  };

  const saveNewTask = () => {
    if (newTaskDraft?.text?.trim()) {
      apiAddTask(newTaskDraft.text.trim(), newTaskDraft.dueDate, { notes: newTaskDraft.notes });
    }
    setNewTaskDraft(null);
  };

  const closeModal = () => { setEditingTaskId(null); setModalSubDraft(''); };

  // 할 일 행에 전달할 핸들러 묶음 (제스처·상태는 모두 여기 부모 소유)
  const rowHandlers = {
    onToggleTask: toggleTask,
    onTextClick: handleTextClick,
    onStartPress: startPress,
    onPressEnd: handlePressEnd,
    onPressMove: handlePressMove,
    onCancelPress: cancelPress,
    onOpenDateChip: (t) => setDatePickerTask({ id: t.id, iso: t.dueDate }),
    onToggleExpand: toggleExpand,
    onSubDraftChange: (id, v) => setSubDrafts((prev) => ({ ...prev, [id]: v })),
    onToggleSubtask: (id, subId) => toggleSubtask(id, subId),
    onRemoveSubtask: (id, subId) => removeSubtask(id, subId),
    onAddSubtask: (id) => { addSubtask(id, subDrafts[id] || ''); setSubDrafts((prev) => ({ ...prev, [id]: '' })); },
    onReorderSubtasks: (id, newIds) => reorderSubtasks(id, newIds),
  };

  if (isSilentTrying || loading) {
    return <div style={{ minHeight: '100vh', background: C.bg }} />;
  }

  if (!isSignedIn) {
    return <LoginScreen onSignIn={signIn} isReady={isReady} />;
  }

  const dropIndex = dragInfo ? computeDropIndex(dragInfo.currentY) : -1;

  return (
    <div
      ref={containerRefCallback}
      style={{ background: C.bg, minHeight: '100vh', display: 'flex', justifyContent: 'center' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .sans { font-family: 'Inter', system-ui, sans-serif; }
        .task-row { transition: opacity 0.2s ease, background 0.15s ease; }
        .check-icon { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease; }
        .progress-fill { transition: width 0.35s ease; }
        .expand-panel { animation: reveal 0.18s ease; }
        .sheet-rise { animation: sheetRise 0.22s ease-out; }
        @keyframes reveal { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sheetRise { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .check-icon, .progress-fill, .task-row, .expand-panel, .sheet-rise { transition: none !important; animation: none !important; }
        }
      `}</style>

      <div className="sans" style={{ width: '100%', maxWidth: '380px', padding: '0 16px', boxSizing: 'border-box' }}>
        <Header
          isOffline={isOffline}
          dateLabel={dateLabel()}
          calendarOpen={calendarOpen}
          onOpenCalendar={openCalendar}
          selectionMode={selectedIds.size > 0}
          selectedCount={selectedIds.size}
          onCopy={() => setCopyPickerOpen(true)}
          onDeleteSelected={deleteSelected}
          onClearSelection={() => setSelectedIds(new Set())}
          hideCompleted={hideCompleted}
          onToggleHideCompleted={() => setHideCompleted((v) => !v)}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((v) => (v === 'all' ? 'date' : 'all'))}
          onOpenSettings={() => setSettingsOpen(true)}
          completed={completed}
          total={total}
          pct={pct}
        />

        <TaskList
          tasks={visibleTasks}
          viewMode={viewMode}
          dragInfo={dragInfo}
          dropIndex={dropIndex}
          selectedIds={selectedIds}
          onRowRef={(id, el) => { taskRowRefs.current[id] = el; }}
          subDrafts={subDrafts}
          subtaskOrders={subtaskOrders}
          rowHandlers={rowHandlers}
        />

        {/* Add task */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', borderTop: `1px solid ${C.borderSoft}`, paddingTop: '14px' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
            placeholder={viewMode === 'date' ? `${formatDate(selectedDate)}에 할 일 추가` : '할 일 추가'}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: C.ink, fontFamily: 'Inter, system-ui, sans-serif' }}
          />
          <button
            onClick={openNewTask}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: C.ink, color: C.inkInv, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            aria-label="추가"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {calendarOpen && (
        <CalendarSheet
          onClose={() => setCalendarOpen(false)}
          selectedDate={selectedDate}
          tasks={tasks}
          onSelect={selectFromCalendar}
          initialMonth={monthStartOf(viewMode === 'date' ? selectedDate : todayISO())}
        />
      )}

      {datePickerTask && (
        <CalendarSheet
          onClose={() => setDatePickerTask(null)}
          selectedDate={datePickerTask.iso || ''}
          tasks={tasks}
          onSelect={(iso) => { updateTask(datePickerTask.id, { dueDate: iso }); setDatePickerTask(null); }}
          initialMonth={monthStartOf(datePickerTask.iso)}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          onSignOut={() => { signOut(); setSettingsOpen(false); }}
        />
      )}

      {copyPickerOpen && (
        <CalendarSheet
          onClose={() => setCopyPickerOpen(false)}
          selectedDate={selectedDate}
          tasks={tasks}
          onSelect={copySelectedTo}
          initialMonth={monthStartOf(todayISO())}
          header="복사할 날짜를 선택하세요"
        />
      )}

      <TaskDetailModal
        task={editingTask ?? newTaskDraft}
        isNew={!!newTaskDraft && !editingTask}
        subDraft={modalSubDraft}
        onSubDraftChange={setModalSubDraft}
        onClose={editingTask ? closeModal : () => setNewTaskDraft(null)}
        onSave={editingTask ? closeModal : saveNewTask}
        onChange={editingTask
          ? (patch) => updateTask(editingTaskId, patch)
          : (patch) => setNewTaskDraft((prev) => ({ ...prev, ...patch }))}
        onDelete={editingTask ? () => { removeTask(editingTaskId); closeModal(); } : null}
        onToggleSubtask={(subId) => toggleSubtask(editingTaskId, subId)}
        onRemoveSubtask={(subId) => removeSubtask(editingTaskId, subId)}
        onAddSubtask={() => { addSubtask(editingTaskId, modalSubDraft); setModalSubDraft(''); }}
      />
    </div>
  );
}
