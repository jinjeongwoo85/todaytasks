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
      pushedRef.current = false; // 레이어가 남아 있으면 위 effect가 다시 push
      const layer = layersRef.current.find((l) => l.open);
      if (layer) layer.close();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
