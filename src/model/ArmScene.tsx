import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { STRUCTURES, STRUCTURE_BY_ID } from '../data/structures';
import type { Structure } from '../types';
import { SCENARIO, useStore } from '../store';
import {
  BICEPS_RETRACT_OFFSET,
  MODEL_URL,
  NERVE_CURVES,
  PIN_POINTS,
  SKIN_HINGE_Z,
  isRealMesh,
  nerveGeometry,
  onShell,
  shellGeometry,
} from './anatomyGeometry';

const noRaycast = () => {};
const ZERO = new THREE.Vector3();

useGLTF.preload(MODEL_URL);

/** 실제 메시는 glb에서, 껍질과 신경은 메타데이터에서 만든다 */
function useStructureGeometry(id: string) {
  const gltf = useGLTF(MODEL_URL);
  return useMemo(() => {
    if (isRealMesh(id)) {
      const node = gltf.nodes[id] as THREE.Mesh | undefined;
      if (!node) throw new Error(`arm.glb에 ${id} 메시가 없습니다`);
      const g = node.geometry.clone();
      g.computeVertexNormals();
      return g;
    }
    if (NERVE_CURVES[id]) return nerveGeometry(id);
    if (id === 'subcutaneous') return shellGeometry('subcut');
    if (id === 'brachial_fascia') return shellGeometry('fascia');
    throw new Error(`geometry not defined for ${id}`);
  }, [gltf, id]);
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

function StructureMesh({ s }: { s: Structure }) {
  const geometry = useStructureGeometry(s.id);
  const vis = useStore((st) => st.layerVis[s.layer]);
  const isSelected = useStore((st) => st.selected === s.id);
  const isHovered = useStore((st) => st.hovered === s.id);
  const mode = useStore((st) => st.mode);
  const retracted = useStore((st) => st.bicepsRetracted);
  const hover = useStore((st) => st.hover);
  const click = useStore((st) => st.handleStructureClick);
  const group = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (s.id !== 'biceps_brachii' || !group.current) return;
    group.current.position.lerp(retracted ? BICEPS_RETRACT_OFFSET : ZERO, 1 - Math.exp(-dt * 5));
  });
  useCursor(isHovered, 'pointer');

  if (vis === 'hide') return null;
  const ghost = vis === 'ghost';
  const clickable = !ghost && mode !== 'quiz';
  const sheet = s.kind === 'tissue' || s.kind === 'fascia';

  return (
    <group ref={group}>
      <mesh
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

/** 피부는 안쪽·가쪽 두 장으로 나뉘어 뒤 정중선을 경첩 삼아 젖혀진다 */
function SkinFlaps() {
  const skin = STRUCTURE_BY_ID.skin;
  const medialGeom = useMemo(() => shellGeometry('skin', 0, 180), []);
  const lateralGeom = useMemo(() => shellGeometry('skin', 180, 360), []);
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

  const step = SCENARIO.steps[stepIndex];
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
      <group ref={medial} position={[0, 0, SKIN_HINGE_Z]}>
        <mesh geometry={medialGeom} position={[0, 0, -SKIN_HINGE_Z]} {...handlers}>
          {material}
        </mesh>
      </group>
      <group ref={lateral} position={[0, 0, SKIN_HINGE_Z]}>
        <mesh geometry={lateralGeom} position={[0, 0, -SKIN_HINGE_Z]} {...handlers}>
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
  const step = SCENARIO.steps[stepIndex];
  const endStroke = useStore((st) => st.endStroke);

  useEffect(() => {
    window.addEventListener('pointerup', endStroke);
    return () => window.removeEventListener('pointerup', endStroke);
  }, [endStroke]);

  const guide = useMemo(() => {
    if (step?.type !== 'incision') return [];
    const { phiDeg, yFrom, yTo } = step.incision;
    const n = Math.ceil(Math.abs(yFrom - yTo) / 0.4);
    return Array.from({ length: n + 1 }, (_, i) => onShell('skin', phiDeg, yFrom + ((yTo - yFrom) * i) / n, 0.06));
  }, [step]);

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
  const retracted = useStore((st) => st.bicepsRetracted);
  const ids = new Set<string>();
  if (mode !== 'quiz' && selected) ids.add(selected);
  if (mode === 'dissect') found.forEach((f) => ids.add(f));
  return (
    <>
      {[...ids].map((id) => {
        const p = PIN_POINTS[id];
        if (!p) return null;
        const pos = id === 'biceps_brachii' && retracted ? p.clone().add(BICEPS_RETRACT_OFFSET) : p;
        return (
          <Html key={id} position={pos} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`label3d ${id === selected ? 'is-selected' : ''}`}>{STRUCTURE_BY_ID[id].ko}</div>
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
  const q = quiz && !quiz.finished ? quiz.questions[quiz.index] : null;

  useEffect(() => {
    if (!q) return;
    const pin = PIN_POINTS[q.targetId];
    const dir = new THREE.Vector3(pin.x, 0, pin.z);
    if (dir.length() < 0.5) dir.set(0, 0, 1);
    dir.normalize();
    camera.position.set(dir.x * 40, pin.y * 0.5 + 2, dir.z * 40);
    if (controls) {
      controls.target.set(0, pin.y * 0.5, 0);
      controls.update();
    }
  }, [q, camera, controls]);

  if (!q) return null;
  const pin = PIN_POINTS[q.targetId];
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

export function ArmScene() {
  const tool = useStore((st) => st.tool);
  return (
    <>
      <color attach="background" args={['#f3f0ea']} />
      <hemisphereLight args={['#ffffff', '#b9a99a', 0.7]} />
      <directionalLight position={[8, 12, 14]} intensity={1.2} />
      <directionalLight position={[-10, -4, -10]} intensity={0.45} />
      <OrbitControls makeDefault enabled={tool === 'orbit'} target={[0, 0, 0]} minDistance={10} maxDistance={60} />
      <Suspense
        fallback={
          <Html center>
            <div className="label3d">모델 불러오는 중…</div>
          </Html>
        }
      >
        <SkinFlaps />
        {STRUCTURES.filter((s) => s.id !== 'skin').map((s) => (
          <StructureMesh key={s.id} s={s} />
        ))}
        <IncisionOverlay />
        <Labels />
        <QuizPin />
      </Suspense>
    </>
  );
}
