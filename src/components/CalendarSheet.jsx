// 달력 바텀 시트 — BottomSheet + MonthCalendar + 내부 월 네비게이션 상태.
// 기존엔 조회/할일날짜/복사 3개 시트가 각자 month state와 prev/next 핸들러를 부모에 두었는데,
// 그 공통 부분을 여기로 흡수했다. 부모는 initialMonth만 넘기면 된다(시트는 열릴 때 새로 마운트됨).
//
// onToday: 세 시트 모두 "오늘 선택 + 시트 닫기" 동작이라 onSelect(오늘)로 일반화하고,
// 내부 month 뷰도 오늘 달로 리셋한다.
import { useState } from 'react';
import { Clock } from 'lucide-react';
import { C } from '../styles/tokens';
import { todayISO, monthStartOf } from '../utils/date';
import BottomSheet from './BottomSheet';
import MonthCalendar from './MonthCalendar';

export default function CalendarSheet({
  onClose,
  selectedDate,
  tasks,
  onSelect,
  initialMonth,
  header,
  zIndex,
  backdrop,
  time,          // 할일 날짜 칩 편집 시에만 사용: 현재 시각('HH:mm'|null)
  onOpenTime,    // 있으면 시각(시계) 컨트롤을 위에 노출
  onAllDay,      // 종일(시각 없음)로 설정 — 시각을 지운다(time=null)
}) {
  const [month, setMonth] = useState(initialMonth);
  return (
    <BottomSheet onClose={onClose} zIndex={zIndex} backdrop={backdrop}>
      {header && (
        <div className="mono" style={{ fontSize: '11px', color: C.label, marginBottom: '12px', textAlign: 'center' }}>
          {header}
        </div>
      )}
      {onOpenTime && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div
            onClick={onOpenTime}
            className="mono"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer',
              fontSize: '13px', padding: '9px', borderRadius: '10px',
              background: C.raised, color: time ? C.ink : C.label,
              border: `1px solid ${time ? C.sage : C.border}`,
            }}
          >
            <Clock size={14} />
            <span>{time || '시각 설정'}</span>
          </div>
          {/* 종일 = 시각 없음(time===null). 시각을 정하면 자동 해제, 종일을 누르면 시각이 지워짐 → 상호배타. */}
          <button
            onClick={() => onAllDay && onAllDay()}
            className="mono"
            style={{
              padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap',
              border: `1px solid ${!time ? C.sage : C.border}`,
              background: !time ? C.sage : 'transparent',
              color: !time ? C.inkInv : C.label,
            }}
          >
            종일
          </button>
        </div>
      )}
      <MonthCalendar
        monthDate={month}
        selectedDate={selectedDate}
        tasks={tasks}
        onSelect={onSelect}
        onPrevMonth={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
        onNextMonth={() => setMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
        onToday={() => { setMonth(monthStartOf(todayISO())); onSelect(todayISO()); }}
      />
    </BottomSheet>
  );
}
