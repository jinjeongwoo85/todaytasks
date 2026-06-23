import { describe, it, expect } from 'vitest';
import { computeDropIndex, reorderIds, computeHorizontalOrder, sameOrder } from './dragGeometry';

// 높이 20, 간격 없이 쌓인 3행: 중점 = 10, 30, 50
const rects = [
  { top: 0, height: 20 },
  { top: 20, height: 20 },
  { top: 40, height: 20 },
];

describe('computeDropIndex', () => {
  it('첫 행 중점 위 → 0', () => {
    expect(computeDropIndex(rects, 5)).toBe(0);
  });
  it('행 중점들 사이 → 해당 인덱스', () => {
    expect(computeDropIndex(rects, 25)).toBe(1); // 1행 중점(30) 위
    expect(computeDropIndex(rects, 45)).toBe(2); // 2행 중점(50) 위
  });
  it('마지막 중점 아래 → length(맨 끝)', () => {
    expect(computeDropIndex(rects, 100)).toBe(3);
  });
  it('빈 배열 → 0', () => {
    expect(computeDropIndex([], 50)).toBe(0);
  });
});

describe('reorderIds', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('아래로 이동(toIdx>fromIdx, 제거 보정)', () => {
    // a를 인덱스3 앞(=c와 d 사이)으로
    expect(reorderIds(ids, 0, 3)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('위로 이동', () => {
    expect(reorderIds(ids, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });
  it('맨 끝으로 이동(toIdx=length)', () => {
    expect(reorderIds(ids, 0, 4)).toEqual(['b', 'c', 'd', 'a']);
  });
  it('원본 불변(새 배열 반환)', () => {
    const copy = ids.slice();
    reorderIds(ids, 1, 3);
    expect(ids).toEqual(copy);
  });
});

describe('computeHorizontalOrder', () => {
  // 한 줄에 3칩, 폭100 간격0: cx = 50, 150, 250, 모두 cy=10
  const startRects = [
    { id: 'a', cx: 50, cy: 10 },
    { id: 'b', cx: 150, cy: 10 },
    { id: 'c', cx: 250, cy: 10 },
  ];
  const rowTol = 16;
  it('맨 앞으로 끌면 dragId가 선두', () => {
    expect(computeHorizontalOrder(startRects, 'c', 10, 10, rowTol)).toEqual(['c', 'a', 'b']);
  });
  it('중간(a와 b 사이)으로', () => {
    // px=120 → a(cx50) 뒤, b(cx150) 앞
    expect(computeHorizontalOrder(startRects, 'c', 120, 10, rowTol)).toEqual(['a', 'c', 'b']);
  });
  it('맨 뒤로 끌면 dragId가 끝', () => {
    expect(computeHorizontalOrder(startRects, 'a', 300, 10, rowTol)).toEqual(['b', 'c', 'a']);
  });
  it('윗줄(py가 rowTol 이상 위)이면 선두 삽입', () => {
    expect(computeHorizontalOrder(startRects, 'b', 250, -50, rowTol)).toEqual(['b', 'a', 'c']);
  });
});

describe('sameOrder', () => {
  it('같으면 true', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
  });
  it('순서/길이 다르면 false', () => {
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameOrder(['a'], ['a', 'b'])).toBe(false);
  });
});
