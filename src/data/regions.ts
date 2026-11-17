import type { RegionId } from '../types';
import upperBodyMeta from './generated/upper_body-meta.json';
import neckMeta from './generated/neck-meta.json';
import shoulderMeta from './generated/shoulder-meta.json';
import thoraxMeta from './generated/thorax-meta.json';
import backMeta from './generated/back-meta.json';
import abdomenMeta from './generated/abdomen-meta.json';
import armMeta from './generated/arm-meta.json';
import forearmMeta from './generated/forearm-meta.json';
import handMeta from './generated/hand-meta.json';

export interface RegionInfo {
  id: RegionId;
  ko: string;
  /** 부위 선택 화면의 묶음 */
  group: 'all' | 'trunk' | 'limb';
  /** 오른쪽만 있는 부위인지 (팔) */
  rightOnly: boolean;
  modelFile: string;
  meta: unknown;
  /** 지배신경 문제의 보기로 쓸 신경. 신경 모델이 없는 부위는 비워 둔다. */
  nerveChoices: string[];
}

const ARM_NERVES = ['musculocutaneous_nerve', 'radial_nerve', 'median_nerve', 'ulnar_nerve'];

export const REGIONS: RegionInfo[] = [
  { id: 'upper_body', ko: '상체 전체', group: 'all', rightOnly: false, modelFile: 'models/upper_body.glb', meta: upperBodyMeta, nerveChoices: ARM_NERVES },
  { id: 'neck', ko: '목', group: 'trunk', rightOnly: false, modelFile: 'models/neck.glb', meta: neckMeta, nerveChoices: [] },
  { id: 'shoulder', ko: '어깨', group: 'trunk', rightOnly: true, modelFile: 'models/shoulder.glb', meta: shoulderMeta, nerveChoices: [] },
  { id: 'thorax', ko: '가슴', group: 'trunk', rightOnly: false, modelFile: 'models/thorax.glb', meta: thoraxMeta, nerveChoices: [] },
  { id: 'back', ko: '등', group: 'trunk', rightOnly: false, modelFile: 'models/back.glb', meta: backMeta, nerveChoices: [] },
  { id: 'abdomen', ko: '배', group: 'trunk', rightOnly: false, modelFile: 'models/abdomen.glb', meta: abdomenMeta, nerveChoices: [] },
  { id: 'arm', ko: '위팔', group: 'limb', rightOnly: true, modelFile: 'models/arm.glb', meta: armMeta, nerveChoices: ARM_NERVES },
  {
    id: 'forearm',
    ko: '아래팔',
    group: 'limb',
    rightOnly: true,
    modelFile: 'models/forearm.glb',
    meta: forearmMeta,
    nerveChoices: ['median_nerve', 'ulnar_nerve', 'radial_nerve', 'posterior_interosseous_nerve'],
  },
  { id: 'hand', ko: '손', group: 'limb', rightOnly: true, modelFile: 'models/hand.glb', meta: handMeta, nerveChoices: [] },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionInfo>;

interface MetaMembership {
  fma: Record<string, string[]>;
  nerves: Record<string, unknown>;
  envelope: unknown | null;
  owner?: Record<string, RegionId>;
}
const membership = (r: RegionId) => REGION_BY_ID[r].meta as MetaMembership;

/** 이 부위의 모델에 실제로 들어 있는 구조물인지 (메시 또는 신경 경로) */
export const regionHasMesh = (r: RegionId, id: string) => {
  const m = membership(r);
  return id in m.fma || id in m.nerves;
};
/** 생성한 피부·근막 껍질이 있는 부위인지 (위팔·아래팔) */
export const regionHasEnvelope = (r: RegionId) => membership(r).envelope !== null;

/** 상체 전체 보기에서 구조물을 자세히 볼 부위 */
export function detailRegionOf(id: string): RegionId | null {
  const owner = membership('upper_body').owner?.[id];
  if (owner) return owner;
  return REGIONS.find((r) => r.id !== 'upper_body' && regionHasMesh(r.id, id))?.id ?? null;
}
