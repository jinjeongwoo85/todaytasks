// 다중선택(롱프레스로 진입) 상태와 토글/해제만 보유한다.
// 복사·삭제는 tasks/copyTask/removeTask 의존이 커서 App에 잔류하고, 여기서 selectedIds·clearSelection을
// 받아 처리한다(관심사 분리).
import { useState } from 'react';

export function useSelection() {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  return { selectedIds, toggleSelect, clearSelection };
}
