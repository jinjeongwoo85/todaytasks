// 할 일 한 줄 — 체크박스 + 제목/하위카운트 + 날짜칩 + 펼치기. 펼치면 SubtaskList.
// 제스처(롱프레스→다중선택/드래그)는 컨테이너 hook이 전담. 여기선 클릭 콜백과 드래그 표현만.
//
// 드래그 표현: 바깥 래퍼(data-task-id, 측정 기준)는 절대 변형하지 않고, 안쪽 shift 래퍼에만
// transform을 준다 → hook의 드롭 판정이 흔들리지 않음.
//   - isDragging: 손가락을 따라 떠오름(translateY(dragOffset)+scale+그림자), 전환 없음(1:1 추종)
//   - 그 외: 밀려나기(translateY(shift)), 부드러운 전환
//   - justDropped: 드롭 직후 .settle 애니메이션(scale/그림자 가라앉음)
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { C } from '../styles/tokens';
import { toneStyle, rowDateLabel } from '../utils/date';
import DateChip from './DateChip';
import SubtaskList from './SubtaskList';

function orderSubtasks(subtasks, order) {
  if (!order) return subtasks;
  const inOrder = order.map((id) => subtasks.find((s) => s.id === id)).filter(Boolean);
  const rest = subtasks.filter((s) => !order.includes(s.id));
  return [...inOrder, ...rest];
}

export default function TaskRow({
  task, selected, isDragging, anyDragging, shift, dragOffset, justDropped, showDivider,
  onToggleTask, onTextClick, onOpenDateChip, onToggleExpand,
  subDraft, onSubDraftChange, subtaskOrder, onToggleSubtask, onRemoveSubtask, onAddSubtask, onReorderSubtasks,
}) {
  const t = task;
  const subDone = t.subtasks.filter((s) => s.done).length;
  const tone = toneStyle(t.dueDate);
  const dateLabelText = rowDateLabel(t);

  // 안쪽 shift 래퍼 스타일 (transform은 여기에만)
  const shiftStyle = isDragging
    ? {
        position: 'relative', zIndex: 8,
        transform: `translateY(${dragOffset}px) scale(1.03)`,
        transition: 'none',
        boxShadow: '0 10px 28px rgba(35,35,35,0.22)',
        background: C.bg, borderRadius: '12px',
      }
    : {
        position: 'relative', zIndex: shift ? 1 : 'auto',
        transform: shift ? `translateY(${shift}px)` : 'none',
        transition: anyDragging ? 'transform 0.18s ease' : 'none',
      };

  return (
    <div data-task-id={t.id}>
      <div className={justDropped ? 'settle' : undefined} style={shiftStyle}>
        <div
          className="task-row"
          style={{
            display: 'flex', alignItems: 'center', padding: '12px 6px',
            margin: '0 -6px', borderRadius: '8px',
            opacity: t.done ? 0.5 : 1,
            background: selected ? C.selected : 'transparent',
            borderLeft: selected ? `3px solid ${C.sage}` : '3px solid transparent',
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
          // data-list-subtasks: 하위 영역은 자체 드래그(useReorderDrag) 사용 → 컨테이너 제스처가
          // 이 안의 터치를 부모 누름으로 오인하지 않게 표시.
          // 선택 시 하위 할일 영역까지 같은 음영(부모 헤더와 같은 폭으로 맞춤).
          <div
            className="expand-panel"
            data-list-subtasks
            style={{
              margin: '0 -6px', paddingLeft: '38px', paddingRight: '6px', paddingBottom: '12px',
              boxSizing: 'border-box',
              background: selected ? C.selected : 'transparent',
              borderRadius: selected ? '0 0 8px 8px' : 0,
            }}
          >
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
      </div>

      {showDivider && <div style={{ borderBottom: `1px dotted ${C.border}` }} />}
    </div>
  );
}
