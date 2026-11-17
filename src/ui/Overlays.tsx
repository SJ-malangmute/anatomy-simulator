import { useEffect, useState } from 'react';
import { LAYERS } from '../data/layers';
import { STRUCTURE_BY_ID, isInRegion, structureName } from '../data/structures';
import { REGION_BY_ID, detailRegionOf } from '../data/regions';
import { useStore } from '../store';
import { regionGeometry } from '../model/anatomyGeometry';
import type { RegionId, Structure } from '../types';

const modelSource = (s: Structure, region: RegionId) => {
  const geo = regionGeometry(region);
  if (geo.isRealMesh(s.id)) {
    const fma = s.fmaId ?? geo.meta.fma[s.id]?.join(', ');
    const mirrored = geo.mirrored.has(s.id) ? ' · 왼쪽은 대칭 복사' : '';
    return `BodyParts3D 실제 메시 (${fma})${mirrored}`;
  }
  return s.kind === 'skin' || s.kind === 'tissue' || s.kind === 'fascia'
    ? '근사 형상: 근육·정맥을 감싸도록 생성 (BodyParts3D에 팔 부위만의 메시 없음)'
    : '근사 경로: 실제 동맥·근육·뼈 위치에 맞춰 생성 (BodyParts3D에 신경 메시 없음)';
};

export function InfoCard() {
  const mode = useStore((s) => s.mode);
  const region = useStore((s) => s.region);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const setLayer = useStore((s) => s.setLayer);
  const opacity = useStore((s) => (s.selected ? s.opacity[s.selected] ?? 1 : 1));
  const isolated = useStore((s) => s.isolated);
  const { setOpacity, setIsolated, focusOn } = useStore.getState();
  if (!selected || mode === 'quiz') return null;
  const s = STRUCTURE_BY_ID[selected];
  const layer = LAYERS.find((l) => l.id === s.layer)?.ko;
  const nerve = s.innervation ? STRUCTURE_BY_ID[s.innervation] : null;
  // 지배신경이 이 부위 모델에 있을 때만 눌러서 이동할 수 있게 한다 (예: 아래팔에서 노신경 본줄기는 위팔 모델에 있음)
  const nerveHere = nerve ? isInRegion(region, nerve.id) : false;
  // 상체 전체 보기에서는 구조물이 속한 부위로 들어가 자세히 볼 수 있게 한다
  const detail = region === 'upper_body' ? detailRegionOf(s.id) : null;

  const rows: [string, string | undefined][] = [
    ['기시', s.origin],
    ['정지', s.insertion],
    ['작용', s.action],
    ['혈액공급', s.bloodSupply],
    ['주행', s.course],
    ['설명', s.description],
    ['임상', s.clinical],
  ];

  return (
    <aside className="info-card" aria-label="구조물 정보">
      <button className="close" onClick={() => select(null)} aria-label="닫기">
        ×
      </button>
      <h2>{s.ko}</h2>
      <p className="muted">
        {s.la} · {s.en}
      </p>
      <span className="tag">{layer}</span>
      {s.group && <span className="tag">{structureName(s.group)}의 갈래</span>}
      <p className="muted small model-src">모델: {modelSource(s, region)}</p>
      {detail && (
        <button
          className="btn primary small-btn detail-btn"
          onClick={() => {
            useStore.getState().setRegion(detail);
            // 부위가 바뀐 뒤 그 부위 모델에서 같은 구조물에 초점을 맞춘다
            setTimeout(() => useStore.getState().focusOn(s.id), 0);
          }}
        >
          {REGION_BY_ID[detail].ko} 부위에서 자세히 보기 →
        </button>
      )}
      <div className="view-control">
        <label className="op-label" htmlFor="op-slider">
          <span>투명도</span>
          <span className="muted">{opacity === 0 ? '숨김' : `${Math.round(opacity * 100)}%`}</span>
        </label>
        <input
          id="op-slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(opacity * 100)}
          onChange={(e) => setOpacity(s.id, Number(e.target.value) / 100)}
          aria-label={`${s.ko} 투명도`}
        />
        {opacity > 0 && opacity < 0.5 && (
          <p className="muted small">50% 미만이면 클릭이 뒤의 구조물로 넘어갑니다.</p>
        )}
        <div className="row">
          <button className="btn small-btn" onClick={() => setOpacity(s.id, opacity === 0 ? 1 : 0)}>
            {opacity === 0 ? '다시 보이기' : '숨기기'}
          </button>
          <button className="btn small-btn" onClick={() => setIsolated(!isolated)} aria-pressed={isolated}>
            {isolated ? '모두 보기' : '이 구조만 보기'}
          </button>
          <button className="btn small-btn" onClick={() => focusOn(s.id)}>
            카메라 맞추기
          </button>
        </div>
      </div>
      <dl>
        {(nerve || s.innervationNote) && (
          <div>
            <dt>지배신경</dt>
            <dd>
              {!nerve ? (
                s.innervationNote
              ) : mode === 'explore' && nerveHere ? (
                <button
                  className="btn link"
                  onClick={() => {
                    select(nerve.id);
                    setLayer('neurovascular', 'show');
                  }}
                >
                  {nerve.ko}
                </button>
              ) : (
                nerve.ko
              )}
              {nerve && s.innervationNote && <span className="muted small"> · {s.innervationNote}</span>}
            </dd>
          </div>
        )}
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
    </aside>
  );
}

