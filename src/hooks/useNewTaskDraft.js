// 새 할일 모달 전용 상태/핸들러. 편집 모달과 분리(편집 쪽 하위할일 draft는 App의 editSubDraft가 보유).
//  - newTaskDraft : 작성 중인 새 할일(아직 서버에 없음). null이면 모달 닫힘.
//  - newSubDraft  : 새 할일 모달에서 입력 중인 하위할일 텍스트(+ 누르기 전 상태).
// 하위할일은 서버 id가 없으므로 draft에만 쌓아두고, saveNewTask에서 본 할일과 함께 생성된다.
import { useState } from 'react';
import { newId } from '../utils/id';

export function useNewTaskDraft({ apiAddTask, draft, setDraft, viewMode, selectedDate }) {
  const [newTaskDraft, setNewTaskDraft] = useState(null);
  const [newSubDraft, setNewSubDraft] = useState('');

  // 입력창의 텍스트로 새 할일 모달 열기. 기본 종료일 = 날짜뷰면 보고 있는 날짜.
  const openNewTask = () => {
    setNewTaskDraft({
      id: '__new__',
      text: draft.trim(),
      notes: '',
      dueDate: viewMode === 'date' ? selectedDate : null, // 기본 날짜 = 종료일
      date: null,
      time: null,
      subtasks: [],
    });
    setDraft('');
  };

  // 새 할일 모달을 닫을 때 호출 — 제목이 있으면 저장(하위할일 포함), 없으면 그냥 버린다.
  // '추가하기' 버튼뿐 아니라 바깥 탭/뒤로가기로 닫아도 동일하게 동작. 입력 중이던 하위할일 draft도 함께 저장.
  const saveNewTask = () => {
    if (newTaskDraft?.text?.trim()) {
      const pending = newSubDraft.trim();
      const subtasks = pending
        ? [...newTaskDraft.subtasks, { id: newId(), text: pending, done: false }]
        : newTaskDraft.subtasks;
      apiAddTask(newTaskDraft.text.trim(), newTaskDraft.dueDate, {
        notes: newTaskDraft.notes,
        subtasks,
        date: newTaskDraft.date,
        time: newTaskDraft.time,
      });
    }
    setNewTaskDraft(null);
    setNewSubDraft('');
  };

  const addDraftSubtask = () => {
    const text = newSubDraft.trim();
    if (!text) return;
    setNewTaskDraft((prev) => ({ ...prev, subtasks: [...prev.subtasks, { id: newId(), text, done: false }] }));
    setNewSubDraft('');
  };
  const toggleDraftSubtask = (subId) => {
    setNewTaskDraft((prev) => ({ ...prev, subtasks: prev.subtasks.map((s) => s.id === subId ? { ...s, done: !s.done } : s) }));
  };
  const updateDraftSubtask = (subId, text) => {
    setNewTaskDraft((prev) => ({ ...prev, subtasks: prev.subtasks.map((s) => s.id === subId ? { ...s, text } : s) }));
  };
  const removeDraftSubtask = (subId) => {
    setNewTaskDraft((prev) => ({ ...prev, subtasks: prev.subtasks.filter((s) => s.id !== subId) }));
  };

  return {
    newTaskDraft, setNewTaskDraft, newSubDraft, setNewSubDraft,
    openNewTask, saveNewTask,
    addDraftSubtask, toggleDraftSubtask, updateDraftSubtask, removeDraftSubtask,
  };
}
