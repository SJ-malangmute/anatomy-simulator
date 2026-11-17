import { structureName } from '../data/structures';
import { SCENARIOS, useScenario, useStore } from '../store';

function ScenarioPicker() {
  const scenarioId = useStore((s) => s.scenarioId);
  const startDissection = useStore((s) => s.startDissection);
  return (
    <div className="scenario-picker" role="radiogroup" aria-label="해부 시나리오">
      {SCENARIOS.map((sc) => (
        <button
          key={sc.id}
          role="radio"
          aria-checked={sc.id === scenarioId}
          className={`scenario-card ${sc.id === scenarioId ? 'on' : ''}`}
          onClick={() => startDissection(sc.id)}
        >
          <strong>{sc.title}</strong>
          <span className="muted small">{sc.summary}</span>
        </button>
      ))}
    </div>
  );
}

function Summary() {
  const { incisionScore, damages, wrongClicks, startedAt, finishedAt, startDissection } = useStore();
  const scenario = useScenario();
  const minutes = finishedAt ? Math.max(1, Math.round((finishedAt - startedAt) / 60000)) : 0;
  return (
    <div className="card">
      <h3>{scenario.title} 완료</h3>
      <dl className="stats">
        <div>
          <dt>절개 점수</dt>
          <dd>{incisionScore ?? '-'} / 100</dd>
        </div>
        <div>
          <dt>손상한 구조물</dt>
          <dd>{damages.length}개</dd>
        </div>
        <div>
          <dt>잘못 고른 횟수</dt>
          <dd>{wrongClicks}회</dd>
        </div>
        <div>
          <dt>소요 시간</dt>
          <dd>약 {minutes}분</dd>
        </div>
      </dl>
      {damages.length > 0 && <p className="bad">손상: {damages.map(structureName).join(', ')}</p>}
      <button className="btn primary" onClick={() => startDissection()}>
        처음부터 다시
      </button>
    </div>
  );
}

function IncisionControls() {
  const { tool, setTool, showGuide, toggleGuide, strokes, clearStrokes, submitIncision, incision, nextStep } =
    useStore();
  return (
    <>
      <div className="seg wide" role="group" aria-label="도구">
        <button className={tool === 'scalpel' ? 'on' : ''} onClick={() => setTool('scalpel')}>
          메스
        </button>
        <button className={tool === 'orbit' ? 'on' : ''} onClick={() => setTool('orbit')}>
          시점 회전
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={showGuide} onChange={toggleGuide} /> 정답 절개선 보기 (파란 점선)
      </label>
      {!incision && (
        <div className="row">
          <button className="btn" onClick={clearStrokes} disabled={!strokes.length}>
            지우기
          </button>
          <button className="btn primary" onClick={submitIncision} disabled={!strokes.length}>
            절개 완료
          </button>
        </div>
      )}
      {incision && (
        <div className={`card ${incision.pass ? 'good-card' : 'bad-card'}`}>
          <strong>{incision.pass ? `통과 · ${incision.score}점` : '다시 해 보세요'}</strong>
          <ul>
            {incision.feedback.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {incision.pass ? (
            <button className="btn primary" onClick={nextStep}>
              다음 단계
            </button>
          ) : (
            <button className="btn" onClick={clearStrokes}>
              다시 그리기
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function DissectPanel() {
  const { stepIndex, finishedAt, actionDone, performAction, nextStep, found, damages } = useStore();
  const scenario = useScenario();
  const step = scenario.steps[stepIndex];

  return (
    <div className="panel">
      <ScenarioPicker />
      <div className="scenario-head">
        <strong>{scenario.title}</strong>
        <span className="muted"> · {scenario.region}</span>
      </div>
      <ol className="steps">
        {scenario.steps.map((s, i) => (
          <li key={s.id} className={finishedAt || i < stepIndex ? 'done' : i === stepIndex ? 'current' : ''}>
            {s.title}
          </li>
        ))}
      </ol>

      {finishedAt ? (
        <Summary />
      ) : (
        <div className="card">
          <h3>
            {stepIndex + 1}. {step.title}
          </h3>
          <p>{step.instruction}</p>

          {step.type === 'incision' && <IncisionControls />}

          {step.type === 'action' && (
            <div className="row">
              <button className="btn primary" onClick={performAction} disabled={actionDone}>
                {step.actionLabel}
              </button>
              <button className="btn" onClick={nextStep} disabled={!actionDone}>
                다음 단계
              </button>
            </div>
          )}

          {step.type === 'identify' && (
            <>
              <ul className="checklist">
                {step.targets.map((t) => (
                  <li key={t} className={found.includes(t) ? 'done' : ''}>
                    {found.includes(t) ? structureName(t) : '???'}
                  </li>
                ))}
              </ul>
              <p className="muted small">
                {found.length} / {step.targets.length} 찾음 · 화면을 돌려 가며 클릭하세요.
              </p>
              <button className="btn primary" onClick={nextStep} disabled={found.length < step.targets.length}>
                {stepIndex === scenario.steps.length - 1 ? '실습 마치기' : '다음 단계'}
              </button>
            </>
          )}
        </div>
      )}

      {!finishedAt && damages.length > 0 && (
        <p className="bad small">손상 기록: {damages.map(structureName).join(', ')}</p>
      )}
      <p className="muted small">시나리오 출처: {scenario.source}</p>
    </div>
  );
}
