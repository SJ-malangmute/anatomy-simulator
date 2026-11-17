import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ArmScene } from './model/ArmScene';
import { useStore, type Mode } from './store';
import { REGIONS } from './data/regions';
import { ExplorePanel } from './ui/ExplorePanel';
import { DissectPanel } from './ui/DissectPanel';
import { QuizPanel } from './ui/QuizPanel';
import { Credits, InfoCard, Toast } from './ui/Overlays';

const MODES: { id: Mode; label: string }[] = [
  { id: 'explore', label: '탐색' },
  { id: 'dissect', label: '해부 실습' },
  { id: 'quiz', label: '땡시' },
];

const HINTS: Record<Mode, string> = {
  explore: '드래그: 회전 · 휠: 확대 · 우클릭 드래그: 이동',
  dissect: '메스 도구: 피부 위를 드래그해 절개 · 시점 회전 도구로 바꾸면 화면을 돌릴 수 있습니다',
  quiz: '드래그로 돌려 보며 핀이 가리키는 구조물을 확인하세요',
};

/** 오른팔 기준 시점: 앞(0°), 안쪽(+90°, 몸통 쪽), 뒤(180°), 가쪽(-90°, 바깥쪽) */
const VIEWS: { label: string; phi: number }[] = [
  { label: '앞', phi: 0 },
  { label: '안쪽', phi: 90 },
  { label: '뒤', phi: 180 },
  { label: '가쪽', phi: -90 },
];

function ViewButtons() {
  const lookFrom = useStore((s) => s.lookFrom);
  return (
    <div className="view-buttons" role="group" aria-label="시점">
      {VIEWS.map((v) => (
        <button key={v.label} onClick={() => lookFrom(v.phi)} title={`${v.label}에서 보기`}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const region = useStore((s) => s.region);
  const setRegion = useStore((s) => s.setRegion);
  const [showCredits, setShowCredits] = useState(false);

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>해부 실습 시뮬레이터</h1>
          <span className="badge">프로토타입 · BodyParts3D 기반</span>
          <div className="region-picker" role="radiogroup" aria-label="부위">
            {REGIONS.filter((r) => r.group === 'all').map((r) => (
              <button
                key={r.id}
                role="radio"
                aria-checked={region === r.id}
                className={`region-all ${region === r.id ? 'on' : ''}`}
                onClick={() => setRegion(r.id)}
              >
                {r.ko}
              </button>
            ))}
            <div className="region-grid">
              {REGIONS.filter((r) => r.group !== 'all').map((r) => (
                <button
                  key={r.id}
                  role="radio"
                  aria-checked={region === r.id}
                  className={region === r.id ? 'on' : ''}
                  onClick={() => setRegion(r.id)}
                  title={r.rightOnly ? `오른쪽 ${r.ko}` : r.ko}
                >
                  {r.ko}
                </button>
              ))}
            </div>
            <p className="muted small region-note">어깨·위팔·아래팔·손은 오른쪽 모델입니다.</p>
          </div>
        </header>
        <nav className="tabs" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              className={mode === m.id ? 'on' : ''}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-body">
          {mode === 'explore' && <ExplorePanel />}
          {mode === 'dissect' && <DissectPanel />}
          {mode === 'quiz' && <QuizPanel />}
        </div>
        <footer>
          <button className="btn link" onClick={() => setShowCredits(true)}>
            출처·라이선스
          </button>
        </footer>
      </aside>
      <main className="stage">
        <Canvas
          camera={{ position: [0, 2, 44], fov: 40 }}
          dpr={[1, 2]}
          onPointerMissed={() => {
            // 탐색에서 빈 곳을 누르면 선택을 푼다 (흐리게·격리도 함께 풀린다)
            if (useStore.getState().mode === 'explore') useStore.getState().select(null);
          }}
        >
          <ArmScene />
        </Canvas>
        <ViewButtons />
        <InfoCard />
        <Toast />
        <div className="hint">{HINTS[mode]}</div>
      </main>
      {showCredits && <Credits onClose={() => setShowCredits(false)} />}
    </div>
  );
}
