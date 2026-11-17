import { useEffect, useRef, useState } from 'react';
import { LAYERS } from '../data/layers';
import { structuresIn } from '../data/structures';
import { searchStructures, useStore } from '../store';
import type { Visibility } from '../types';

const VIS_OPTIONS: { v: Visibility; label: string }[] = [
  { v: 'show', label: '보임' },
  { v: 'ghost', label: '반투명' },
  { v: 'hide', label: '숨김' },
];

function StructureSearch() {
  const region = useStore((s) => s.region);
  const focusOn = useStore((s) => s.focusOn);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = searchStructures(region, query);

  // '/' 키로 검색창으로 이동 (다른 입력칸에 쓰는 중이면 무시)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setActive(0), [query]);

  const pick = (id: string) => {
    focusOn(id);
    setQuery('');
    inputRef.current?.blur();
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        className="input"
        type="search"
        value={query}
        placeholder="구조 찾기 (한글·구용어·영어·라틴어)  /"
        aria-label="구조 찾기"
        aria-controls="search-results"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            pick(results[active].id);
          } else if (e.key === 'Escape') {
            setQuery('');
          }
        }}
      />
      {query && (
        <ul id="search-results" className="search-results" role="listbox">
          {results.length === 0 && <li className="muted small empty">이 부위에서 찾을 수 없습니다.</li>}
          {results.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => pick(s.id)}>
                <strong>{s.ko}</strong>
                <span className="muted small">{s.la}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExplorePanel() {
  const layerVis = useStore((s) => s.layerVis);
  const setLayer = useStore((s) => s.setLayer);
  const peelOne = useStore((s) => s.peelOne);
  const coverAll = useStore((s) => s.coverAll);
  const selected = useStore((s) => s.selected);
  const focusOn = useStore((s) => s.focusOn);
  const region = useStore((s) => s.region);
  const opacity = useStore((s) => s.opacity);
  const resetOpacity = useStore((s) => s.resetOpacity);
  const changed = Object.entries(opacity).filter(([, v]) => v < 1);
  const hiddenCount = changed.filter(([, v]) => v === 0).length;
  // 이 부위 모델에 실제로 있는 층만 보여 준다 (몸통·상체 전체에는 생성한 피부층이 없음)
  const present = new Set(structuresIn(region).map((st) => st.layer));
  const layers = LAYERS.filter((l) => present.has(l.id));

  return (
    <div className="panel">
      <StructureSearch />
      <p className="muted">구조물을 클릭하면 정보가 나오고, 나머지는 흐려집니다. 빈 곳을 누르면 돌아옵니다.</p>
      <div className="row">
        <button className="btn primary" onClick={peelOne}>
          한 겹 벗기기
        </button>
        <button className="btn" onClick={coverAll}>
          모두 덮기
        </button>
      </div>

      <h3>층</h3>
      <ul className="layer-list">
        {layers.map((l) => (
          <li key={l.id}>
            <span>{l.ko}</span>
            <div className="seg" role="group" aria-label={`${l.ko} 표시`}>
              {VIS_OPTIONS.map((o) => (
                <button
                  key={o.v}
                  className={layerVis[l.id] === o.v ? 'on' : ''}
                  onClick={() => setLayer(l.id, o.v)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <h3>구조물</h3>
      {changed.length > 0 && (
        <div className="changed-note">
          <span className="small">
            투명도를 바꾼 구조물 {changed.length}개{hiddenCount ? ` (숨김 ${hiddenCount}개)` : ''}
          </span>
          <button className="btn link small" onClick={resetOpacity}>
            모두 되돌리기
          </button>
        </div>
      )}
      {layers.map((l) => {
        const items = structuresIn(region).filter((s) => s.layer === l.id);
        if (!items.length) return null;
        return (
          <div key={l.id} className="group">
            <div className="group-title">{l.ko}</div>
            <div className="chips">
              {items.map((s) => {
                const op = opacity[s.id] ?? 1;
                return (
                  <button
                    key={s.id}
                    className={`chip ${selected === s.id ? 'on' : ''} ${op === 0 ? 'off' : op < 1 ? 'dim' : ''}`}
                    onClick={() => focusOn(s.id)}
                    title={op === 0 ? '숨김 — 눌러서 다시 보이기' : op < 1 ? `투명도 ${Math.round(op * 100)}%` : undefined}
                  >
                    {s.ko}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
