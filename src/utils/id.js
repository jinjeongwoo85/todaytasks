// ID 생성 유틸 — 기존에 newId가 두 파일에 서로 다르게 정의돼 있던 것을 단일화.
//
// 주의: 두 의미가 달랐고 둘 다 보존해야 한다.
//  - TodayTasks.jsx:  crypto.randomUUID 기반 (로컬 전용 식별자)
//  - useTasks.js:     'opt-' 접두사 + isTemp(id)로 "아직 서버에 없는 임시 항목"을 판별
//    (오프라인 큐 재생 시 temp id → 실제 Google id 매핑에 필수)

// 일반 로컬 식별자
export const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

// 서버 동기화 전 임시 항목 식별자 ('opt-' 접두사 유지)
export const newTempId = () => `opt-${Date.now()}-${Math.random()}`;

// 임시 id 여부 (오프라인 큐 재생에서 사용)
export const isTempId = (id) => typeof id === 'string' && id.startsWith('opt-');
