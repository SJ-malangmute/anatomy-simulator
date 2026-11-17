import * as THREE from 'three';
import metaJson from '../data/generated/arm-meta.json';

/**
 * 오른쪽 위팔 모델.
 * - 뼈·근육·동맥·표재정맥: BodyParts3D 실제 메시 (public/models/arm.glb, scripts/bp3d/build-arm.mjs로 생성)
 * - 피부·피하조직·근막 껍질, 신경 경로: BodyParts3D에 없어 실제 구조물에 맞춰 생성한 근사치 (arm-meta.json)
 * 단위: cm. y축 = 팔 길이(+ 어깨, - 팔꿈치), +z = 앞쪽, +x = 안쪽(medial), -x = 가쪽(lateral).
 */

type Vec3 = [number, number, number];
interface ArmMeta {
  source: string;
  note: string;
  halfLength: number;
  meanSkinRadius: number;
  envelope: { angles: number; rows: number; skin: number[][]; subcut: number[][]; fascia: number[][] };
  fma: Record<string, string[]>;
  veinLines: Record<string, Vec3[]>;
  nerves: Record<string, Vec3[]>;
  pins: Record<string, Vec3>;
}

export const META = metaJson as unknown as ArmMeta;
export const MODEL_URL = '/models/arm.glb';
export const ARM_HALF = META.halfLength;
export const SKIN_R = META.meanSkinRadius;

/** glb에 실제 메시가 있는 구조물 */
export const MESH_IDS = Object.keys(META.fma);
export const isRealMesh = (id: string) => MESH_IDS.includes(id);

const deg = (d: number) => (d * Math.PI) / 180;
const { angles: ANG, rows: ROWS } = META.envelope;
type ShellKind = 'skin' | 'subcut' | 'fascia';

/** 껍질 반지름: φ(0 = 앞 정중선, + = 안쪽)와 높이 y에서 겹선형 보간 */
export function shellRadiusAt(kind: ShellKind, phiDeg: number, y: number) {
  const grid = META.envelope[kind];
  const a = ((((phiDeg % 360) + 360) % 360) / 360) * ANG;
  const j = Math.min(ROWS - 1, Math.max(0, ((y + ARM_HALF) / (2 * ARM_HALF)) * (ROWS - 1)));
  const a0 = Math.floor(a) % ANG;
  const a1 = (a0 + 1) % ANG;
  const j0 = Math.floor(j);
  const j1 = Math.min(ROWS - 1, j0 + 1);
  const ta = a - Math.floor(a);
  const tj = j - j0;
  const row = (jj: number) => grid[jj][a0] * (1 - ta) + grid[jj][a1] * ta;
  return row(j0) * (1 - tj) + row(j1) * tj;
}

export const polar = (phiDeg: number, y: number, r: number) =>
  new THREE.Vector3(r * Math.sin(deg(phiDeg)), y, r * Math.cos(deg(phiDeg)));

export const onShell = (kind: ShellKind, phiDeg: number, y: number, lift = 0) =>
  polar(phiDeg, y, shellRadiusAt(kind, phiDeg, y) + lift);

/** 껍질 메시. 피부판은 φ 0–180(안쪽) / 180–360(가쪽) 두 장으로 나눈다. */
export function shellGeometry(kind: ShellKind, phiFrom = 0, phiTo = 360) {
  const cols = Math.max(2, Math.round(((phiTo - phiFrom) / 360) * ANG * 2) + 1);
  const rows = ROWS * 2 - 1;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j < rows; j++) {
    const y = -ARM_HALF + (2 * ARM_HALF * j) / (rows - 1);
    for (let i = 0; i < cols; i++) {
      const phi = phiFrom + ((phiTo - phiFrom) * i) / (cols - 1);
      pos.push(...onShell(kind, phi, y).toArray());
    }
  }
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const toVec = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

/** 신경 경로 (근사) */
export const NERVE_CURVES: Record<string, THREE.CatmullRomCurve3> = Object.fromEntries(
  Object.entries(META.nerves).map(([id, pts]) => [id, new THREE.CatmullRomCurve3(pts.map(toVec))]),
);
const NERVE_RADIUS: Record<string, number> = {
  median_nerve: 0.17,
  ulnar_nerve: 0.16,
  musculocutaneous_nerve: 0.13,
  radial_nerve: 0.17,
};
export const nerveGeometry = (id: string) =>
  new THREE.TubeGeometry(NERVE_CURVES[id], 64, NERVE_RADIUS[id] ?? 0.15, 10, false);

/** 표재정맥 중심선: 절개선이 정맥 위를 지나는지 판정할 때 쓴다 */
export const VEIN_LINES: Record<string, THREE.Vector3[]> = Object.fromEntries(
  Object.entries(META.veinLines).map(([id, pts]) => [id, pts.map(toVec)]),
);

/** 땡시 핀·라벨을 꽂을 위치 */
export const PIN_POINTS: Record<string, THREE.Vector3> = {
  ...Object.fromEntries(Object.entries(META.pins).map(([id, p]) => [id, toVec(p)])),
  skin: onShell('skin', 25, 4),
  subcutaneous: onShell('subcut', 25, 4),
  brachial_fascia: onShell('fascia', 25, 4),
};

/** 피부판 경첩: 뒤 정중선 */
export const SKIN_HINGE_Z = -shellRadiusAt('skin', 180, 0);

/** 위팔두갈래근을 갈고리로 젖혔을 때의 이동량 (가쪽·앞쪽) */
export const BICEPS_RETRACT_OFFSET = new THREE.Vector3(-3.0, 0, 1.8);
