// 오늘 날짜('YYYY-MM-DD')를 state로 보유하고, 자정 경과·탭 복귀(focus/visibilitychange) 시 갱신한다.
// todayISO()는 호출마다 최신이지만 React가 자정에 자동 리렌더하지 않아, 앱을 켜둔 채 자정을 넘기면
// "오늘" 라벨·날짜 톤이 멈추는 문제가 있었다. 이 hook이 그 시점에 setState로 리렌더를 유발해 해소한다.
// (보던 날짜는 그대로 — selectedDate는 건드리지 않고, 라벨/톤만 새 오늘 기준으로 갱신됨.)
import { useState, useEffect } from 'react';
import { todayISO } from '../utils/date';

export function useToday() {
  const [today, setToday] = useState(todayISO());

  useEffect(() => {
    let timer;
    // 값이 실제로 바뀔 때만 갱신(불필요한 리렌더 방지)
    const sync = () => setToday((prev) => (todayISO() === prev ? prev : todayISO()));
    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1); // 다음 자정 +1초
      timer = setTimeout(() => { sync(); scheduleMidnight(); }, nextMidnight - now);
    };
    scheduleMidnight();
    const onVisible = () => { if (!document.hidden) sync(); };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return today;
}
