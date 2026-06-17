import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CornerDownRight,
  Calendar as CalendarIcon,
  Copy,
  X,
} from 'lucide-react';

const todayDate = new Date();
const yesterdayDate = new Date(todayDate);
yesterdayDate.setDate(todayDate.getDate() - 1);
const tomorrowDate = new Date(todayDate);
tomorrowDate.setDate(todayDate.getDate() + 1);
const nextWeekDate = new Date(todayDate);
nextWeekDate.setDate(todayDate.getDate() + 5);

const toISO = (d) => d.toISOString().split('T')[0];
const TODAY_ISO = toISO(todayDate);
const TOMORROW_ISO = toISO(tomorrowDate);
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const formatDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
};
const formatShort = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const dateTone = (iso) => {
  if (!iso) return 'none';
  if (iso < TODAY_ISO) return 'overdue';
  if (iso === TODAY_ISO) return 'today';
  return 'future';
};

const TONE_STYLES = {
  none: { bg: '#FFFFFF', fg: '#A8A29A', border: '#D9D5C7' },
  overdue: { bg: '#F3E0D8', fg: '#B5562F', border: '#F3E0D8' },
  today: { bg: '#E3EBE0', fg: '#4D6B4F', border: '#E3EBE0' },
  future: { bg: '#EDEAE2', fg: '#6B6862', border: '#EDEAE2' },
};
const toneStyle = (iso) => TONE_STYLES[dateTone(iso)];

const isTaskOnDate = (t, iso) => {
  if (t.date && t.dueDate && t.date <= t.dueDate) {
    return iso >= t.date && iso <= t.dueDate;
  }
  return t.dueDate === iso;
};

const rowDateLabel = (t) => {
  if (t.date && t.dueDate && t.date <= t.dueDate && t.date !== t.dueDate) {
    return `${formatShort(t.date)}~${formatShort(t.dueDate)}`;
  }
  return t.dueDate ? formatDate(t.dueDate) : null;
};

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const LONG_PRESS_MS = 450;

const initialTasks = [
  { id: 1, text: '예산 보고서 초안 작성', done: false, dueDate: TODAY_ISO, date: null, notes: '', expanded: false, subtasks: [] },
  { id: 2, text: '14시 회의 자료 준비', done: true, dueDate: TODAY_ISO, date: null, notes: '', expanded: false, subtasks: [] },
  {
    id: 3,
    text: '[R] 운동',
    done: false,
    dueDate: TOMORROW_ISO,
    date: null,
    notes: '',
    expanded: true,
    subtasks: [
      { id: 31, text: 'ST 10', done: false },
      { id: 32, text: 'SQ 100', done: false },
      { id: 33, text: 'PU 20', done: false },
      { id: 34, text: 'C 20', done: false },
    ],
  },
  { id: 4, text: '민원 회신 이메일 발송', done: false, dueDate: null, date: null, notes: '', expanded: false, subtasks: [] },
  { id: 5, text: '작년도 결산 자료 정리', done: false, dueDate: toISO(yesterdayDate), date: null, notes: '', expanded: false, subtasks: [] },
  { id: 6, text: '워크숍 발표자료 준비', done: false, dueDate: toISO(nextWeekDate), date: TODAY_ISO, notes: '여러 날에 걸쳐 준비하는 작업', expanded: false, subtasks: [] },
];

