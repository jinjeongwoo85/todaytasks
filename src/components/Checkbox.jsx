// 체크박스 비주얼(테두리 박스 + 흰 체크) 공용 컴포넌트(presentational span).
// onClick/aria/위치는 호출부가 감싼다. done이면 세이지 채움 + 체크 표시.
// animated면 체크가 scale로 인입(TaskRow의 .check-icon), 아니면 opacity만.
// 크기·모양은 호출부가 명시 전달해 기존 픽셀을 그대로 재현: size(박스), radius(모서리), checkSize(체크).
import { Check } from 'lucide-react';
import { C } from '../styles/tokens';

export default function Checkbox({ done, size, radius = '50%', checkSize, animated }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        border: `1.5px solid ${done ? C.sage : C.mute}`,
        background: done ? C.sage : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Check
        size={checkSize}
        color={C.inkInv}
        className={animated ? 'check-icon' : undefined}
        style={animated
          ? { transform: done ? 'scale(1)' : 'scale(0)', opacity: done ? 1 : 0 }
          : { opacity: done ? 1 : 0 }}
      />
    </span>
  );
}
