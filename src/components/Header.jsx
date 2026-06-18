// 상단 sticky 헤더 — 오프라인 배너 + 날짜 선택/다중선택 액션 행 + 진행률 바.
import { Calendar as CalendarIcon, ChevronDown, Eye, EyeOff, Settings } from 'lucide-react';
import { C, Z } from '../styles/tokens';

export default function Header({
  isOffline, dateLabel, calendarOpen, onOpenCalendar,
  selectionMode, selectedCount, onCopy, onDeleteSelected, onClearSelection,
  hideCompleted, onToggleHideCompleted, viewMode, onToggleViewMode, onOpenSettings,
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
          <ChevronDown size={16} color={C.mute} style={{ transform: calendarOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', flexShrink: 0 }} />
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
                {hideCompleted ? <EyeOff size={14} /> : <Eye size={14} />}
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
        <div style={{ height: '6px', background: C.borderSoft, width: '100%' }}>
          <div className="progress-fill" style={{ height: '100%', width: `${pct}%`, background: C.sage }} />
        </div>
      </div>
    </div>
  );
}