function MonthCalendar({ monthDate, selectedDate, tasks, onSelect, onPrevMonth, onNextMonth, onToday }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="expand-panel" style={{ background: '#FFFFFF', border: '1px solid #E3E0D5', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={onPrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B8780', padding: '4px' }} aria-label="이전 달">
          <ChevronLeft size={16} />
        </button>
        <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: '#232323' }}>
          {year}년 {month + 1}월
        </span>
        <button onClick={onNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B8780', padding: '4px' }} aria-label="다음 달">
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '4px' }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="mono" style={{ textAlign: 'center', fontSize: '10px', color: '#A8A29A' }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: '2px' }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = iso === TODAY_ISO;
          const isSelected = iso === selectedDate;
          const hasTasks = tasks.some((t) => isTaskOnDate(t, iso));
          return (
            <button
              key={idx}
              onClick={() => onSelect(iso)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                aspectRatio: '1', borderRadius: '8px', margin: '1px',
                border: !isSelected && isToday ? '1px solid #5C7A5C' : '1px solid transparent',
                background: isSelected ? '#232323' : 'transparent', cursor: 'pointer', padding: 0,
              }}
            >
              <span style={{ fontSize: '13px', color: isSelected ? '#F6F4ED' : '#232323' }}>{day}</span>
              <span
                style={{
                  width: '3px', height: '3px', borderRadius: '50%', marginTop: '1px',
                  background: hasTasks ? (isSelected ? '#F6F4ED' : '#5C7A5C') : 'transparent',
                }}
              />
            </button>
          );
        })}
      </div>

      <button
        onClick={onToday}
        className="mono"
        style={{ marginTop: '10px', fontSize: '11px', color: '#5C7A5C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        오늘로 이동
      </button>
    </div>
  );
}

// Single-tap native date picker: an invisible <input type="date"> is overlaid
// directly on top of the visible chip, so the very first tap IS the tap on
// the real input (no intermediate "enable editing" step needed).
function LabeledDateField({ label, iso, onPick, onClear }) {
  const tone = toneStyle(iso);
  return (
    <div style={{ flex: 1 }}>
      <div className="mono" style={{ fontSize: '10px', color: '#8B8780', marginBottom: '4px' }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type="date"
          value={iso || ''}
          onChange={(e) => onPick(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 1, border: 'none' }}
        />
        <div
          className="mono"
          style={{
            position: 'relative', zIndex: 2, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '13px', padding: '8px', borderRadius: '8px', boxSizing: 'border-box',
            background: tone.bg, color: iso ? tone.fg : '#A8A29A', border: `1px solid ${iso ? tone.border : '#D9D5C7'}`,
          }}
        >
          <span>{iso ? formatDate(iso) : '설정 안함'}</span>
          {iso && (
            <X size={12} style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClear(); }} />
          )}
        </div>
      </div>
    </div>
  );
}

// Same single-tap overlay trick for the header's "copy to date" action.
function CopyDateButton({ disabled, onPick }) {
  return (
    <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
      <input
        type="date"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
          e.target.value = '';
        }}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: disabled ? 'default' : 'pointer', zIndex: 1, border: 'none' }}
      />
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #D9D5C7', borderRadius: '10px', color: '#8B8780', opacity: disabled ? 0.4 : 1,
        }}
      >
        <Copy size={14} />
      </div>
    </div>
  );
}

