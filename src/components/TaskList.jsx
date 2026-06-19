// 할 일 목록 — visibleTasks를 TaskRow로 렌더.
// 드래그 중: 드래그 행은 손가락을 따라 떠오르고(dragOffset), 나머지는 드롭 위치에 맞춰 밀려난다(shift).
//   - 아래로 끌면 (from < i < dropIndex) 구간 행이 위로 한 칸(=드래그 행 높이)
//   - 위로 끌면 (dropIndex <= i < from) 구간 행이 아래로 한 칸
// 측정은 hook이 바깥 래퍼로만 하므로 이 시각 이동은 판정에 영향 없음.
import { C } from '../styles/tokens';
import TaskRow from './TaskRow';

export default function TaskList({
  tasks, viewMode, dragInfo, dropIndex, settlingId, selectedIds,
  subDrafts, subtaskOrders, rowHandlers,
}) {
  const anyDragging = !!dragInfo;
  return (
    <div>
      {tasks.map((t, i) => {
        const isDragging = anyDragging && dragInfo.id === t.id;
        let shift = 0;
        if (anyDragging && !isDragging && dropIndex >= 0) {
          const from = dragInfo.originalIndex;
          const to = dropIndex;
          if (from < i && i < to) shift = -dragInfo.height;
          else if (to <= i && i < from) shift = dragInfo.height;
        }
        return (
          <TaskRow
            key={t.id}
            task={t}
            selected={selectedIds.has(t.id)}
            isDragging={isDragging}
            anyDragging={anyDragging}
            shift={shift}
            dragOffset={isDragging ? dragInfo.offsetY : 0}
            justDropped={settlingId === t.id}
            showDivider={i < tasks.length - 1 && !anyDragging}
            subDraft={subDrafts[t.id] || ''}
            subtaskOrder={subtaskOrders[t.id]}
            onToggleTask={rowHandlers.onToggleTask}
            onTextClick={rowHandlers.onTextClick}
            onOpenDateChip={rowHandlers.onOpenDateChip}
            onToggleExpand={rowHandlers.onToggleExpand}
            onSubDraftChange={(v) => rowHandlers.onSubDraftChange(t.id, v)}
            onToggleSubtask={(subId) => rowHandlers.onToggleSubtask(t.id, subId)}
            onRemoveSubtask={(subId) => rowHandlers.onRemoveSubtask(t.id, subId)}
            onAddSubtask={() => rowHandlers.onAddSubtask(t.id)}
            onReorderSubtasks={(newIds) => rowHandlers.onReorderSubtasks(t.id, newIds)}
          />
        );
      })}

      {tasks.length === 0 && (
        <div className="mono" style={{ textAlign: 'center', padding: '32px 0', color: C.mute, fontSize: '13px' }}>
          {viewMode === 'all' ? '등록된 할 일이 없습니다' : '이 날짜에 등록된 할 일이 없습니다'}
        </div>
      )}
    </div>
  );
}
