// 달력 바텀 시트 — BottomSheet + MonthCalendar + 내부 월 네비게이션 상태.
// 기존엔 조회/할일날짜/복사 3개 시트가 각자 month state와 prev/next 핸들러를 부모에 두었는데,
// 그 공통 부분을 여기로 흡수했다. 부모는 initialMonth만 넘기면 된다(시트는 열릴 때 새로 마운트됨).
//
// onToday: 세 시트 모두 "오늘 선택 + 시트 닫기" 동작이라 onSelect(오늘)로 일반화하고,
// 내부 month 뷰도 오늘 달로 리셋한다.
import { useState } from 'react';
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
}) {
  const [month, setMonth] = useState(initialMonth);
  return (
    <BottomSheet onClose={onClose} zIndex={zIndex} backdrop={backdrop}>
      {header && (
        <div className="mono" style={{ fontSize: '11px', color: C.label, marginBottom: '12px', textAlign: 'center' }}>
          {header}
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
