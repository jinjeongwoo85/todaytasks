// 브라우저/제스처 뒤로가기를 가로채, 열려 있는 레이어(모달·시트·선택모드 등) 중
// 가장 위(우선순위 높은) 하나만 닫는다. layers = [{ open, close }, …] 우선순위 높은 순.
//
// 동작:
//  - 첫 레이어가 열리는 순간 history 항목을 1회 push(뒤로가기가 pop할 대상 확보). 모두 닫히면 리셋.
//  - popstate 시 최신 layers(ref)에서 첫 open 레이어의 close()만 호출(우선순위 보존).
//  - popstate 리스너는 마운트 1회 등록, 최신 layers를 ref로 읽어 stale closure 방지.
import { useEffect, useRef } from 'react';

export function useBackButton(layers) {
  const layersRef = useRef(layers);
  layersRef.current = layers; // 매 렌더 최신 layers 반영(popstate 핸들러가 참조)
  const pushedRef = useRef(false);

  const anyOpen = layers.some((l) => l.open);

  useEffect(() => {
    if (anyOpen && !pushedRef.current) {
      history.pushState({ backIntercept: true }, '');
      pushedRef.current = true;
    } else if (!anyOpen) {
      pushedRef.current = false;
    }
  }, [anyOpen]);

  useEffect(() => {
    history.replaceState({ appBase: true }, '');
    const onPop = () => {
      const open = layersRef.current.filter((l) => l.open); // 우선순위 순(배열 순서)
      if (open.length === 0) { pushedRef.current = false; return; }
      open[0].close(); // 가장 위(우선순위 높은) 레이어만 닫기
      if (open.length > 1) {
        // 닫은 뒤에도 레이어가 남음 → 다음 뒤로가기를 위해 항목 재push.
        // (이 경우 anyOpen이 true→true라 위 push effect가 다시 돌지 않으므로 여기서 직접 확보)
        history.pushState({ backIntercept: true }, '');
      } else {
        pushedRef.current = false; // 마지막 레이어 닫음 → 다음 오픈 시 effect가 다시 push
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
