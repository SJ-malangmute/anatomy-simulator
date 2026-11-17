import type { LayerId, Visibility } from '../types';

/** 바깥(얕은 층)부터 안쪽(깊은 층) 순서 */
export const LAYERS: { id: LayerId; ko: string }[] = [
  { id: 'skin', ko: '피부' },
  { id: 'subcut', ko: '피하조직' },
  { id: 'superficial', ko: '표재정맥' },
  { id: 'fascia', ko: '근막' },
  { id: 'muscle', ko: '근육' },
  { id: 'neurovascular', ko: '신경·혈관' },
  { id: 'bone', ko: '뼈' },
];

export const ALL_SHOWN: Record<LayerId, Visibility> = {
  skin: 'show',
  subcut: 'show',
  superficial: 'show',
  fascia: 'show',
  muscle: 'show',
  neurovascular: 'show',
  bone: 'show',
};

export const layerIndex = (id: LayerId) => LAYERS.findIndex((l) => l.id === id);
