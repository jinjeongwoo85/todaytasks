import { describe, it, expect } from 'vitest';
import { toISO, formatDate, formatShort, dateTone, isTaskOnDate, rowDateLabel } from './date';

const TODAY = '2026-06-22'; // 테스트 고정 기준일(함수에 주입)

describe('date utils', () => {
  it('toISO: 로컬 날짜 → YYYY-MM-DD', () => {
    expect(toISO(new Date(2026, 5, 9))).toBe('2026-06-09');
  });

  it('formatDate / formatShort', () => {
    expect(formatShort('2026-06-22')).toBe('6.22');
    // 2026-06-22는 월요일
    expect(formatDate('2026-06-22')).toBe('6.22(월)');
  });

  it('dateTone: 과거/오늘/미래/없음', () => {
    expect(dateTone(null, TODAY)).toBe('none');
    expect(dateTone('2026-06-21', TODAY)).toBe('overdue');
    expect(dateTone('2026-06-22', TODAY)).toBe('today');
    expect(dateTone('2026-06-23', TODAY)).toBe('future');
  });

  describe('isTaskOnDate', () => {
    it('단일 종료일: 그날만', () => {
      const t = { dueDate: '2026-06-22', date: null };
      expect(isTaskOnDate(t, '2026-06-22')).toBe(true);
      expect(isTaskOnDate(t, '2026-06-21')).toBe(false);
    });
    it('기간(시작~종료): 사이 모든 날', () => {
      const t = { date: '2026-06-20', dueDate: '2026-06-22' };
      expect(isTaskOnDate(t, '2026-06-19')).toBe(false);
      expect(isTaskOnDate(t, '2026-06-20')).toBe(true);
      expect(isTaskOnDate(t, '2026-06-21')).toBe(true);
      expect(isTaskOnDate(t, '2026-06-22')).toBe(true);
      expect(isTaskOnDate(t, '2026-06-23')).toBe(false);
    });
    it('시작일만(종료 없음): 시작일 당일', () => {
      const t = { date: '2026-06-20', dueDate: null };
      expect(isTaskOnDate(t, '2026-06-20')).toBe(true);
      expect(isTaskOnDate(t, '2026-06-21')).toBe(false);
    });
    it('날짜 미설정: 모든 날짜에 표시', () => {
      const t = { date: null, dueDate: null };
      expect(isTaskOnDate(t, '2026-06-20')).toBe(true);
      expect(isTaskOnDate(t, '2026-06-22')).toBe(true);
      expect(isTaskOnDate(t, '2026-07-01')).toBe(true);
    });
  });

  describe('rowDateLabel', () => {
    it('날짜 미설정(종료·시작 둘 다 없음) → "—"', () => {
      expect(rowDateLabel({ dueDate: null }, TODAY)).toBe('—');
    });
    it('시작일만 있고 종료일 없으면 null', () => {
      expect(rowDateLabel({ date: '2026-06-20', dueDate: null }, TODAY)).toBeNull();
    });
    it('단일 + 종료=오늘 → "오늘"(+시각)', () => {
      expect(rowDateLabel({ dueDate: TODAY }, TODAY)).toBe('오늘');
      expect(rowDateLabel({ dueDate: TODAY, time: '18:00' }, TODAY)).toBe('오늘 18:00');
    });
    it('단일 + 종료≠오늘 → "6.25(목)"', () => {
      expect(rowDateLabel({ dueDate: '2026-06-25' }, TODAY)).toBe('6.25(목)');
    });
    it('기간 → "~종료일"(종료=오늘이면 ~오늘)', () => {
      expect(rowDateLabel({ date: '2026-06-20', dueDate: '2026-06-25' }, TODAY)).toBe('~6.25(목)');
      expect(rowDateLabel({ date: '2026-06-20', dueDate: TODAY, time: '09:30' }, TODAY)).toBe('~오늘 09:30');
    });
  });
});