function SubtaskList({ subtasks, onToggle, onRemove, draft, onDraftChange, onAdd, compact }) {
  return (
    <div>
      {subtasks.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: compact ? '5px 0' : '6px 0' }}>
          <button
            onClick={() => onToggle(s.id)}
            style={{
              width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${s.done ? '#5C7A5C' : '#A8A29A'}`,
              background: s.done ? '#5C7A5C' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
            }}
            aria-label={s.done ? '완료 취소' : '완료로 표시'}
          >
            <Check size={11} color="#F6F4ED" style={{ opacity: s.done ? 1 : 0 }} />
          </button>
          <span
            onClick={() => onToggle(s.id)}
            style={{ flex: 1, fontSize: compact ? '13px' : '14px', color: s.done ? '#A8A29A' : '#232323', textDecoration: s.done ? 'line-through' : 'none', cursor: 'pointer' }}
          >
            {s.text}
          </span>
          <button onClick={() => onRemove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C2BEB3', padding: '2px' }} aria-label="하위 할 일 삭제">
            <X size={13} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
        <CornerDownRight size={14} color="#C2BEB3" />
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
          placeholder="하위 할 일 추가"
          style={{ flex: 1, border: 'none', borderBottom: '1px dotted #D9D5C7', background: 'transparent', outline: 'none', fontSize: '13px', color: '#232323', padding: '2px 0', fontFamily: 'inherit' }}
        />
        <button onClick={onAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5C7A5C', padding: '2px' }} aria-label="하위 할 일 추가">
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, subDraft, onSubDraftChange, onClose, onChange, onDelete, onToggleSubtask, onRemoveSubtask, onAddSubtask }) {
  const notesRef = useRef(null);

  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = notesRef.current.scrollHeight + 'px';
    }
  }, [task?.id]);

  if (!task) return null;

  const handleNotesInput = (e) => {
    onChange({ notes: e.target.value });
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(35,35,35,0.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-rise sans"
        style={{ background: '#FAF8F3', width: '100%', maxWidth: '380px', borderRadius: '18px 18px 0 0', padding: '10px 20px 26px', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box' }}
      >
        <div style={{ width: '36px', height: '4px', background: '#D9D5C7', borderRadius: '2px', margin: '0 auto 18px' }} />

        <input
          value={task.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="할 일 제목"
          style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '19px', fontWeight: 600, color: '#232323', marginBottom: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />

        <textarea
          ref={notesRef}
          value={task.notes || ''}
          onChange={handleNotesInput}
          placeholder="세부정보 추가"
          rows={2}
          style={{
            width: '100%', border: 'none', borderBottom: '1px solid #E3E0D5', background: 'transparent', outline: 'none',
            fontSize: '14px', color: '#232323', resize: 'none', overflow: 'hidden', minHeight: '40px',
            paddingBottom: '10px', marginBottom: '10px', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
          <LabeledDateField label="시작날짜" iso={task.date} onPick={(v) => onChange({ date: v })} onClear={() => onChange({ date: null })} />
          <LabeledDateField label="종료날짜" iso={task.dueDate} onPick={(v) => onChange({ dueDate: v })} onClear={() => onChange({ dueDate: null })} />
        </div>
        <div className="mono" style={{ fontSize: '10px', color: '#A8A29A', marginBottom: '18px' }}>
          시작날짜와 종료날짜를 다르게 설정하면 그 사이 모든 날에 표시됩니다
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div className="mono" style={{ fontSize: '11px', color: '#8B8780', marginBottom: '8px', letterSpacing: '0.06em' }}>
            하위 할 일
          </div>
          <SubtaskList
            subtasks={task.subtasks}
            onToggle={onToggleSubtask}
            onRemove={onRemoveSubtask}
            draft={subDraft}
            onDraftChange={onSubDraftChange}
            onAdd={onAddSubtask}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            className="mono"
            style={{
              flex: 1, padding: '12px', borderRadius: '999px', border: 'none',
              background: '#232323', color: '#F6F4ED',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            세부내용 작성완료
          </button>
          <button
            onClick={onDelete}
            style={{ padding: '0 14px', borderRadius: '999px', border: '1px solid #E3B8A8', background: 'transparent', color: '#B5562F', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            aria-label="할 일 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TodayTasks() {
  const [tasks, setTasks] = useState(initialTasks);
  const [draft, setDraft] = useState('');
  const [subDrafts, setSubDrafts] = useState({});
  const [viewMode, setViewMode] = useState('date');
  const [selectedDate, setSelectedDate] = useState(TODAY_ISO);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [modalSubDraft, setModalSubDraft] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const pressStartPosRef = useRef({ x: 0, y: 0 });
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const swipeActiveRef = useRef(false);

  // Back navigation (browser/system back) closes the popup or clears a
  // pending copy-selection instead of leaving the page.
  // NOTE: Inside the Claude artifact preview, the back gesture is captured
  // by the host app to close the artifact panel before it ever reaches this
  // page's JavaScript, so a History API based approach has no effect here.
  // It's left out for now — use the X / backdrop tap (modal) or "취소"
  // button (selection) instead. If this is deployed as a standalone web
  // app later, the History API approach would work as expected there.

  const visibleTasks = viewMode === 'all' ? tasks : tasks.filter((t) => isTaskOnDate(t, selectedDate));
  const completed = visibleTasks.filter((t) => t.done).length;
  const total = visibleTasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const editingTask = tasks.find((t) => t.id === editingTaskId) || null;

  const dateLabel = () => {
    if (viewMode === 'all') return '전체';
    if (selectedDate === TODAY_ISO) return '오늘';
    if (selectedDate === TOMORROW_ISO) return '내일';
    return formatDate(selectedDate);
  };

  const openCalendar = () => {
    const base = viewMode === 'date' ? selectedDate : TODAY_ISO;
    const d = new Date(base + 'T00:00:00');
    setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setCalendarOpen((v) => !v);
  };

  const selectFromCalendar = (iso) => {
    setSelectedDate(iso);
    setViewMode('date');
    setCalendarOpen(false);
  };

  const jumpToday = () => {
    setCalendarMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
    setSelectedDate(TODAY_ISO);
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

  const PRESS_MOVE_TOLERANCE = 10;
  const SWIPE_THRESHOLD = 50;

  const startPress = (id, e) => {
    longPressFiredRef.current = false;
    const point = e.touches ? e.touches[0] : e;
    pressStartPosRef.current = { x: point.clientX, y: point.clientY };
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      toggleSelect(id);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };
  const handlePressMove = (e) => {
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - pressStartPosRef.current.x;
    const dy = point.clientY - pressStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) cancelPress();
  };

  const shiftSelectedDate = (days) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toISO(d));
  };

  // Swipe is tracked separately from long-press. Any real movement cancels a
  // pending long-press immediately (so a slow swipe can't accidentally flip
  // into selection mode partway through and block the day change), and the
  // gesture is only ever acted on once (single touch, single shift).
  const handleSwipeStart = (e) => {
    if (!e.touches || e.touches.length !== 1) { swipeActiveRef.current = false; return; }
    const point = e.touches[0];
    swipeStartRef.current = { x: point.clientX, y: point.clientY };
    swipeActiveRef.current = true;
  };
  const handleSwipeMove = (e) => {
    if (!swipeActiveRef.current || !e.touches || e.touches.length !== 1) return;
    const point = e.touches[0];
    const dx = point.clientX - swipeStartRef.current.x;
    const dy = point.clientY - swipeStartRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > PRESS_MOVE_TOLERANCE) cancelPress();
  };
  const handleSwipeEnd = (e) => {
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
    const copies = toCopy.map((t) => ({
      id: newId(), text: t.text, done: false, dueDate: targetIso, date: null, notes: t.notes, expanded: false,
      subtasks: t.subtasks.map((s) => ({ id: newId(), text: s.text, done: false })),
    }));
    setTasks((prev) => [...prev, ...copies]);
    setSelectedIds(new Set());
    setSelectedDate(targetIso);
    setViewMode('date');
  };

  const updateTask = (id, patch) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const toggleTask = (id) => updateTask(id, { done: !tasks.find((t) => t.id === id).done });
  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const toggleExpand = (id) => updateTask(id, { expanded: !tasks.find((t) => t.id === id).expanded });

  const toggleSubtask = (taskId, subId) =>
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) } : t)));

  const removeSubtask = (taskId, subId) =>
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t)));

  const addSubtask = (taskId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: newId(), text: trimmed, done: false }] } : t)));
  };

  const addTask = () => {
    const text = draft.trim();
    if (!text) return;
    const newDue = viewMode === 'date' ? selectedDate : null;
    setTasks((prev) => [...prev, { id: newId(), text, done: false, dueDate: newDue, date: null, notes: '', expanded: false, subtasks: [] }]);
    setDraft('');
  };

  const closeModal = () => { setEditingTaskId(null); setModalSubDraft(''); };

  return (
    <div
      onTouchStart={handleSwipeStart}
      onTouchMove={handleSwipeMove}
      onTouchEnd={handleSwipeEnd}
      style={{ background: '#F6F4ED', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '32px 16px' }}
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

      <div className="sans" style={{ width: '100%', maxWidth: '380px' }}>
        {/* Date selector / selection action row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: calendarOpen ? '12px' : '8px', gap: '6px' }}>
          <button onClick={openCalendar} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: '#232323', minWidth: 0 }}>
            <CalendarIcon size={16} color="#5C7A5C" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '19px', fontWeight: 600, whiteSpace: 'nowrap' }}>{dateLabel()} 할 일</span>
            <ChevronDown size={16} color="#A8A29A" style={{ transform: calendarOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', flexShrink: 0 }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {selectedIds.size > 0 && (
              <span className="mono" style={{ fontSize: '11px', color: '#5C7A5C', whiteSpace: 'nowrap' }}>{selectedIds.size}개 선택</span>
            )}
            <CopyDateButton disabled={selectedIds.size === 0} onPick={copySelectedTo} />
            {selectedIds.size > 0 ? (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="mono"
                style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '10px', background: 'transparent', color: '#8B8780', border: '1px solid #D9D5C7', cursor: 'pointer' }}
              >
                취소
              </button>
            ) : (
              <button
                onClick={() => setViewMode((v) => (v === 'all' ? 'date' : 'all'))}
                className="mono"
                style={{
                  fontSize: '12px', padding: '6px 10px', borderRadius: '10px',
                  background: viewMode === 'all' ? '#232323' : 'transparent',
                  color: viewMode === 'all' ? '#F6F4ED' : '#8B8780',
                  border: viewMode === 'all' ? 'none' : '1px solid #D9D5C7',
                  cursor: 'pointer',
                }}
              >
                전체
              </button>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mono" style={{ fontSize: '10px', color: '#A8A29A', marginBottom: '14px', marginTop: '-4px' }}>
            할 일을 길게 눌러 선택하고, 복사 아이콘으로 날짜를 고르면 그대로 복사됩니다
          </div>
        )}

        {calendarOpen && (
          <MonthCalendar
            monthDate={calendarMonth}
            selectedDate={selectedDate}
            tasks={tasks}
            onSelect={selectFromCalendar}
            onPrevMonth={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
            onNextMonth={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
            onToday={jumpToday}
          />
        )}

        {/* Progress */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
            <span className="mono" style={{ fontSize: '15px', color: '#5C7A5C', fontWeight: 600 }}>
              {String(completed).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
          <div style={{ height: '6px', background: '#E3E0D5', width: '100%' }}>
            <div className="progress-fill" style={{ height: '100%', width: `${pct}%`, background: '#5C7A5C' }} />
          </div>
        </div>

        {/* Task list */}
        <div>
          {visibleTasks.map((t, i) => {
            const subDone = t.subtasks.filter((s) => s.done).length;
            const tone = toneStyle(t.dueDate);
            const dateLabelText = rowDateLabel(t);
            const selected = selectedIds.has(t.id);
            return (
              <div key={t.id}>
                <div
                  className="task-row"
                  style={{
                    display: 'flex', alignItems: 'center', padding: '12px 6px',
                    margin: '0 -6px', borderRadius: '8px',
                    opacity: t.done ? 0.5 : 1,
                    background: selected ? '#EAE7DC' : 'transparent',
                    borderLeft: selected ? '3px solid #5C7A5C' : '3px solid transparent',
                  }}
                >
                  <button
                    onClick={() => toggleTask(t.id)}
                    style={{
                      width: '22px', height: '22px', flexShrink: 0, marginRight: '10px',
                      border: `1.5px solid ${t.done ? '#5C7A5C' : '#A8A29A'}`,
                      background: t.done ? '#5C7A5C' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                    }}
                    aria-label={t.done ? '완료 취소' : '완료로 표시'}
                  >
                    <Check className="check-icon" size={14} color="#F6F4ED" style={{ transform: t.done ? 'scale(1)' : 'scale(0)', opacity: t.done ? 1 : 0 }} />
                  </button>

                  <div
                    onClick={() => handleTextClick(t.id)}
                    onTouchStart={(e) => startPress(t.id, e)}
                    onTouchEnd={cancelPress}
                    onTouchMove={handlePressMove}
                    onMouseDown={(e) => startPress(t.id, e)}
                    onMouseUp={cancelPress}
                    onMouseLeave={cancelPress}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0,
                      paddingRight: '10px', boxSizing: 'border-box', cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '15px', color: t.text ? '#232323' : '#A8A29A',
                        fontStyle: t.text ? 'normal' : 'italic',
                        textDecoration: t.done ? 'line-through' : 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
                      }}
                    >
                      {t.text || '(제목 없음)'}
                    </span>

                    {t.subtasks.length > 0 && (
                      <span className="mono" style={{ fontSize: '11px', color: '#A8A29A', flexShrink: 0 }}>
                        {subDone}/{t.subtasks.length}
                      </span>
                    )}
                  </div>

                  {dateLabelText && (
                    <span className="mono" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', background: tone.bg, color: tone.fg, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {dateLabelText}
                    </span>
                  )}

                  <button
                    onClick={() => toggleExpand(t.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '8px', color: '#A8A29A', flexShrink: 0 }}
                    aria-label="하위 할 일 보기"
                  >
                    {t.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>

                {t.expanded && (
                  <div className="expand-panel" style={{ paddingLeft: '32px', paddingBottom: '12px' }}>
                    <SubtaskList
                      subtasks={t.subtasks}
                      onToggle={(subId) => toggleSubtask(t.id, subId)}
                      onRemove={(subId) => removeSubtask(t.id, subId)}
                      draft={subDrafts[t.id] || ''}
                      onDraftChange={(v) => setSubDrafts((prev) => ({ ...prev, [t.id]: v }))}
                      onAdd={() => { addSubtask(t.id, subDrafts[t.id] || ''); setSubDrafts((prev) => ({ ...prev, [t.id]: '' })); }}
                      compact
                    />
                  </div>
                )}

                {i < visibleTasks.length - 1 && <div style={{ borderBottom: '1px dotted #D9D5C7' }} />}
              </div>
            );
          })}

          {visibleTasks.length === 0 && (
            <div className="mono" style={{ textAlign: 'center', padding: '32px 0', color: '#A8A29A', fontSize: '13px' }}>
              {viewMode === 'all' ? '등록된 할 일이 없습니다' : '이 날짜에 등록된 할 일이 없습니다'}
            </div>
          )}
        </div>

        {/* Add task */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', borderTop: '1px solid #E3E0D5', paddingTop: '14px' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
            placeholder={viewMode === 'date' ? `${formatDate(selectedDate)}에 할 일 추가` : '할 일 추가'}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#232323', fontFamily: 'Inter, system-ui, sans-serif' }}
          />
          <button
            onClick={addTask}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#232323', color: '#F6F4ED', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            aria-label="추가"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <TaskDetailModal
        task={editingTask}
        subDraft={modalSubDraft}
        onSubDraftChange={setModalSubDraft}
        onClose={closeModal}
        onChange={(patch) => updateTask(editingTaskId, patch)}
        onDelete={() => { removeTask(editingTaskId); closeModal(); }}
        onToggleSubtask={(subId) => toggleSubtask(editingTaskId, subId)}
        onRemoveSubtask={(subId) => removeSubtask(editingTaskId, subId)}
        onAddSubtask={() => { addSubtask(editingTaskId, modalSubDraft); setModalSubDraft(''); }}
      />
    </div>
  );
}
