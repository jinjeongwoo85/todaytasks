// 찾기(검색) 바텀시트 — 설정에서 진입. 범위(할일/하위할일/메모) 토글 + 기간 필터.
// 결과는 범위별 섹션으로 그룹화. 할일·하위할일 섹션엔 완료상태 바. 체크박스로 완료 토글 가능.
// 행 탭 → onPick(부모 할일 id)로 상세 모달 열기.
import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { C } from '../styles/tokens';
import BottomSheet from './BottomSheet';
import ProgressBar from './ProgressBar';
import Checkbox from './Checkbox';
import { rowDateLabel, formatDateY } from '../utils/date';

// 기간 매치용 — 할일의 [시작..종료] 구간(없으면 종료/시작 단일). 날짜 없으면 null.
function taskRange(t) {
  const start = (t.date && t.dueDate && t.date <= t.dueDate) ? t.date : (t.dueDate || t.date);
  const end = t.dueDate || t.date;
  if (!start && !end) return null;
  return { start: start || end, end: end || start };
}

// notes 본문에서 검색어 전후 문맥 스니펫. q 없으면 앞부분만.
function snippet(notes, q) {
  if (!q) {
    const head = notes.slice(0, 40);
    return { lead: '', before: head, match: '', after: '', trail: notes.length > 40 ? '…' : '' };
  }
  const idx = notes.toLowerCase().indexOf(q);
  if (idx === -1) return null;
  const start = Math.max(0, idx - 20);
  const end = Math.min(notes.length, idx + q.length + 20);
  return {
    lead: start > 0 ? '…' : '',
    before: notes.slice(start, idx),
    match: notes.slice(idx, idx + q.length),
    after: notes.slice(idx + q.length, end),
    trail: end < notes.length ? '…' : '',
  };
}

