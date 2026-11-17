import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { STRUCTURE_BY_ID, structureName, structuresIn } from '../data/structures';
import { REGIONS } from '../data/regions';
import type { Structure, Vec3 } from '../types';
import { hasPin, incisionPhi, useScenario, useStore } from '../store';
import { regionGeometry, type RegionGeometry } from './anatomyGeometry';

const noRaycast = () => {};
const ZERO = new THREE.Vector3();

/** 구조물 자신 또는 소속 근육(갈래 묶음)에 걸린 젖힘 이동량 */
function retractOffset(retracted: Record<string, Vec3>, id: string): Vec3 | null {
  return retracted[id] ?? (STRUCTURE_BY_ID[id]?.group ? retracted[STRUCTURE_BY_ID[id].group!] : undefined) ?? null;
}

REGIONS.forEach((r) => useGLTF.preload(regionGeometry(r.id).modelUrl));

/** 지금 부위의 형상 */
const useGeo = () => regionGeometry(useStore((s) => s.region));

/** 실제 메시는 glb에서, 껍질과 신경은 메타데이터에서 만든다 */
function useStructureGeometry(s: Structure, geo: RegionGeometry) {
  const gltf = useGLTF(geo.modelUrl);
  return useMemo(() => {
    if (geo.isRealMesh(s.id)) {
      const node = gltf.nodes[s.id] as THREE.Mesh | undefined;
      if (!node) throw new Error(`${geo.regionId}.glb에 ${s.id} 메시가 없습니다`);
      const g = node.geometry.clone();
      g.computeVertexNormals();
      return g;
    }
    if (geo.nerveCurves[s.id]) return geo.nerveGeometry(s.id);
    if (s.kind === 'tissue') return geo.shellGeometry('subcut');
    if (s.kind === 'fascia') return geo.shellGeometry('fascia');
    throw new Error(`geometry not defined for ${s.id} in ${geo.regionId}`);
  }, [gltf, geo, s]);
}

function useCursor(active: boolean, kind: string) {
  useEffect(() => {
    if (!active) return;
    document.body.style.cursor = kind;
    return () => {
      document.body.style.cursor = '';
    };
  }, [active, kind]);
}

function StructureMesh({ s, geo }: { s: Structure; geo: RegionGeometry }) {
  const geometry = useStructureGeometry(s, geo);
  const vis = useStore((st) => st.layerVis[s.layer]);
  const isSelected = useStore((st) => st.selected === s.id);
  const isHovered = useStore((st) => st.hovered === s.id);
  const mode = useStore((st) => st.mode);
  const offset = useStore((st) => retractOffset(st.retracted, s.id));
  const target = useMemo(() => (offset ? new THREE.Vector3(...offset) : ZERO), [offset]);
  const hover = useStore((st) => st.hover);
  const click = useStore((st) => st.handleStructureClick);
  const group = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (!group.current) return;
    if (group.current.position.distanceToSquared(target) < 1e-6) return;
    group.current.position.lerp(target, 1 - Math.exp(-dt * 5));
  });
  useCursor(isHovered, 'pointer');

  if (vis === 'hide') return null;
  const ghost = vis === 'ghost';
  const clickable = !ghost && mode !== 'quiz';
  const sheet = s.kind === 'tissue' || s.kind === 'fascia';

  return (
    <group ref={group}>
      <mesh
        name={s.id}
        geometry={geometry}
        raycast={clickable ? THREE.Mesh.prototype.raycast : noRaycast}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          click(s.id);
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          hover(s.id);
        }}
        onPointerOut={() => hover(null)}
      >
        <meshStandardMaterial
          color={s.color}
          transparent={ghost || sheet}
          opacity={ghost ? 0.14 : sheet ? 0.93 : 1}
          depthWrite={!ghost}
          side={sheet ? THREE.DoubleSide : THREE.FrontSide}
          roughness={s.kind === 'bone' ? 0.85 : 0.55}
          emissive={isSelected ? '#ffb000' : isHovered ? '#666666' : '#000000'}
          emissiveIntensity={isSelected ? 0.45 : 0.25}
        />
      </mesh>
    </group>
  );
}

