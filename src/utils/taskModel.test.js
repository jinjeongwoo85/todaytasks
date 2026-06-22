import { describe, it, expect } from 'vitest';
import { dueParam, byPosition, googleToTask, googleToSubtask, taskToGoogleBody, patchToGoogleBody } from './taskModel';

describe('taskModel', () => {
  it('dueParam: ISO → RFC3339 자정 UTC', () => {
    expect(dueParam('2026-06-20')).toBe('2026-06-20T00:00:00.000Z');
    expect(dueParam(null)).toBeUndefined();
  });

  it('byPosition: 사전식 오름차순, 누락은 맨 뒤', () => {
    const arr = [{ _position: 'b' }, { _position: '' }, { _position: 'a' }];
    arr.sort(byPosition);
    expect(arr.map((x) => x._position)).toEqual(['a', 'b', '']);
  });

  it('byPosition: raw position과 _position 모두 지원', () => {
    expect(byPosition({ position: 'a' }, { position: 'b' })).toBe(-1);
    expect(byPosition({ _position: 'b' }, { position: 'a' })).toBe(1);
  });

  it('googleToTask: due→dueDate, status→done, notes 마커 분리', () => {
    const g = {
      id: 't1', title: '운동', status: 'completed', due: '2026-06-20T00:00:00.000Z',
      notes: '메모\n⟦tt start=2026-06-18 time=06:00⟧', parent: undefined,
    };
    const t = googleToTask(g, 'L1');
    expect(t).toMatchObject({
      id: 't1', text: '운동', done: true, dueDate: '2026-06-20',
      date: '2026-06-18', time: '06:00', notes: '메모', _listId: 'L1', _parentId: null,
    });
  });

  it('googleToSubtask: due/notes 보존', () => {
    const s = googleToSubtask({ id: 's1', title: '하위', status: 'needsAction', due: '2026-06-20T00:00:00.000Z', notes: 'n' });
    expect(s).toMatchObject({ id: 's1', text: '하위', done: false, dueDate: '2026-06-20', notes: 'n' });
  });

  it('taskToGoogleBody: title/status/due/notes 구성, parent 미포함', () => {
    const body = taskToGoogleBody({ text: '할일', done: false, dueDate: '2026-06-20', notes: '메모', date: '2026-06-18', time: '09:00' });
    expect(body.title).toBe('할일');
    expect(body.status).toBe('needsAction');
    expect(body.due).toBe('2026-06-20T00:00:00.000Z');
    expect(body.notes).toContain('⟦tt start=2026-06-18 time=09:00⟧');
    expect(body).not.toHaveProperty('parent');
  });

  it('taskToGoogleBody: dueDate 없으면 due 생략', () => {
    const body = taskToGoogleBody({ text: 'x', done: true });
    expect(body).not.toHaveProperty('due');
    expect(body.status).toBe('completed');
  });

  it('patchToGoogleBody: 주어진 필드만 매핑', () => {
    expect(patchToGoogleBody({ text: '새제목' })).toEqual({ title: '새제목' });
    expect(patchToGoogleBody({ done: true })).toEqual({ status: 'completed' });
    expect(patchToGoogleBody({ dueDate: null })).toEqual({ due: null });
  });

  it('patchToGoogleBody: notes/date/time 중 하나라도 있으면 notes 재인코딩', () => {
    const g = patchToGoogleBody({ notes: '메모', date: '2026-06-18', time: '09:00' });
    expect(g.notes).toContain('⟦tt start=2026-06-18 time=09:00⟧');
  });
});
