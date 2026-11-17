export type LayerId =
  | 'skin'
  | 'subcut'
  | 'superficial'
  | 'fascia'
  | 'muscle'
  | 'neurovascular'
  | 'bone';

export type Visibility = 'show' | 'ghost' | 'hide';

export type StructureKind =
  | 'skin'
  | 'tissue'
  | 'fascia'
  | 'muscle'
  | 'artery'
  | 'vein'
  | 'nerve'
  | 'bone';

export interface Structure {
  /** 내부 ID. 실제 에셋으로 교체할 때 fmaId와 연결한다. */
  id: string;
  /** Foundational Model of Anatomy ID. BodyParts3D 에셋 도입 시 채운다. */
  fmaId: string | null;
  ko: string;
  en: string;
  la: string;
  layer: LayerId;
  kind: StructureKind;
  color: string;
  /** 땡시 정답으로 인정할 다른 이름 (구용어, 약칭 등) */
  aliases?: string[];
  description?: string;
  origin?: string;
  insertion?: string;
  action?: string;
  /** 지배신경 structure id */
  innervation?: string;
  bloodSupply?: string;
  course?: string;
  clinical?: string;
}

export interface SceneState {
  layers: Partial<Record<LayerId, Visibility>>;
  skinOpen: boolean;
  bicepsRetracted: boolean;
}

export interface IncisionSpec {
  /** 정답 절개선의 각도 (0 = 앞면 정중선, 음수 = 가쪽) */
  phiDeg: number;
  yFrom: number;
  yTo: number;
  /** 허용 평균 이탈 거리 (cm) */
  tolerance: number;
  /** 정답 구간 중 덮어야 하는 비율 */
  minCoverage: number;
}

interface StepBase {
  id: string;
  title: string;
  instruction: string;
  scene: SceneState;
}

export interface IncisionStep extends StepBase {
  type: 'incision';
  incision: IncisionSpec;
  /** 절개선이 지나가면 안 되는 구조물 */
  preserve: string[];
}

export interface ActionStep extends StepBase {
  type: 'action';
  actionLabel: string;
  effect: 'openSkin' | 'removeSubcutAndFascia' | 'retractBiceps';
}

export interface IdentifyStep extends StepBase {
  type: 'identify';
  targets: string[];
}

export type ScenarioStep = IncisionStep | ActionStep | IdentifyStep;

export interface Scenario {
  id: string;
  title: string;
  region: string;
  source: string;
  steps: ScenarioStep[];
}