/** 피부는 절개선에서 두 장으로 갈라지고, 반대편 정중선을 경첩 삼아 젖혀진다 */
function SkinFlaps({ geo }: { geo: RegionGeometry }) {
  const skin = STRUCTURE_BY_ID.skin;
  const scenario = useScenario();
  const cut = incisionPhi(scenario);
  const { geomA, geomB, hinge } = useMemo(
    () => ({
      geomA: geo.shellGeometry('skin', cut, cut + 180),
      geomB: geo.shellGeometry('skin', cut + 180, cut + 360),
      hinge: geo.onShell('skin', cut + 180, 0),
    }),
    [cut, geo],
  );
  const vis = useStore((st) => st.layerVis.skin);
  const open = useStore((st) => st.skinOpen);
  const mode = useStore((st) => st.mode);
  const tool = useStore((st) => st.tool);
  const stepIndex = useStore((st) => st.stepIndex);
  const incision = useStore((st) => st.incision);
  const drawing = useStore((st) => st.drawing);
  const isSelected = useStore((st) => st.selected === 'skin');
  const { beginStroke, extendStroke, handleStructureClick } = useStore.getState();
  const medial = useRef<THREE.Group>(null);
  const lateral = useRef<THREE.Group>(null);

  const step = mode === 'dissect' ? scenario.steps[stepIndex] : undefined;
  const canCut =
    mode === 'dissect' && step?.type === 'incision' && tool === 'scalpel' && !open && !incision?.pass;
  useCursor(canCut, 'crosshair');

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 3);
    const angle = open ? 1.9 : 0;
    if (medial.current) medial.current.rotation.y += (angle - medial.current.rotation.y) * k;
    if (lateral.current) lateral.current.rotation.y += (-angle - lateral.current.rotation.y) * k;
  });

  if (vis === 'hide') return null;
  const ghost = vis === 'ghost';

  const handlers = {
    raycast: ghost || mode === 'quiz' ? noRaycast : THREE.Mesh.prototype.raycast,
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (!canCut) return;
      e.stopPropagation();
      beginStroke(e.point);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (canCut && drawing) extendStroke(e.point);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      // 피부 뒤의 구조물로 클릭이 새지 않도록 항상 막는다
      e.stopPropagation();
      if (!canCut) handleStructureClick('skin');
    },
  };

  const material = (
    <meshStandardMaterial
      color={skin.color}
      side={THREE.DoubleSide}
      transparent={ghost}
      opacity={ghost ? 0.14 : 1}
      depthWrite={!ghost}
      roughness={0.7}
      emissive={isSelected ? '#ffb000' : '#000000'}
      emissiveIntensity={0.3}
    />
  );

  return (
    <>
      {/* A판(절개선→+180°)은 +각도, B판은 -각도로 경첩을 중심으로 돈다 */}
      <group ref={medial} position={[hinge.x, 0, hinge.z]}>
        <mesh name="skin" geometry={geomA} position={[-hinge.x, 0, -hinge.z]} {...handlers}>
          {material}
        </mesh>
      </group>
      <group ref={lateral} position={[hinge.x, 0, hinge.z]}>
        <mesh name="skin" geometry={geomB} position={[-hinge.x, 0, -hinge.z]} {...handlers}>
          {material}
        </mesh>
      </group>
    </>
  );
}

function IncisionOverlay() {
  const strokes = useStore((st) => st.strokes);
  const open = useStore((st) => st.skinOpen);
  const mode = useStore((st) => st.mode);
  const showGuide = useStore((st) => st.showGuide);
  const stepIndex = useStore((st) => st.stepIndex);
  const step = useScenario().steps[stepIndex];
  const endStroke = useStore((st) => st.endStroke);
  const geo = useGeo();

  useEffect(() => {
    window.addEventListener('pointerup', endStroke);
    return () => window.removeEventListener('pointerup', endStroke);
  }, [endStroke]);

  const guide = useMemo(() => {
    if (step?.type !== 'incision') return [];
    const { phiDeg, yFrom, yTo } = step.incision;
    const n = Math.ceil(Math.abs(yFrom - yTo) / 0.4);
    return Array.from({ length: n + 1 }, (_, i) => geo.onShell('skin', phiDeg, yFrom + ((yTo - yFrom) * i) / n, 0.06));
  }, [step, geo]);

  if (mode !== 'dissect' || open) return null;
  const lift = (p: THREE.Vector3) => new THREE.Vector3(p.x * 1.012, p.y, p.z * 1.012);

  return (
    <>
      {showGuide && step?.type === 'incision' && (
        <Line
          points={guide}
          color="#2563eb"
          lineWidth={2}
          dashed
          dashSize={0.6}
          gapSize={0.4}
          transparent
          opacity={0.75}
        />
      )}
      {strokes
        .filter((s) => s.length > 1)
        .map((s, i) => (
          <Line key={i} points={s.map(lift)} color="#7f1d1d" lineWidth={3.5} />
        ))}
    </>
  );
}

