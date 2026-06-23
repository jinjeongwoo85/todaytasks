// 드래그 정렬의 순수 기하/재배치 로직 — DOM·터치와 분리해 단위 테스트 가능하게 모음.
// (제스처 훅 usePressDragCore/useReorderDrag*/useTaskListGestures 가 호출)

// 세로 리스트: 변형 안 된 래퍼들의 실측 rect 배열에서 clientY가 들어갈 드롭 인덱스.
// rect = { top, height } (getBoundingClientRect 결과). 각 항목 중점보다 위면 그 앞에 삽입.
export function computeDropIndex(rects, clientY) {
  let idx = rects.length;
  for (let i = 0; i < rects.length; i++) {
    if (clientY < rects[i].top + rects[i].height / 2) { idx = i; break; }
  }
  return idx;
}

// id 배열에서 fromIdx 항목을 toIdx 위치로 옮긴 새 배열.
// toIdx는 "그 인덱스 앞에 삽입" 의미 → 제거로 한 칸 당겨진 경우(toIdx>fromIdx) 보정.
export function reorderIds(ids, fromIdx, toIdx) {
  const out = ids.slice();
  const [moved] = out.splice(fromIdx, 1);
  const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
  out.splice(insertAt, 0, moved);
  return out;
}

// 가로 wrap 칩: 드래그 시작 시 캐시한 칩 좌표(startRects: {id,cx,cy})를 기준으로,
// 손가락(px,py)에서 dragId를 끼울 위치를 읽기순서(위→아래, 같은 줄이면 좌→우)로 계산해
// 전체 렌더 순서(id 배열)를 반환. rowTol = 같은 줄로 볼 세로 허용오차.
export function computeHorizontalOrder(startRects, dragId, px, py, rowTol) {
  const rest = startRects.filter((r) => r.id !== dragId); // 잡은 칩 제외, 원래 순서
  let ins = rest.length;
  for (let i = 0; i < rest.length; i++) {
    const r = rest[i];
    const after = (py < r.cy - rowTol) || (Math.abs(py - r.cy) <= rowTol && px < r.cx);
    if (after) { ins = i; break; }
  }
  const restIds = rest.map((r) => r.id);
  return [...restIds.slice(0, ins), dragId, ...restIds.slice(ins)];
}

export const sameOrder = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
