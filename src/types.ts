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
  /** 갈래라면 소속 근육 id (예: 'biceps_brachii') */
  group?: string;
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
  /** 신경 손상 시 나타나는 증상 (땡시 임상 문제용) */
  injury?: string;
}

export type Vec3 = [number, number, number];

export interface SceneState {
  layers: Partial<Record<LayerId, Visibility>>;
  skinOpen: boolean;
  /** 젖혀 둔 구조물(또는 갈래 묶음 id) → 이동량 (cm) */
  retracted: Record<string, Vec3>;
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
  effect: 'openSkin' | 'removeSubcutAndFascia' | 'retract';
  /** effect가 retract일 때: 갈고리로 당길 구조물들과 각각의 이동량 */
  retract?: { target: string; offset: Vec3 }[];
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
  /** 시나리오를 시작할 때 카메라가 바라볼 면 */
  view: 'anterior' | 'posterior';
  summary: string;
  source: string;
  steps: ScenarioStep[];
}
