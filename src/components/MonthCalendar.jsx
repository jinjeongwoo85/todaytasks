// 월 달력 그리드. 날짜 선택·이전/다음 달·오늘로 이동. 할 일이 있는 날엔 점 표시.
// TodayTasks.jsx에서 이동 — 하드코딩 색상을 토큰으로, TODAY_ISO 상수를 todayISO()로 치환.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { C } from '../styles/tokens';
import { WEEKDAYS, todayISO, isTaskOnDate } from '../utils/date';

export default function MonthCalendar({ monthDate, selectedDate, tasks, onSelect, onPrevMonth, onNextMonth, onToday }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: '16px',
      padding: '16px 14px 14px',
    }}>
      {/* 월 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={onPrevMonth} style={{ background: C.raised, border: 'none', cursor: 'pointer', color: C.sub, padding: '6px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }} aria-label="이전 달">
          <ChevronLeft size={16} />
        </button>
        <span className="sans" style={{ fontSize: '15px', fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
          {year}년 {month + 1}월
        </span>
        <button onClick={onNextMonth} style={{ background: C.raised, border: 'none', cursor: 'pointer', color: C.sub, padding: '6px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }} aria-label="다음 달">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 요일 레이블 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '6px' }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="mono" style={{
            textAlign: 'center', fontSize: '11px', fontWeight: 500,
            color: i === 0 ? C.sun : i === 6 ? C.sat : C.calWeekday,
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
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const hasTasks = tasks.some((t) => isTaskOnDate(t, iso));

          const bg = isSelected ? C.ink : isToday ? C.todayBg : 'transparent';
          const textColor = isSelected ? C.inkInv
            : isToday ? C.sageText
            : dow === 0 ? C.sun
            : dow === 6 ? C.sat
            : C.ink;

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
                background: hasTasks ? (isSelected ? C.sageDot : C.sage) : 'transparent',
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
            fontSize: '11px', color: C.sageDeep, background: C.todayBg,
            border: 'none', cursor: 'pointer', padding: '5px 14px', borderRadius: '999px',
          }}
        >
          오늘로 이동
        </button>
      </div>
    </div>
  );
}
