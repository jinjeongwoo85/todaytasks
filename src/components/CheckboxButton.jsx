// 완료 토글용 체크박스 버튼 — Checkbox(presentational)를 감싼 공용 버튼.
// 목록행/하위할일/검색결과에 반복되던 "버튼 + aria-label + Checkbox" 래퍼를 단일화.
//  - stop=true면 onClick에서 stopPropagation(부모 행 클릭과 분리; 검색결과처럼 행 전체가 클릭 타깃일 때).
//  - size/radius/checkSize/animated는 Checkbox로 그대로 전달(미지정 시 Checkbox 기본값).
//  - style로 래퍼 추가 스타일(예: marginRight) 머지.
import Checkbox from './Checkbox';

export default function CheckboxButton({ done, onToggle, stop = false, size, radius, checkSize, animated, style }) {
  return (
    <button
      type="button"
      onClick={(e) => { if (stop) e.stopPropagation(); onToggle(); }}
      aria-label={done ? '완료 취소' : '완료로 표시'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0, ...style }}
    >
      <Checkbox done={done} size={size} radius={radius} checkSize={checkSize} animated={animated} />
    </button>
  );
}
