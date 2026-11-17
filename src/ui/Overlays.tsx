import { useEffect, useState } from 'react';
import { LAYERS } from '../data/layers';
import { STRUCTURE_BY_ID, structureName } from '../data/structures';
import { useStore } from '../store';
import { isRealMesh } from '../model/anatomyGeometry';

const modelSource = (id: string, fmaId: string | null) =>
  isRealMesh(id)
    ? `BodyParts3D 실제 메시 (${fmaId})`
    : id === 'skin' || id === 'subcutaneous' || id === 'brachial_fascia'
      ? '근사 형상: 근육·정맥을 감싸도록 생성 (BodyParts3D에 위팔 단독 메시 없음)'
      : '근사 경로: 실제 동맥·근육·뼈 위치에 맞춰 생성 (BodyParts3D에 신경 메시 없음)';

export function InfoCard() {
  const mode = useStore((s) => s.mode);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const setLayer = useStore((s) => s.setLayer);
  if (!selected || mode === 'quiz') return null;
  const s = STRUCTURE_BY_ID[selected];
  const layer = LAYERS.find((l) => l.id === s.layer)?.ko;
  const nerve = s.innervation ? STRUCTURE_BY_ID[s.innervation] : null;

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
      <p className="muted small model-src">모델: {modelSource(s.id, s.fmaId)}</p>
      <dl>
        {nerve && (
          <div>
            <dt>지배신경</dt>
            <dd>
              {mode === 'explore' ? (
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
          <strong>사용한 메시:</strong> 오른쪽 위팔뼈, 위팔두갈래근(짧은갈래·긴갈래), 위팔세갈래근(세 갈래), 위팔근,
          부리위팔근, 위팔동맥·깊은위팔동맥, 노쪽피부정맥, 자쪽피부정맥 (obj_99 판)
        </p>
        <p className="small">
          <strong>수정 내역:</strong> 팔꿈치 위~겨드랑이 아래 구간만 잘라냄, 약 10° 기울어진 팔을 세로로 세움(전단 변환),
          mm→cm 변환, glTF로 변환. 위팔두갈래근(2갈래)·위팔세갈래근(3갈래)은 원본처럼 갈래별 메시로 둠.
        </p>
        <p className="small">
          <strong>생성한 부분 (원본에 없음):</strong> 피부·피하조직·근막 껍질, 정중신경·자신경·근육피부신경·노신경 경로.
          실제 구조물 위치에 맞춰 만든 근사치라 정확하지 않습니다.
        </p>
        <p className="muted small">
          원본 OBJ 파일 머리말에는 이전 라이선스(CC BY-SA 2.1 JP)가 적혀 있으나, 현재 배포처의 라이선스 안내는 CC BY 4.0입니다.
        </p>
        <p className="muted small">해부 시나리오와 구조물 설명은 교수 검수 전 초안입니다.</p>
        <button className="btn primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
