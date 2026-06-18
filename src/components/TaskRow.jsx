// 할 일 한 줄 — 체크박스 + 제목/하위카운트 + 날짜칩 + 펼치기. 펼치면 SubtaskList.
// 제스처(롱프레스→다중선택/드래그)는 부모가 넘긴 핸들러를 그대로 연결한다(로직은 부모/4단계 hook).
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { C } from '../styles/tokens';
import { toneStyle, rowDateLabel } from '../utils/date';
import DateChip from './DateChip';
import SubtaskList from './SubtaskList';

// subtaskOrder(id 배열)가 있으면 그 순서로, 없으면 원래 순서로.
function orderSubtasks(subtasks, order) {
  if (!order) return subtasks;
  const inOrder = order.map((id) => subtasks.find((s) => s.id === id)).filter(Boolean);
  const rest = subtasks.filter((s) => !order.includes(s.id));
  return [...inOrder, ...rest];
}

export default function TaskRow({
  task, selected, isDragging, showDropLineAbove, showDropLineBelow, showDivider,
  onToggleTask, onTextClick, onOpenDateChip, onToggleExpand,
  subDraft, onSubDraftChange, subtaskOrder, onToggleSubtask, onRemoveSubtask, onAddSubtask, onReorderSubtasks,
}) {
  const t = task;
  const subDone = t.subtasks.filter((s) => s.done).length;
  const tone = toneStyle(t.dueDate);
  const dateLabelText = rowDateLabel(t);

  // data-task-id: 컨테이너 단일 제스처 hook이 눌린 행을 식별하고 위치를 측정하는 기준.
  // 터치 이벤트는 더 이상 행에서 직접 처리하지 않는다(버그 A: 이중 경로 제거).
  return (
    <div data-task-id={t.id}>
      {showDropLineAbove && <div style={{ height: '2px', background: C.sage, margin: '0 6px', borderRadius: '1px' }} />}
      <div
        className="task-row"
        style={{
          display: 'flex', alignItems: 'center', padding: '12px 6px',
          margin: '0 -6px', borderRadius: '8px',
          opacity: isDragging ? 0.4 : t.done ? 0.5 : 1,
          background: isDragging ? C.selected : selected ? C.selected : 'transparent',
          borderLeft: selected ? `3px solid ${C.sage}` : '3px solid transparent',
          transform: isDragging ? 'scale(1.02)' : 'none',
        }}
      >
        <button
          onClick={() => onToggleTask(t.id)}
          style={{
            width: '22px', height: '22px', flexShrink: 0, marginRight: '10px',
            border: `1.5px solid ${t.done ? C.sage : C.mute}`,
            background: t.done ? C.sage : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
          }}
          aria-label={t.done ? '완료 취소' : '완료로 표시'}
        >
          <Check className="check-icon" size={14} color={C.inkInv} style={{ transform: t.done ? 'scale(1)' : 'scale(0)', opacity: t.done ? 1 : 0 }} />
        </button>

        <div
          onClick={() => onTextClick(t.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0,
            paddingRight: '10px', boxSizing: 'border-box', cursor: 'pointer', userSelect: 'none',
          }}
        >
          <span
            style={{
              fontSize: '15px', color: t.text ? C.ink : C.mute,
              fontStyle: t.text ? 'normal' : 'italic',
              textDecoration: t.done ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
            }}
          >
            {t.text || '(제목 없음)'}
          </span>

          {t.subtasks.length > 0 && (
            <span className="mono" style={{ fontSize: '11px', color: C.mute, flexShrink: 0 }}>
              {subDone}/{t.subtasks.length}
            </span>
          )}
        </div>

        {dateLabelText && (
          <DateChip tone={tone} label={dateLabelText} onOpen={() => onOpenDateChip(t)} />
        )}

        <button
          onClick={() => onToggleExpand(t.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '8px', color: C.mute, flexShrink: 0 }}
          aria-label="하위 할 일 보기"
        >
          {t.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {t.expanded && (
        <div className="expand-panel" style={{ paddingLeft: '32px', paddingBottom: '12px' }}>
          <SubtaskList
            subtasks={orderSubtasks(t.subtasks, subtaskOrder)}
            onToggle={onToggleSubtask}
            onRemove={onRemoveSubtask}
            draft={subDraft}
            onDraftChange={onSubDraftChange}
            onAdd={onAddSubtask}
            onReorder={onReorderSubtasks}
            compact
          />
        </div>
      )}

      {showDropLineBelow && <div style={{ height: '2px', background: C.sage, margin: '4px 6px', borderRadius: '1px' }} />}
      {showDivider && !showDropLineAbove && <div style={{ borderBottom: `1px dotted ${C.border}` }} />}
    </div>
  );
}
