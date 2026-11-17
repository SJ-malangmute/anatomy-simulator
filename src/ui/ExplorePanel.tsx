import { LAYERS } from '../data/layers';
import { structuresIn } from '../data/structures';
import { useStore } from '../store';
import type { Visibility } from '../types';

const VIS_OPTIONS: { v: Visibility; label: string }[] = [
  { v: 'show', label: '보임' },
  { v: 'ghost', label: '반투명' },
  { v: 'hide', label: '숨김' },
];

export function ExplorePanel() {
  const layerVis = useStore((s) => s.layerVis);
  const setLayer = useStore((s) => s.setLayer);
  const peelOne = useStore((s) => s.peelOne);
  const coverAll = useStore((s) => s.coverAll);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const region = useStore((s) => s.region);

  return (
    <div className="panel">
      <p className="muted">구조물을 클릭하면 정보가 나옵니다. 바깥층부터 한 겹씩 벗겨 보세요.</p>
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
        {LAYERS.map((l) => (
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
      {LAYERS.map((l) => {
        const items = structuresIn(region).filter((s) => s.layer === l.id);
        if (!items.length) return null;
        return (
          <div key={l.id} className="group">
            <div className="group-title">{l.ko}</div>
            <div className="chips">
              {items.map((s) => (
                <button
                  key={s.id}
                  className={`chip ${selected === s.id ? 'on' : ''}`}
                  onClick={() => {
                    select(s.id);
                    if (layerVis[s.layer] === 'hide') setLayer(s.layer, 'show');
                  }}
                >
                  {s.ko}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
