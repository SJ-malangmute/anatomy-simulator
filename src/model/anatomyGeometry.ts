import * as THREE from 'three';
import { REGION_BY_ID } from '../data/regions';
import type { RegionId } from '../types';

/**
 * 부위별 3D 형상.
 * - 뼈·근육·동맥·표재정맥: BodyParts3D 실제 메시 (public/models/<부위>.glb, scripts/bp3d/build-region.mjs로 생성)
 * - 피부·피하조직·근막 껍질, 신경 경로: BodyParts3D에 없어 실제 구조물에 맞춰 생성한 근사치 (<부위>-meta.json)
 * 단위: cm. y축 = 팔 길이(+ 몸쪽, - 먼쪽), +z = 앞쪽, +x = 안쪽(medial), -x = 가쪽(lateral).
 */

type Vec3 = [number, number, number];
type ShellKind = 'skin' | 'subcut' | 'fascia';

interface RegionMeta {
  region: RegionId;
  source: string;
  note: string;
  halfLength: number;
  tiltDeg: number;
  /** 부위 전체가 화면에 들어오는 카메라 거리 (cm) */
  viewDistance: number;
  /** 생성한 피부층 껍질. 위팔·아래팔에만 있고 나머지는 null */
  meanSkinRadius: number | null;
  envelope: { angles: number; rows: number; skin: number[][]; subcut: number[][]; fascia: number[][] } | null;
  fma: Record<string, string[]>;
  groups: Record<string, string[]>;
  /** 상체 전체: 왼쪽으로 대칭 복사해 보여 줄 오른팔 구조물 */
  mirror?: string[];
  veinLines: Record<string, Vec3[]>;
  nerves: Record<string, Vec3[]>;
  pins: Record<string, Vec3>;
}

const NO_ENVELOPE = { angles: 1, rows: 1, skin: [[0]], subcut: [[0]], fascia: [[0]] };

const deg = (d: number) => (d * Math.PI) / 180;
const toVec = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

export const polar = (phiDeg: number, y: number, r: number) =>
  new THREE.Vector3(r * Math.sin(deg(phiDeg)), y, r * Math.cos(deg(phiDeg)));

const NERVE_RADIUS: Record<string, number> = {
  median_nerve: 0.17,
  ulnar_nerve: 0.16,
  musculocutaneous_nerve: 0.13,
  radial_nerve: 0.17,
  superficial_radial_nerve: 0.11,
  posterior_interosseous_nerve: 0.12,
};

function makeRegionGeometry(regionId: RegionId) {
  const meta = REGION_BY_ID[regionId].meta as RegionMeta;
  const HALF = meta.halfLength;
  const envelope = meta.envelope ?? NO_ENVELOPE;
  const { angles: ANG, rows: ROWS } = envelope;

  /** 껍질 반지름: φ(0 = 앞 정중선, + = 안쪽)와 높이 y에서 겹선형 보간 (피부층이 없는 부위는 0) */
  const shellRadiusAt = (kind: ShellKind, phiDeg: number, y: number) => {
    const grid = envelope[kind];
    const a = ((((phiDeg % 360) + 360) % 360) / 360) * ANG;
    const j = Math.min(ROWS - 1, Math.max(0, ((y + HALF) / (2 * HALF)) * (ROWS - 1)));
    const a0 = Math.floor(a) % ANG;
    const a1 = (a0 + 1) % ANG;
    const j0 = Math.floor(j);
    const j1 = Math.min(ROWS - 1, j0 + 1);
    const ta = a - Math.floor(a);
    const tj = j - j0;
    const row = (jj: number) => grid[jj][a0] * (1 - ta) + grid[jj][a1] * ta;
    return row(j0) * (1 - tj) + row(j1) * tj;
  };
  const onShell = (kind: ShellKind, phiDeg: number, y: number, lift = 0) =>
    polar(phiDeg, y, shellRadiusAt(kind, phiDeg, y) + lift);

  /** 껍질 메시. 피부판은 절개선에서 두 장으로 나눠 만든다. */
  const shellGeometry = (kind: ShellKind, phiFrom = 0, phiTo = 360) => {
    const cols = Math.max(2, Math.round(((phiTo - phiFrom) / 360) * ANG * 2) + 1);
    const rows = ROWS * 2 - 1;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j < rows; j++) {
      const y = -HALF + (2 * HALF * j) / (rows - 1);
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
  };

  const nerveCurves: Record<string, THREE.CatmullRomCurve3> = Object.fromEntries(
    Object.entries(meta.nerves).map(([id, pts]) => [id, new THREE.CatmullRomCurve3(pts.map(toVec))]),
  );

  return {
    regionId,
    meta,
    modelUrl: `${import.meta.env.BASE_URL}${REGION_BY_ID[regionId].modelFile}`,
    halfLength: HALF,
    skinRadius: meta.meanSkinRadius ?? 0,
    hasEnvelope: meta.envelope !== null,
    viewDistance: meta.viewDistance,
    /** 상체 전체에서 왼쪽에 대칭 복사해 그릴 구조물 */
    mirrored: new Set(meta.mirror ?? []),
    shellRadiusAt,
    onShell,
    shellGeometry,
    nerveCurves,
    nerveGeometry: (id: string) => new THREE.TubeGeometry(nerveCurves[id], 64, NERVE_RADIUS[id] ?? 0.14, 10, false),
    /** 표재정맥 중심선: 절개선이 정맥 위를 지나는지 판정할 때 쓴다 */
    veinLines: Object.fromEntries(
      Object.entries(meta.veinLines).map(([id, pts]) => [id, pts.map(toVec)]),
    ) as Record<string, THREE.Vector3[]>,
    /** 땡시 핀·라벨 위치. 피부층은 껍질 위 한 점. */
    pins: {
      ...Object.fromEntries(Object.entries(meta.pins).map(([id, p]) => [id, toVec(p)])),
      ...(meta.envelope
        ? {
            skin: onShell('skin', 25, HALF * 0.3),
            subcutaneous: onShell('subcut', 25, HALF * 0.3),
            brachial_fascia: onShell('fascia', 25, HALF * 0.3),
            antebrachial_fascia: onShell('fascia', 25, HALF * 0.3),
          }
        : {}),
    } as Record<string, THREE.Vector3>,
    /** glb에 실제 메시가 있는 구조물인지 */
    isRealMesh: (id: string) => id in meta.fma,
  };
}

export type RegionGeometry = ReturnType<typeof makeRegionGeometry>;

const cache = new Map<RegionId, RegionGeometry>();
export function regionGeometry(regionId: RegionId): RegionGeometry {
  if (!cache.has(regionId)) cache.set(regionId, makeRegionGeometry(regionId));
  return cache.get(regionId)!;
}
