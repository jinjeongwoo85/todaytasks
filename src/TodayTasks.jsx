import { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useTasks } from './hooks/useTasks';
import { useTaskListGestures } from './hooks/useTaskListGestures';
import { C } from './styles/tokens';
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

  const { accessToken, isSignedIn, signIn, signOut, isReady, isSilentTrying } = useGoogleAuth();
  const { tasks, loading, isOffline, addTask: apiAddTask, updateTask, toggleTask, removeTask, toggleExpand, addSubtask, toggleSubtask, removeSubtask, copyTask } = useTasks(accessToken);

  const latestStateRef = useRef({});
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

  const shiftSelectedDate = (days) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toISO(d));
  };

  const reorderSubtasks = (taskId, newIds) => {
    setSubtaskOrders((prev) => ({ ...prev, [taskId]: newIds }));
  };

  // 메인 리스트 제스처(스와이프·롱프레스 다중선택·드래그 정렬)를 단일 native 리스너 경로로 통합.
  // 스와이프는 날짜뷰이고 시트/모달/선택모드가 아닐 때만 허용(기존 가드 동일).
  const swipeEnabled = viewMode === 'date' && !calendarOpen && editingTaskId === null && selectedIds.size === 0;
  const gestures = useTaskListGestures({
    visibleTasks,
    swipeEnabled,
    onToggleSelect: toggleSelect,
    onShiftDate: shiftSelectedDate,
    onReorder: (newOrder) => {
      setTaskOrder(newOrder);
      try { localStorage.setItem('todaytasks_order', JSON.stringify(newOrder)); } catch {}
    },
  });

  const handleTextClick = (id) => {
    // 롱프레스 직후 따라오는 click은 무시(드래그/선택과 탭 충돌 방지)
    if (gestures.longPressFiredRef.current) { gestures.longPressFiredRef.current = false; return; }
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

  // 할 일 행에 전달할 (터치가 아닌) 클릭/콜백 핸들러 묶음. 제스처는 컨테이너 hook이 전담.
  const rowHandlers = {
    onToggleTask: toggleTask,
    onTextClick: handleTextClick,
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

  return (
    <div
      ref={gestures.containerRef}
      style={{ background: C.bg, minHeight: '100vh', display: 'flex', justifyContent: 'center', touchAction: 'pan-y' }}
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
          dragInfo={gestures.dragInfo}
          dropIndex={gestures.dropIndex}
          selectedIds={selectedIds}
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
