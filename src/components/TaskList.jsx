// 할 일 목록 — visibleTasks를 TaskRow로 렌더. 드래그 드롭 라인 위치 계산은 부모가 넘긴 dropIndex 사용.
// 비어 있으면 안내 문구. 제스처/상태는 부모 소유 — 여기선 매핑과 prop 전달만.
import { C } from '../styles/tokens';
import TaskRow from './TaskRow';

export default function TaskList({
  tasks, viewMode, dragInfo, dropIndex, selectedIds, onRowRef,
  subDrafts, subtaskOrders, rowHandlers,
}) {
  return (
    <div>
      {tasks.map((t, i) => (
        <TaskRow
          key={t.id}
          task={t}
          selected={selectedIds.has(t.id)}
          isDragging={dragInfo && dragInfo.id === t.id}
          showDropLineAbove={!!dragInfo && dropIndex === i}
          showDropLineBelow={!!dragInfo && dropIndex === tasks.length && i === tasks.length - 1}
          showDivider={i < tasks.length - 1}
          rowRef={(el) => onRowRef(t.id, el)}
          subDraft={subDrafts[t.id] || ''}
          subtaskOrder={subtaskOrders[t.id]}
          onToggleTask={rowHandlers.onToggleTask}
          onTextClick={rowHandlers.onTextClick}
          onStartPress={rowHandlers.onStartPress}
          onPressEnd={rowHandlers.onPressEnd}
          onPressMove={rowHandlers.onPressMove}
          onCancelPress={rowHandlers.onCancelPress}
          onOpenDateChip={rowHandlers.onOpenDateChip}
          onToggleExpand={rowHandlers.onToggleExpand}
          onSubDraftChange={(v) => rowHandlers.onSubDraftChange(t.id, v)}
          onToggleSubtask={(subId) => rowHandlers.onToggleSubtask(t.id, subId)}
          onRemoveSubtask={(subId) => rowHandlers.onRemoveSubtask(t.id, subId)}
          onAddSubtask={() => rowHandlers.onAddSubtask(t.id)}
          onReorderSubtasks={(newIds) => rowHandlers.onReorderSubtasks(t.id, newIds)}
        />
      ))}

      {tasks.length === 0 && (
        <div className="mono" style={{ textAlign: 'center', padding: '32px 0', color: C.mute, fontSize: '13px' }}>
          {viewMode === 'all' ? '등록된 할 일이 없습니다' : '이 날짜에 등록된 할 일이 없습니다'}
        </div>
      )}
    </div>
  );
}