export default function SearchSheet({ tasks, onPick, onToggleTask, onToggleSubtask, onClose }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState({ task: true, subtasks: true, notes: true });
  const [periodOn, setPeriodOn] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const q = query.trim().toLowerCase();
  const active = q !== '' || (periodOn && (from || to));

  const inPeriod = (t) => {
    if (!periodOn) return true;
    const r = taskRange(t);
    if (!r) return false;
    if (from && r.end < from) return false;
    if (to && r.start > to) return false;
    return true;
  };

  const { taskResults, subResults, notesResults } = useMemo(() => {
    const inRange = tasks.filter(inPeriod);
    const taskResults = scope.task ? inRange.filter((t) => t.text.toLowerCase().includes(q)) : [];
    const subResults = scope.subtasks
      ? inRange.flatMap((t) => t.subtasks.filter((s) => s.text.toLowerCase().includes(q)).map((s) => ({ parent: t, sub: s })))
      : [];
    const notesResults = scope.notes
      ? inRange.filter((t) => (t.notes || '') && (t.notes || '').toLowerCase().includes(q))
      : [];
    return { taskResults, subResults, notesResults };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, q, scope, periodOn, from, to]);

  const taskDone = taskResults.filter((t) => t.done).length;
  const subDone = subResults.filter((x) => x.sub.done).length;
  const noResults = active && taskResults.length === 0 && subResults.length === 0 && notesResults.length === 0;

  const chip = (key, label) => (
    <button
      onClick={() => setScope((s) => ({ ...s, [key]: !s[key] }))}
      className="sans"
      style={{
        fontSize: '13px', padding: '6px 12px', borderRadius: '15px', cursor: 'pointer',
        background: scope[key] ? C.sage : 'transparent',
        color: scope[key] ? C.inkInv : C.label,
        border: scope[key] ? 'none' : `1px solid ${C.border}`,
      }}
    >
      {label}
    </button>
  );

  return (
    <BottomSheet onClose={onClose} padding="10px 20px 28px" handleMargin="0 auto 14px">
      <div style={{ fontSize: '15px', fontWeight: 700, color: C.ink, marginBottom: '12px' }}>찾기</div>

      {/* 검색 입력 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: C.surface, border: `1px solid ${C.border}`, marginBottom: '12px' }}>
        <Search size={15} color={C.label} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="할 일 검색…"
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: C.ink, fontFamily: 'inherit' }}
        />
        {query && <X size={15} color={C.faint} style={{ cursor: 'pointer' }} onClick={() => setQuery('')} />}
      </div>

      {/* 범위 칩 + 기간 토글 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        {chip('task', '할일')}
        {chip('subtasks', '하위할일')}
        {chip('notes', '메모')}
        <button
          onClick={() => setPeriodOn((v) => !v)}
          className="sans"
          style={{
            fontSize: '13px', padding: '6px 12px', borderRadius: '15px', cursor: 'pointer', marginLeft: '2px',
            background: periodOn ? C.todayBg : 'transparent',
            color: periodOn ? C.sageDeep : C.label,
            border: periodOn ? 'none' : `1px solid ${C.border}`,
          }}
        >
          기간
        </button>
      </div>

      {/* 기간 날짜 입력 (켜질 때만) */}
      {periodOn && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '12px', borderRadius: '12px', background: C.surface, border: `1px solid ${C.borderSoft}`, marginBottom: '12px' }}>
          <PeriodField label="시작일" iso={from} onChange={setFrom} />
          <span style={{ color: C.mute, paddingBottom: '8px' }}>~</span>
          <PeriodField label="종료일" iso={to} onChange={setTo} />
        </div>
      )}

      {/* 결과 */}
      <div style={{ maxHeight: '52vh', overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
        {!active && (
          <div style={{ textAlign: 'center', color: C.mute, fontSize: '13px', padding: '28px 0' }}>
            검색어를 입력하거나 기간을 설정하세요
          </div>
        )}
        {noResults && (
          <div style={{ textAlign: 'center', color: C.mute, fontSize: '13px', padding: '28px 0' }}>결과 없음</div>
        )}

        {active && scope.task && taskResults.length > 0 && (
          <Section title="할일" done={taskDone} total={taskResults.length}>
            {taskResults.map((t) => (
              <ResultRow key={t.id} done={t.done} onPick={() => onPick(t.id)}
                check={<SquareCheck done={t.done} onToggle={() => onToggleTask(t.id)} />}
                label={t.text || '(제목 없음)'} labelSize="15px" date={rowDateLabel(t)} />
            ))}
          </Section>
        )}

        {active && scope.subtasks && subResults.length > 0 && (
          <Section title="하위할일" done={subDone} total={subResults.length}>
            {subResults.map(({ parent, sub }) => (
              <ResultRow key={sub.id} done={sub.done} onPick={() => onPick(parent.id)}
                check={<CircleCheck done={sub.done} onToggle={() => onToggleSubtask(parent.id, sub.id)} />}
                label={sub.text} labelSize="14px" date={rowDateLabel(parent)} />
            ))}
          </Section>
        )}

        {active && scope.notes && notesResults.length > 0 && (
          <Section title="메모">
            {notesResults.map((t) => {
              const sn = snippet(t.notes || '', q);
              return (
                <div key={t.id} onClick={() => onPick(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 4px', cursor: 'pointer', borderBottom: `1px dotted ${C.border}` }}>
                  <span style={{ flex: 1, fontSize: '12px', color: C.sub, lineHeight: 1.4 }}>
                    {sn ? (<>{sn.lead}{sn.before}<b style={{ color: C.sage }}>{sn.match}</b>{sn.after}{sn.trail}</>) : (t.notes || '')}
                  </span>
                  {rowDateLabel(t) && <span className="mono" style={{ fontSize: '10px', color: C.sub, flexShrink: 0 }}>{rowDateLabel(t)}</span>}
                </div>
              );
            })}
          </Section>
        )}
      </div>
    </BottomSheet>
  );
}

// 기간 날짜 칸 — 보이는 칩 위에 투명 <input type="date"> 오버레이(첫 탭에 네이티브 픽커).
function PeriodField({ label, iso, onChange }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="mono" style={{ fontSize: '10px', color: C.label, marginBottom: '4px' }}>{label}</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', padding: '7px 8px', borderRadius: '8px', background: '#fff', border: `1px solid ${C.border}` }}>
        <span className="mono" style={{ fontSize: '12px', color: iso ? C.ink : C.mute, whiteSpace: 'nowrap' }}>{iso ? formatDateY(iso) : '설정 안함'}</span>
        {iso && <X size={12} color={C.faint} style={{ position: 'relative', zIndex: 2, cursor: 'pointer', flexShrink: 0 }} onClick={() => onChange('')} />}
        <input type="date" value={iso || ''} onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 'none', cursor: 'pointer', zIndex: 1 }} />
      </div>
    </div>
  );
}

// 섹션 — 제목 + (완료상태 바, done/total 주어질 때만).
function Section({ title, done, total, children }) {
  const hasBar = typeof total === 'number';
  const pct = hasBar && total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasBar ? '6px' : '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: C.ink }}>{title}</span>
        {hasBar && (
          <span className="mono" style={{ fontSize: '13px', color: C.sage, fontWeight: 600 }}>
            {String(done).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        )}
      </div>
      {hasBar && <ProgressBar pct={pct} marginBottom="4px" />}
      {!hasBar && <div style={{ borderBottom: `1px solid ${C.borderSoft}`, marginBottom: '2px' }} />}
      {children}
    </div>
  );
}

// 할일/하위할일 결과 한 줄 — 체크박스 + 라벨 + 우측 날짜. 완료면 행 전체 연하게.
function ResultRow({ done, onPick, check, label, labelSize, date }) {
  return (
    <div onClick={onPick}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 4px', cursor: 'pointer', borderBottom: `1px dotted ${C.border}`, opacity: done ? 0.5 : 1 }}>
      {check}
      <span style={{ flex: 1, fontSize: labelSize, color: C.ink, textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {date && <span className="mono" style={{ fontSize: '11px', color: C.sub, flexShrink: 0 }}>{date}</span>}
    </div>
  );
}

function SquareCheck({ done, onToggle }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={done ? '완료 취소' : '완료로 표시'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
      <Checkbox done={done} size={20} radius="3px" checkSize={13} />
    </button>
  );
}

function CircleCheck({ done, onToggle }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={done ? '완료 취소' : '완료로 표시'}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
      <Checkbox done={done} size={17} checkSize={11} />
    </button>
  );
}
