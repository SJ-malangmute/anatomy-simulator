import type { RegionId } from '../types';
import armMeta from './generated/arm-meta.json';
import forearmMeta from './generated/forearm-meta.json';

export interface RegionInfo {
  id: RegionId;
  ko: string;
  modelFile: string;
  meta: unknown;
  /** 지배신경 문제의 보기로 쓸 신경 4개 */
  nerveChoices: string[];
}

export const REGIONS: RegionInfo[] = [
  {
    id: 'arm',
    ko: '위팔',
    modelFile: 'models/arm.glb',
    meta: armMeta,
    nerveChoices: ['musculocutaneous_nerve', 'radial_nerve', 'median_nerve', 'ulnar_nerve'],
  },
  {
    id: 'forearm',
    ko: '아래팔',
    modelFile: 'models/forearm.glb',
    meta: forearmMeta,
    nerveChoices: ['median_nerve', 'ulnar_nerve', 'radial_nerve', 'posterior_interosseous_nerve'],
  },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionInfo>;
