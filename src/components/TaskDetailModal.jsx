// 할 일 세부 바텀 시트(슬라이드 업) — 제목/세부정보/시작·종료 날짜/하위 할 일 편집.
// 새 할 일 모드(isNew)면 추가/취소, 기존 모드면 완료/삭제.
// 내부 날짜 picker는 CalendarSheet 재사용(zIndex picker, 백드롭 0.5).
import { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { C, Z } from '../styles/tokens';
import { monthStartOf } from '../utils/date';
import LabeledDateField from './LabeledDateField';
import SubtaskList from './SubtaskList';
import CalendarSheet from './CalendarSheet';

export default function TaskDetailModal({ task, isNew, subDraft, onSubDraftChange, onClose, onCancel, onSave, onChange, onDelete, onToggleSubtask, onRemoveSubtask, onAddSubtask }) {
  const notesRef = useRef(null);
  const titleRef = useRef(null);
  const [pickerField, setPickerField] = useState(null);

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

  const pickerIso = pickerField === 'date' ? task.date : task.dueDate;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(35,35,35,0.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: Z.sheet }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-rise sans"
        style={{ background: C.surface, width: '100%', maxWidth: '380px', borderRadius: '18px 18px 0 0', padding: '10px 20px 26px', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box' }}
      >
        <div style={{ width: '36px', height: '4px', background: C.border, borderRadius: '2px', margin: '0 auto 18px' }} />

        <input
          ref={titleRef}
          value={task.text}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && isNew) onSave(); }}
          placeholder="할 일 제목"
          style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '19px', fontWeight: 600, color: C.ink, marginBottom: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />

        <textarea
          ref={notesRef}
          value={task.notes || ''}
          onChange={handleNotesInput}
          placeholder="세부정보 추가"
          rows={2}
          style={{
            width: '100%', border: 'none', borderBottom: `1px solid ${C.borderSoft}`, background: 'transparent', outline: 'none',
            fontSize: '14px', color: C.ink, resize: 'none', overflow: 'hidden', minHeight: '40px',
            paddingBottom: '10px', marginBottom: '10px', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
          <LabeledDateField label="시작날짜" iso={task.date} onOpen={() => setPickerField('date')} onClear={() => onChange({ date: null })} />
          <LabeledDateField label="종료날짜" iso={task.dueDate} onOpen={() => setPickerField('dueDate')} onClear={() => onChange({ dueDate: null })} />
        </div>
        <div className="mono" style={{ fontSize: '10px', color: C.mute, marginBottom: '18px' }}>
          시작날짜와 종료날짜를 다르게 설정하면 그 사이 모든 날에 표시됩니다
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div className="mono" style={{ fontSize: '11px', color: C.label, marginBottom: '8px', letterSpacing: '0.06em' }}>
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
            onClick={isNew ? onSave : onClose}
            className="mono"
            style={{
              flex: 1, padding: '12px', borderRadius: '999px', border: 'none',
              background: C.ink, color: C.inkInv,
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            {isNew ? '추가하기' : '작성완료'}
          </button>
          {isNew ? (
            <button
              onClick={onCancel}
              className="mono"
              style={{ padding: '0 16px', borderRadius: '999px', border: `1px solid ${C.border}`, background: 'transparent', color: C.label, fontSize: '13px', cursor: 'pointer' }}
            >
              취소
            </button>
          ) : (
            <button
              onClick={onDelete}
              style={{ padding: '0 14px', borderRadius: '999px', border: `1px solid ${C.dangerBorder}`, background: 'transparent', color: C.danger, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              aria-label="할 일 삭제"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {pickerField && (
          <CalendarSheet
            onClose={() => setPickerField(null)}
            selectedDate={pickerIso || ''}
            tasks={[]}
            onSelect={(iso) => { onChange({ [pickerField]: iso }); setPickerField(null); }}
            initialMonth={monthStartOf(pickerIso)}
            zIndex={Z.picker}
            backdrop={0.5}
          />
        )}
      </div>
    </div>
  );
}
