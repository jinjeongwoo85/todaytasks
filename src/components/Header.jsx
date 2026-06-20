// 상단 sticky 헤더 — 오프라인 배너 + 날짜 선택/다중선택 액션 행 + 진행률 바.
import { Calendar as CalendarIcon, Book, BookOpen, SquareCheck, Settings } from 'lucide-react';
import { C, Z } from '../styles/tokens';
import ProgressBar from './ProgressBar';

// 체크네모 전체에 사선(빗금)을 그어 "완료 숨김"을 나타내는 아이콘.
// lucide SquareSlash는 사선이 작아, EyeOff처럼 아이콘 전체를 가로지르도록 직접 합성한다.
// bg = 버튼 배경색(사선 양옆에 틈을 만들어 체크 획과 분리).
function CheckSlash({ size = 14, bg }) {
  const h = size + 6;
  const line = { position: 'absolute', left: '50%', top: '50%', height: h, transform: 'translate(-50%, -50%) rotate(-45deg)' };
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <SquareCheck size={size} />
      <span style={{ ...line, width: '3px', background: bg }} />
      <span style={{ ...line, width: '1.5px', background: 'currentColor' }} />
    </span>
  );
}

export default function Header({
  isOffline, dateLabel, onOpenCalendar,
  selectionMode, selectedCount, onCopy, onDeleteSelected, onClearSelection,
  hideCompleted, onToggleHideCompleted, allSubsExpanded, hasExpandable, onToggleAllSubtasks,
  viewMode, onToggleViewMode, onOpenSettings,
  completed, total, pct,
}) {
  return (
    <div style={{ position: 'sticky', top: 0, background: C.bg, zIndex: Z.stickyHeader, paddingTop: '32px', paddingBottom: '4px' }}>
      {isOffline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', marginBottom: '10px', borderRadius: '10px', background: C.offlineBg, color: C.sub, fontSize: '12px' }}>
          <span>●</span> 오프라인 — 저장된 데이터를 표시 중
        </div>
      )}
      {/* Date selector / selection action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '6px' }}>
        <button onClick={onOpenCalendar} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: C.ink, minWidth: 0 }}>
          <CalendarIcon size={16} color={C.sage} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '19px', fontWeight: 600, whiteSpace: 'nowrap' }}>{dateLabel}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {selectionMode ? (
            <>
              <span className="mono" style={{ fontSize: '11px', color: C.sage, whiteSpace: 'nowrap' }}>{selectedCount}개 선택</span>
              <button
                onClick={onCopy}
                className="mono"
                style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '10px', background: 'transparent', color: C.label, border: `1px solid ${C.border}`, cursor: 'pointer' }}
              >
                복사
              </button>
              <button
                onClick={onDeleteSelected}
                className="mono"
                style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '10px', background: 'transparent', color: C.danger, border: `1px solid ${C.overdueBg}`, cursor: 'pointer' }}
              >
                삭제
              </button>
              <button
                onClick={onClearSelection}
                className="mono"
                style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '10px', background: 'transparent', color: C.label, border: `1px solid ${C.border}`, cursor: 'pointer' }}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onToggleHideCompleted}
                title={hideCompleted ? '완료된 할일 보기' : '완료된 할일 숨기기'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: hideCompleted ? C.todayBg : 'transparent', border: hideCompleted ? 'none' : `1px solid ${C.border}`, cursor: 'pointer', color: hideCompleted ? C.sageDeep : C.label }}
              >
                {hideCompleted ? <CheckSlash size={14} bg={C.todayBg} /> : <SquareCheck size={14} />}
              </button>
              <button
                onClick={hasExpandable ? onToggleAllSubtasks : undefined}
                title={allSubsExpanded ? '하위할일 감추기' : '하위할일 보기'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: allSubsExpanded ? C.todayBg : 'transparent', border: allSubsExpanded ? 'none' : `1px solid ${C.border}`, cursor: hasExpandable ? 'pointer' : 'default', color: allSubsExpanded ? C.sageDeep : C.label, opacity: hasExpandable ? 1 : 0.4 }}
              >
                {allSubsExpanded ? <BookOpen size={14} /> : <Book size={14} />}
              </button>
              <button
                onClick={onToggleViewMode}
                className="mono"
                style={{
                  fontSize: '12px', padding: '6px 10px', borderRadius: '10px',
                  background: viewMode === 'all' ? C.ink : 'transparent',
                  color: viewMode === 'all' ? C.inkInv : C.label,
                  border: viewMode === 'all' ? 'none' : `1px solid ${C.border}`,
                  cursor: 'pointer',
                }}
              >
                전체
              </button>
              <button
                onClick={onOpenSettings}
                title="설정"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: 'transparent', border: `1px solid ${C.borderSoft}`, cursor: 'pointer', color: C.faint2 }}
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
          <span className="mono" style={{ fontSize: '15px', color: C.sage, fontWeight: 600 }}>
            {String(completed).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
        <ProgressBar pct={pct} />
      </div>
    </div>
  );
}
