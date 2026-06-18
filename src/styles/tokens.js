// 디자인 토큰 — 색상·톤·z-index·상수를 한곳에 모음.
// 기존 TodayTasks.jsx에 하드코딩되어 흩어져 있던 hex 값을 의미 있는 이름으로 정리한 것.
// 인라인 스타일은 그대로 두고 값만 이 상수를 참조하도록 점진적으로 치환한다(옵션 A).

// 색상 팔레트 (현재 앱에서 실제 사용 중인 값 그대로)
export const C = {
  // 배경/표면
  bg: '#F6F4ED',        // 앱 전체 배경
  surface: '#FAF8F3',   // 카드·모달 표면
  raised: '#EFECE4',    // 살짝 떠 보이는 버튼 배경
  selected: '#EAE7DC',  // 선택/드래그 중 행 배경

  // 텍스트
  ink: '#232323',       // 기본 텍스트(검정)
  inkInv: '#F6F4ED',    // 어두운 배경 위 텍스트
  sub: '#6B6862',       // 보조 텍스트
  label: '#8B8780',     // 레이블
  mute: '#A8A29A',      // 흐린 텍스트/플레이스홀더
  faint: '#C2BEB3',     // 가장 흐린 아이콘
  faint2: '#C0B9B0',    // 설정 아이콘 등

  // 선/구분
  border: '#D9D5C7',    // 기본 테두리·점선
  borderSoft: '#E3E0D5',// 연한 구분선

  // 브랜드(세이지 그린)
  sage: '#5C7A5C',      // 진행바·체크·강조
  sageDeep: '#4D6B4F',  // today 톤 텍스트
  sageText: '#3D5B3F',  // 캘린더 today 텍스트
  sageDot: '#A8C4AA',   // 선택된 today 점

  // 캘린더 요일 색
  sun: '#C0624A',
  sat: '#6080A8',

  // 경고/위험(연한 벽돌색)
  danger: '#B5562F',
  dangerBorder: '#E3B8A8',
};

// 날짜 톤 — dueDate가 과거/오늘/미래/없음일 때의 배경·전경·테두리.
// 기존 TONE_STYLES와 동일. dateTone()이 반환하는 키(none/overdue/today/future)와 매칭.
export const TONE = {
  none:    { bg: '#FFFFFF', fg: C.mute,     border: C.border },
  overdue: { bg: '#F3E0D8', fg: '#B5562F',  border: '#F3E0D8' },
  today:   { bg: '#E3EBE0', fg: '#4D6B4F',  border: '#E3EBE0' },
  future:  { bg: '#EDEAE2', fg: '#6B6862',  border: '#EDEAE2' },
};

// z-index 레이어 (기존 코드에서 쓰던 값)
export const Z = {
  stickyHeader: 10,
  backdrop: 40,   // 캘린더·날짜선택·설정·복사 시트 배경
  sheet: 50,      // 할일 세부 모달
  picker: 60,     // 모달 내부에서 다시 뜨는 날짜 picker
};

// 제스처/상호작용 상수
export const LONG_PRESS_MS = 450;      // 롱프레스 → 다중선택·드래그 진입
export const PRESS_MOVE_TOLERANCE = 10; // 이 이상 움직이면 press 취소
export const SWIPE_THRESHOLD = 50;      // 날짜 전환으로 인정하는 최소 가로 이동