export function Toast() {
  const message = useStore((s) => s.message);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [message]);
  if (!message || !visible) return null;
  return (
    <div className={`toast ${message.tone}`} role="status">
      {message.text}
    </div>
  );
}

export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="출처와 라이선스" onClick={(e) => e.stopPropagation()}>
        <h2>출처·라이선스</h2>
        <p>
          <strong>3D 모델 원본:</strong>{' '}
          <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">
            BodyParts3D 4.0
          </a>
          , © The Database Center for Life Science, licensed under{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          .
        </p>
        <p className="small">
          <strong>사용한 메시 (obj_99 판, 오른쪽):</strong>
        </p>
        <ul className="small">
          <li>목·가슴·등·배: 목뼈·등뼈·허리뼈, 갈비뼈·갈비연골·복장뼈, 목·가슴·등·배벽 근육, 심장·허파(기관지 가지)·간·위 등 내장, 대동맥·대정맥 등 큰 혈관 (좌우 모두)</li>
          <li>어깨·위팔·아래팔·손: 오른쪽 뼈·근육·동맥·표재정맥</li>
        </ul>
        <p className="small">
          <strong>수정 내역:</strong> 부위별로 높이 구간을 잘라냄, 팔다리는 기울어진 뼈 축(위팔 약 10°, 아래팔 약 17°, 손 약 18°)을
          세로로 세움(전단 변환), mm→cm 변환, 큰 메시는 모양을 유지하며 삼각형 수를 줄임(meshoptimizer), glTF로 변환. 여러 부분으로
          나뉜 근육(어깨세모근·등세모근·원엎침근 등)은 하나로 합침. 상체 전체 보기의 왼팔은 오른팔을 정중선 기준으로 대칭 복사해 표시.
        </p>
        <p className="small">
          <strong>생성한 부분 (원본에 없음):</strong> 위팔·아래팔의 피부·피하조직·근막 껍질과 신경 경로(정중·자·근육피부·노신경,
          노신경 얕은가지, 뒤뼈사이신경). 실제 구조물 위치에 맞춰 만든 근사치라 정확하지 않습니다.
        </p>
        <p className="muted small">
          원본에 없는 것: 몸통의 피부 표면과 신경, 허파 겉면, 넓은등근·배곧은근·배속빗근·배가로근, 갑상샘, 구불잘록창자, 부신.
        </p>
        <p className="muted small">
          원본 OBJ 파일 머리말에는 이전 라이선스(CC BY-SA 2.1 JP)가 적혀 있으나, 현재 배포처의 라이선스 안내는 CC BY 4.0입니다.
        </p>
        <p className="muted small">해부 시나리오와 구조물 설명은 검수되지 않은 초안입니다.</p>
        <button className="btn primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