function Labels() {
  const mode = useStore((st) => st.mode);
  const selected = useStore((st) => st.selected);
  const found = useStore((st) => st.found);
  const retracted = useStore((st) => st.retracted);
  const geo = useGeo();
  const ids = new Set<string>();
  if (mode !== 'quiz' && selected) ids.add(selected);
  if (mode === 'dissect') found.forEach((f) => ids.add(f));
  return (
    <>
      {[...ids].map((id) => {
        const p = geo.pins[id];
        if (!p) return null;
        const off = retractOffset(retracted, id);
        const pos = off ? p.clone().add(new THREE.Vector3(...off)) : p;
        return (
          <Html key={id} position={pos} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`label3d ${id === selected ? 'is-selected' : ''}`}>{structureName(id)}</div>
          </Html>
        );
      })}
    </>
  );
}

function QuizPin() {
  const quiz = useStore((st) => st.quiz);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const current = quiz && !quiz.finished ? quiz.questions[quiz.index] : null;
  const q = current && hasPin(current) ? current : null;
  const geo = useGeo();

  useEffect(() => {
    if (!q) return;
    const pin = geo.pins[q.targetId];
    const dir = new THREE.Vector3(pin.x, 0, pin.z);
    if (dir.length() < 0.5) dir.set(0, 0, 1);
    dir.normalize();
    camera.position.set(dir.x * 40, pin.y * 0.5 + 2, dir.z * 40);
    if (controls) {
      controls.target.set(0, pin.y * 0.5, 0);
      controls.update();
    }
  }, [q, camera, controls, geo]);

  if (!q) return null;
  const pin = geo.pins[q.targetId];
  return (
    <group position={pin}>
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#e11d48" />
      </mesh>
      <Html center position={[0, 1.1, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="pin-badge">{quiz!.index + 1}</div>
      </Html>
    </group>
  );
}

/** 개발 중 콘솔에서 장면을 검사하기 위한 훅 (배포 빌드에는 포함되지 않음) */
function DevSceneHook() {
  const state = useThree();
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __three: typeof state }).__three = state;
  }, [state]);
  return null;
}

/** 시나리오 시작 등에서 요청한 방향(φ)으로 카메라를 옮긴다 */
function CameraRig() {
  const request = useStore((st) => st.cameraRequest);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  useEffect(() => {
    if (!request) return;
    const rad = (request.phi * Math.PI) / 180;
    camera.position.set(44 * Math.sin(rad), 2, 44 * Math.cos(rad));
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [request, camera, controls]);
  return null;
}

export function ArmScene() {
  const tool = useStore((st) => st.tool);
  const region = useStore((st) => st.region);
  const geo = regionGeometry(region);
  const structures = useMemo(() => structuresIn(region).filter((s) => s.id !== 'skin'), [region]);
  return (
    <>
      <color attach="background" args={['#f3f0ea']} />
      <hemisphereLight args={['#ffffff', '#b9a99a', 0.7]} />
      <directionalLight position={[8, 12, 14]} intensity={1.2} />
      <directionalLight position={[-10, -4, -10]} intensity={0.45} />
      <OrbitControls makeDefault enabled={tool === 'orbit'} target={[0, 0, 0]} minDistance={10} maxDistance={60} />
      <CameraRig />
      {import.meta.env.DEV && <DevSceneHook />}
      <Suspense
        fallback={
          <Html center>
            <div className="label3d">모델 불러오는 중…</div>
          </Html>
        }
      >
        <SkinFlaps key={`skin-${region}`} geo={geo} />
        {structures.map((s) => (
          <StructureMesh key={`${region}-${s.id}`} s={s} geo={geo} />
        ))}
        <IncisionOverlay />
        <Labels />
        <QuizPin />
      </Suspense>
    </>
  );
}
