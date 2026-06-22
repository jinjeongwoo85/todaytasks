import { describe, it, expect } from 'vitest';
import { encodeNotes, decodeNotes } from './taskNotes';

describe('taskNotes encode/decode', () => {
  it('값이 없으면 마커 없이 메모 원본만 반환', () => {
    expect(encodeNotes('할 일 메모', {})).toBe('할 일 메모');
    expect(encodeNotes('', {})).toBe('');
  });

  it('시작일·시각을 마커로 부착', () => {
    const out = encodeNotes('메모', { date: '2026-06-20', time: '18:30' });
    expect(out).toContain('메모');
    expect(out).toContain('⟦tt start=2026-06-20 time=18:30⟧');
  });

  it('메모 없이 마커만', () => {
    expect(encodeNotes('', { time: '09:00' })).toBe('⟦tt time=09:00⟧');
  });

  it('인코딩→디코딩 왕복 보존', () => {
    const cases = [
      { notes: '장보기\n우유', date: '2026-06-18', time: '07:05' },
      { notes: '메모만', date: null, time: null },
      { notes: '', date: '2026-12-31', time: null },
      { notes: '여러\n줄\n메모', date: null, time: '23:59' },
    ];
    for (const c of cases) {
      const enc = encodeNotes(c.notes, { date: c.date, time: c.time });
      const dec = decodeNotes(enc);
      expect(dec.notes).toBe(c.notes);
      expect(dec.date).toBe(c.date);
      expect(dec.time).toBe(c.time);
    }
  });

  it('재인코딩 시 기존 마커 중복 부착 안 함', () => {
    const once = encodeNotes('메모', { date: '2026-06-20' });
    const twice = encodeNotes(once, { date: '2026-06-21' });
    expect(twice.match(/⟦tt/g)).toHaveLength(1);
    expect(decodeNotes(twice).date).toBe('2026-06-21');
    expect(decodeNotes(twice).notes).toBe('메모');
  });

  it('마커 없는 일반 메모는 그대로 디코딩', () => {
    expect(decodeNotes('그냥 메모')).toEqual({ notes: '그냥 메모', date: null, time: null });
  });

  it('잘못된 날짜/시각 값은 무시(메모는 보존)', () => {
    expect(encodeNotes('메모', { date: '2026-6-1', time: '99:99' })).toBe('메모');
  });
});
