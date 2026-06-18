import { useState, useRef, useEffect } from 'react';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useTasks } from './hooks/useTasks';
import {
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CornerDownRight,
  Calendar as CalendarIcon,
  X,
  Eye,
  EyeOff,
  Settings,
} from 'lucide-react';

const todayDate = new Date();
const tomorrowDate = new Date(todayDate);
tomorrowDate.setDate(todayDate.getDate() + 1);

const toISO = (d) => d.toISOString().split('T')[0];
const TODAY_ISO = toISO(todayDate);
const TOMORROW_ISO = toISO(tomorrowDate);
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const formatDate = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}.${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
};
const formatShort = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}.${d.getDate()}`;
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


function MonthCalendar({ monthDate, selectedDate, tasks, onSelect, onPrevMonth, onNextMonth, onToday }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{
      background: '#FAF8F3', border: '1px solid #E3E0D5', borderRadius: '16px',
      padding: '16px 14px 14px',
    }}>
      {/* 월 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={onPrevMonth} style={{ background: '#EFECE4', border: 'none', cursor: 'pointer', color: '#6B6862', padding: '6px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }} aria-label="이전 달">
          <ChevronLeft size={16} />
        </button>
        <span className="sans" style={{ fontSize: '15px', fontWeight: 700, color: '#232323', letterSpacing: '-0.01em' }}>
          {year}년 {month + 1}월
        </span>
        <button onClick={onNextMonth} style={{ background: '#EFECE4', border: 'none', cursor: 'pointer', color: '#6B6862', padding: '6px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }} aria-label="다음 달">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 요일 레이블 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '6px' }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="mono" style={{
            textAlign: 'center', fontSize: '11px', fontWeight: 500,
            color: i === 0 ? '#C0624A' : i === 6 ? '#6080A8' : '#B0A99E',
            paddingBottom: '2px',
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: '4px' }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dow = new Date(iso + 'T00:00:00').getDay();
          const isToday = iso === TODAY_ISO;
          const isSelected = iso === selectedDate;
          const hasTasks = tasks.some((t) => isTaskOnDate(t, iso));

          const bg = isSelected ? '#232323' : isToday ? '#E3EBE0' : 'transparent';
          const textColor = isSelected ? '#F6F4ED'
            : isToday ? '#3D5B3F'
            : dow === 0 ? '#C0624A'
            : dow === 6 ? '#6080A8'
            : '#232323';

          return (
            <button
              key={idx}
              onClick={() => onSelect(iso)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                aspectRatio: '1', borderRadius: '12px', margin: '1px',
                border: 'none', background: bg, cursor: 'pointer', padding: 0,
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: isSelected || isToday ? 600 : 400, color: textColor, lineHeight: 1 }}>
                {day}
              </span>
              <span style={{
                width: '4px', height: '4px', borderRadius: '50%', marginTop: '3px',
                background: hasTasks ? (isSelected ? '#A8C4AA' : '#5C7A5C') : 'transparent',
              }} />
            </button>
          );
        })}
      </div>

      {/* 오늘로 이동 */}
      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onToday}
          className="mono"
          style={{
            fontSize: '11px', color: '#4D6B4F', background: '#E3EBE0',
            border: 'none', cursor: 'pointer', padding: '5px 14px', borderRadius: '999px',
          }}
        >
          오늘로 이동
        </button>
      </div>
    </div>
  );
}

function LabeledDateField({ label, iso, onOpen, onClear }) {
  const tone = toneStyle(iso);
  return (
    <div style={{ flex: 1 }}>
      <div className="mono" style={{ fontSize: '10px', color: '#8B8780', marginBottom: '4px' }}>{label}</div>
      <div
        className="mono"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen(); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '13px', padding: '8px', borderRadius: '8px', boxSizing: 'border-box', cursor: 'pointer',
          background: tone.bg, color: iso ? tone.fg : '#A8A29A', border: `1px solid ${iso ? tone.border : '#D9D5C7'}`,
        }}
      >
        <span>{iso ? formatDate(iso) : '설정 안함'}</span>
        {iso && (
          <X size={12} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClear(); }} />
        )}
      </div>
    </div>
  );
}

function DateChip({ tone, label, onOpen }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen(); }}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{ flexShrink: 0, cursor: 'pointer', position: 'relative' }}
    >
      <span className="mono" style={{ display: 'block', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', background: tone.bg, color: tone.fg, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}


function SubtaskList({ subtasks, onToggle, onRemove, draft, onDraftChange, onAdd, compact, onReorder }) {
  const [subDrag, setSubDrag] = useState(null);
  const rowRefs = useRef({});

  const startSubDrag = (id, clientY, idx) => {
    setSubDrag({ id, startY: clientY, currentY: clientY, originalIndex: idx });
  };
  const updateSubDrag = (clientY) => {
    setSubDrag((prev) => prev ? { ...prev, currentY: clientY } : null);
  };
  const computeSubDrop = (clientY) => {
    let idx = subtasks.length;
    for (let i = 0; i < subtasks.length; i++) {
      const el = rowRefs.current[subtasks[i].id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) { idx = i; break; }
    }
    return idx;
  };
  const commitSubDrag = (clientY) => {
    if (!subDrag) return;
    const from = subDrag.originalIndex;
    const to = computeSubDrop(clientY);
    if (from !== to && to !== from + 1 && onReorder) {
      const newIds = subtasks.map((s) => s.id);
      const [moved] = newIds.splice(from, 1);
      newIds.splice(to > from ? to - 1 : to, 0, moved);
      onReorder(newIds);
    }
    setSubDrag(null);
  };

  const LONG_PRESS = 450;
  const subPressTimer = useRef(null);
  const subLongFired = useRef(false);
  const subPressPos = useRef({ x: 0, y: 0 });

  const startSubPress = (id, idx, e) => {
    subLongFired.current = false;
    const pt = e.touches ? e.touches[0] : e;
    subPressPos.current = { x: pt.clientX, y: pt.clientY };
    subPressTimer.current = setTimeout(() => {
      subLongFired.current = true;
      startSubDrag(id, pt.clientY, idx);
    }, LONG_PRESS);
  };
  const cancelSubPress = () => {
    if (subPressTimer.current) { clearTimeout(subPressTimer.current); subPressTimer.current = null; }
  };
  const moveSubPress = (e) => {
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - subPressPos.current.x;
    const dy = pt.clientY - subPressPos.current.y;
    if (!subDrag && Math.sqrt(dx * dx + dy * dy) > 10) cancelSubPress();
    if (subDrag) { e.preventDefault(); updateSubDrag(pt.clientY); }
  };
  const endSubPress = (e) => {
    cancelSubPress();
    if (subDrag) {
      const pt = e.changedTouches ? e.changedTouches[0] : e;
      commitSubDrag(pt.clientY);
    }
  };

  const dropIndex = subDrag ? computeSubDrop(subDrag.currentY) : -1;

  return (
    <div>
      {subtasks.map((s, idx) => {
        const isDragging = subDrag && subDrag.id === s.id;
        const showLineAbove = subDrag && dropIndex === idx;
        const showLineBelow = subDrag && dropIndex === subtasks.length && idx === subtasks.length - 1;
        return (
          <div key={s.id} ref={(el) => { rowRefs.current[s.id] = el; }}>
            {showLineAbove && <div style={{ height: '2px', background: '#5C7A5C', borderRadius: '1px', margin: '2px 0' }} />}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: compact ? '5px 0' : '6px 0', opacity: isDragging ? 0.4 : 1 }}
              onTouchStart={(e) => startSubPress(s.id, idx, e)}
              onTouchMove={moveSubPress}
              onTouchEnd={endSubPress}
            >
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
            {showLineBelow && <div style={{ height: '2px', background: '#5C7A5C', borderRadius: '1px', margin: '2px 0' }} />}
          </div>
        );
      })}
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

function TaskDetailModal({ task, isNew, subDraft, onSubDraftChange, onClose, onSave, onChange, onDelete, onToggleSubtask, onRemoveSubtask, onAddSubtask }) {
  const notesRef = useRef(null);
  const titleRef = useRef(null);
  const [pickerField, setPickerField] = useState(null);
  const [pickerMonth, setPickerMonth] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));

  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = notesRef.current.scrollHeight + 'px';
    }
    if (isNew && titleRef.current) {
      titleRef.current.focus();
    }
  }, [task?.id, isNew]);

  if (!task) return null;

  const handleNotesInput = (e) => {
    onChange({ notes: e.target.value });
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const openPicker = (field) => {
    const iso = field === 'date' ? task.date : task.dueDate;
    const d = iso ? new Date(iso + 'T00:00:00') : todayDate;
    setPickerMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setPickerField(field);
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
          ref={titleRef}
          value={task.text}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && isNew) onSave(); }}
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
          <LabeledDateField label="시작날짜" iso={task.date} onOpen={() => openPicker('date')} onClear={() => onChange({ date: null })} />
          <LabeledDateField label="종료날짜" iso={task.dueDate} onOpen={() => openPicker('dueDate')} onClear={() => onChange({ dueDate: null })} />
        </div>
        <div className="mono" style={{ fontSize: '10px', color: '#A8A29A', marginBottom: '18px' }}>
          시작날짜와 종료날짜를 다르게 설정하면 그 사이 모든 날에 표시됩니다
        </div>

        {!isNew && (
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
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={isNew ? onSave : onClose}
            className="mono"
            style={{
              flex: 1, padding: '12px', borderRadius: '999px', border: 'none',
              background: '#232323', color: '#F6F4ED',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            {isNew ? '추가하기' : '세부내용 작성완료'}
          </button>
          {isNew ? (
            <button
              onClick={onClose}
              className="mono"
              style={{ padding: '0 16px', borderRadius: '999px', border: '1px solid #D9D5C7', background: 'transparent', color: '#8B8780', fontSize: '13px', cursor: 'pointer' }}
            >
              취소
            </button>
          ) : (
            <button
              onClick={onDelete}
              style={{ padding: '0 14px', borderRadius: '999px', border: '1px solid #E3B8A8', background: 'transparent', color: '#B5562F', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              aria-label="할 일 삭제"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {pickerField && (
          <div
            onClick={() => setPickerField(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(35,35,35,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 60 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="sheet-rise sans"
              style={{ width: '100%', maxWidth: '480px', background: '#F6F4ED', borderRadius: '20px 20px 0 0', padding: '10px 20px 32px', boxSizing: 'border-box' }}
            >
              <div style={{ width: '36px', height: '4px', background: '#D9D5C7', borderRadius: '2px', margin: '0 auto 12px' }} />
              <MonthCalendar
                monthDate={pickerMonth}
                selectedDate={(pickerField === 'date' ? task.date : task.dueDate) || ''}
                tasks={[]}
                onSelect={(iso) => { onChange({ [pickerField]: iso }); setPickerField(null); }}
                onPrevMonth={() => setPickerMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                onNextMonth={() => setPickerMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                onToday={() => { setPickerMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); onChange({ [pickerField]: TODAY_ISO }); setPickerField(null); }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TodayTasks() {
  const [draft, setDraft] = useState('');
  const [subDrafts, setSubDrafts] = useState({});
  const [viewMode, setViewMode] = useState('date');
  const [selectedDate, setSelectedDate] = useState(TODAY_ISO);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [modalSubDraft, setModalSubDraft] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [newTaskDraft, setNewTaskDraft] = useState(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [datePickerTask, setDatePickerTask] = useState(null);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [copyPickerMonth, setCopyPickerMonth] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
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
    if (selectedDate === TODAY_ISO) return `오늘 - ${formatDate(TODAY_ISO)}`;
    if (selectedDate === TOMORROW_ISO) return `내일 - ${formatDate(TOMORROW_ISO)}`;
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onStart = (e) => swipeHandlersRef.current.start(e);
    const onMove = (e) => swipeHandlersRef.current.move(e);
    const onEnd = (e) => swipeHandlersRef.current.end(e);
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => {
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

  if (isSilentTrying || loading) {
    return <div style={{ minHeight: '100vh', background: '#F6F4ED' }} />;
  }

  if (!isSignedIn) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F6F4ED', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');`}</style>
        <div className="mono" style={{ fontSize: '26px', fontWeight: 600, color: '#232323', marginBottom: '8px', letterSpacing: '-0.02em' }}>TodayTasks</div>
        <div style={{ fontSize: '13px', color: '#A8A29A', marginBottom: '48px' }}>오늘 할 일을 Google Tasks와 함께 관리하세요</div>
        <button
          onClick={signIn}
          disabled={!isReady}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '13px 28px', borderRadius: '999px',
            border: '1px solid #D9D5C7', background: '#FFFFFF',
            fontSize: '15px', color: '#232323', cursor: isReady ? 'pointer' : 'default',
            opacity: isReady ? 1 : 0.4, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          Google로 로그인
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ background: '#F6F4ED', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}
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
        {/* Sticky header: date selector + progress bar always visible */}
        <div style={{ position: 'sticky', top: 0, background: '#F6F4ED', zIndex: 10, paddingTop: '32px', paddingBottom: '4px' }}>
        {isOffline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', marginBottom: '10px', borderRadius: '10px', background: '#EDE8DC', color: '#6B6862', fontSize: '12px' }}>
            <span>●</span> 오프라인 — 저장된 데이터를 표시 중
          </div>
        )}
        {/* Date selector / selection action row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '6px' }}>
          <button onClick={openCalendar} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: '#232323', minWidth: 0 }}>
            <CalendarIcon size={16} color="#5C7A5C" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '19px', fontWeight: 600, whiteSpace: 'nowrap' }}>{dateLabel()}</span>
            <ChevronDown size={16} color="#A8A29A" style={{ transform: calendarOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', flexShrink: 0 }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {selectedIds.size > 0 ? (
              <>
                <span className="mono" style={{ fontSize: '11px', color: '#5C7A5C', whiteSpace: 'nowrap' }}>{selectedIds.size}개 선택</span>
                <button
                  onClick={() => { setCopyPickerMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); setCopyPickerOpen(true); }}
                  className="mono"
                  style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '10px', background: 'transparent', color: '#8B8780', border: '1px solid #D9D5C7', cursor: 'pointer' }}
                >
                  복사
                </button>
                <button
                  onClick={deleteSelected}
                  className="mono"
                  style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '10px', background: 'transparent', color: '#B5562F', border: '1px solid #F3E0D8', cursor: 'pointer' }}
                >
                  삭제
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="mono"
                  style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '10px', background: 'transparent', color: '#8B8780', border: '1px solid #D9D5C7', cursor: 'pointer' }}
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setHideCompleted((v) => !v)}
                  title={hideCompleted ? '완료된 할일 보기' : '완료된 할일 숨기기'}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: hideCompleted ? '#E3EBE0' : 'transparent', border: hideCompleted ? 'none' : '1px solid #D9D5C7', cursor: 'pointer', color: hideCompleted ? '#4D6B4F' : '#8B8780' }}
                >
                  {hideCompleted ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
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
                <button
                  onClick={() => setSettingsOpen(true)}
                  title="설정"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: 'transparent', border: '1px solid #E3E0D5', cursor: 'pointer', color: '#C0B9B0' }}
                >
                  <Settings size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
            <span className="mono" style={{ fontSize: '15px', color: '#5C7A5C', fontWeight: 600 }}>
              {String(completed).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
          <div style={{ height: '6px', background: '#E3E0D5', width: '100%' }}>
            <div className="progress-fill" style={{ height: '100%', width: `${pct}%`, background: '#5C7A5C' }} />
          </div>
        </div>
        </div>{/* end sticky header */}

        {/* Task list */}
        <div>
          {(() => {
            const dropIndex = dragInfo ? computeDropIndex(dragInfo.currentY) : -1;
            return visibleTasks.map((t, i) => {
            const subDone = t.subtasks.filter((s) => s.done).length;
            const tone = toneStyle(t.dueDate);
            const dateLabelText = rowDateLabel(t);
            const selected = selectedIds.has(t.id);
            const isDragging = dragInfo && dragInfo.id === t.id;
            const showDropLineAbove = dragInfo && dropIndex === i;
            const showDropLineBelow = dragInfo && dropIndex === visibleTasks.length && i === visibleTasks.length - 1;
            return (
              <div key={t.id} ref={(el) => { taskRowRefs.current[t.id] = el; }}>
                {showDropLineAbove && <div style={{ height: '2px', background: '#5C7A5C', margin: '0 6px', borderRadius: '1px' }} />}
                <div
                  className="task-row"
                  style={{
                    display: 'flex', alignItems: 'center', padding: '12px 6px',
                    margin: '0 -6px', borderRadius: '8px',
                    opacity: isDragging ? 0.4 : t.done ? 0.5 : 1,
                    background: isDragging ? '#EAE7DC' : selected ? '#EAE7DC' : 'transparent',
                    borderLeft: selected ? '3px solid #5C7A5C' : '3px solid transparent',
                    transform: isDragging ? 'scale(1.02)' : 'none',
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
                    onTouchEnd={() => handlePressEnd(t.id)}
                    onTouchMove={handlePressMove}
                    onMouseDown={(e) => startPress(t.id, e)}
                    onMouseUp={() => handlePressEnd(t.id)}
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
                    <DateChip
                      tone={tone}
                      label={dateLabelText}
                      onOpen={() => {
                        const d = t.dueDate ? new Date(t.dueDate + 'T00:00:00') : todayDate;
                        setDatePickerMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                        setDatePickerTask({ id: t.id, iso: t.dueDate });
                      }}
                    />
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
                      subtasks={(() => {
                        const order = subtaskOrders[t.id];
                        if (!order) return t.subtasks;
                        const inOrder = order.map((id) => t.subtasks.find((s) => s.id === id)).filter(Boolean);
                        const rest = t.subtasks.filter((s) => !order.includes(s.id));
                        return [...inOrder, ...rest];
                      })()}
                      onToggle={(subId) => toggleSubtask(t.id, subId)}
                      onRemove={(subId) => removeSubtask(t.id, subId)}
                      draft={subDrafts[t.id] || ''}
                      onDraftChange={(v) => setSubDrafts((prev) => ({ ...prev, [t.id]: v }))}
                      onAdd={() => { addSubtask(t.id, subDrafts[t.id] || ''); setSubDrafts((prev) => ({ ...prev, [t.id]: '' })); }}
                      onReorder={(newIds) => reorderSubtasks(t.id, newIds)}
                      compact
                    />
                  </div>
                )}

                {showDropLineBelow && <div style={{ height: '2px', background: '#5C7A5C', margin: '4px 6px', borderRadius: '1px' }} />}
                {i < visibleTasks.length - 1 && !showDropLineAbove && <div style={{ borderBottom: '1px dotted #D9D5C7' }} />}
              </div>
            );
          });
          })()}

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
            onClick={openNewTask}
            style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#232323', color: '#F6F4ED', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            aria-label="추가"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {calendarOpen && (
        <div
          onClick={() => setCalendarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(35,35,35,0.38)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-rise sans"
            style={{ width: '100%', maxWidth: '480px', background: '#F6F4ED', borderRadius: '20px 20px 0 0', padding: '10px 20px 32px', boxSizing: 'border-box' }}
          >
            <div style={{ width: '36px', height: '4px', background: '#D9D5C7', borderRadius: '2px', margin: '0 auto 12px' }} />
            <MonthCalendar
              monthDate={calendarMonth}
              selectedDate={selectedDate}
              tasks={tasks}
              onSelect={selectFromCalendar}
              onPrevMonth={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
              onNextMonth={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
              onToday={jumpToday}
            />
          </div>
        </div>
      )}

      {datePickerTask && (
        <div
          onClick={() => setDatePickerTask(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(35,35,35,0.38)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-rise sans"
            style={{ width: '100%', maxWidth: '480px', background: '#F6F4ED', borderRadius: '20px 20px 0 0', padding: '10px 20px 32px', boxSizing: 'border-box' }}
          >
            <div style={{ width: '36px', height: '4px', background: '#D9D5C7', borderRadius: '2px', margin: '0 auto 12px' }} />
            <MonthCalendar
              monthDate={datePickerMonth}
              selectedDate={datePickerTask.iso || ''}
              tasks={tasks}
              onSelect={(iso) => {
                updateTask(datePickerTask.id, { dueDate: iso });
                setDatePickerTask(null);
              }}
              onPrevMonth={() => setDatePickerMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
              onNextMonth={() => setDatePickerMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
              onToday={() => {
                setDatePickerMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
                updateTask(datePickerTask.id, { dueDate: TODAY_ISO });
                setDatePickerTask(null);
              }}
            />
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(35,35,35,0.38)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-rise sans"
            style={{ width: '100%', maxWidth: '480px', background: '#F6F4ED', borderRadius: '20px 20px 0 0', padding: '10px 20px 40px', boxSizing: 'border-box' }}
          >
            <div style={{ width: '36px', height: '4px', background: '#D9D5C7', borderRadius: '2px', margin: '0 auto 20px' }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#232323', marginBottom: '20px' }}>설정</div>
            <button
              onClick={() => { signOut(); setSettingsOpen(false); }}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #E3E0D5', background: '#FAF8F3', color: '#B5562F', fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}
            >
              로그아웃
            </button>
          </div>
        </div>
      )}

      {copyPickerOpen && (
        <div
          onClick={() => setCopyPickerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(35,35,35,0.38)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 40 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-rise sans"
            style={{ width: '100%', maxWidth: '480px', background: '#F6F4ED', borderRadius: '20px 20px 0 0', padding: '10px 20px 32px', boxSizing: 'border-box' }}
          >
            <div style={{ width: '36px', height: '4px', background: '#D9D5C7', borderRadius: '2px', margin: '0 auto 12px' }} />
            <div className="mono" style={{ fontSize: '11px', color: '#8B8780', marginBottom: '12px', textAlign: 'center' }}>복사할 날짜를 선택하세요</div>
            <MonthCalendar
              monthDate={copyPickerMonth}
              selectedDate={selectedDate}
              tasks={tasks}
              onSelect={copySelectedTo}
              onPrevMonth={() => setCopyPickerMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
              onNextMonth={() => setCopyPickerMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
              onToday={() => { setCopyPickerMonth(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); copySelectedTo(TODAY_ISO); }}
            />
          </div>
        </div>
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
