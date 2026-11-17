// 부위별 변환 설정. build-region.mjs가 이 설정대로 BodyParts3D 메시를 잘라 glb와 메타데이터를 만든다.
//
// sources: 앱 structure id → [[FMA 개념 ID, OBJ 파일 ID], ...] (여러 파일이면 한 메시로 합친다)
// groups:  갈래 묶음 id → 갈래 id 목록 (라벨·핀·신경 배치용)
// zLo/zHi: 잘라낼 원본 높이(mm), axisFrom/axisZ: 축을 맞출 뼈와 높이 범위
// deep:    피부·근막 껍질이 감쌀 깊은 구조물, veins: 근막 바깥(피하조직)의 표재정맥
// nerves:  BodyParts3D에 없는 신경 경로를 실제 구조물 위치로 만드는 함수 (ctx는 build-region.mjs 참고)

import { catalogFor } from './catalog.mjs';

const lerp = (a, b, t) => a + (b - a) * t;

/** catalog 항목을 BodyParts3D 영어 이름으로 찾는 source로 바꾼다 (FMA·OBJ 파일은 빌드 때 목록에서 찾음) */
const fromCatalog = (region) =>
  Object.fromEntries(catalogFor(region).map((e) => [e.id, e.bp3d.map((name) => ({ name }))]));

export const REGIONS = {
  arm: {
    title: '오른쪽 위팔',
    zLo: 1030,
    zHi: 1280,
    axisFrom: ['humerus'],
    axisZ: [1060, 1260],
    sources: {
      humerus: [['FMA23130', 'FJ3368']],
      biceps_short_head: [['FMA37684', 'FJ1512']],
      biceps_long_head: [['FMA37686', 'FJ1478']],
      triceps_long_head: [['FMA37699', 'FJ1479']],
      triceps_lateral_head: [['FMA37697', 'FJ1477']],
      triceps_medial_head: [['FMA37695', 'FJ1480']],
      brachialis: [['FMA37668', 'FJ1486']],
      coracobrachialis: [['FMA37665', 'FJ1488']],
      brachial_artery: [['FMA22691', 'FJ2271']],
      deep_brachial_artery: [['FMA22696', 'FJ2277']],
      cephalic_vein: [['FMA13325', 'FJ2272']],
      basilic_vein: [['FMA22909', 'FJ2270']],
    },
    groups: {
      biceps_brachii: ['biceps_short_head', 'biceps_long_head'],
      triceps_brachii: ['triceps_long_head', 'triceps_lateral_head', 'triceps_medial_head'],
    },
    deep: [
      'humerus',
      'biceps_short_head',
      'biceps_long_head',
      'triceps_long_head',
      'triceps_lateral_head',
      'triceps_medial_head',
      'brachialis',
      'coracobrachialis',
      'brachial_artery',
      'deep_brachial_artery',
    ],
    veins: ['cephalic_vein', 'basilic_vein'],
    nerves: ({ ys, slice, frontmost }) => {
      const out = { median_nerve: [], ulnar_nerve: [], musculocutaneous_nerve: [], radial_nerve: [] };
      ys.forEach((y, i) => {
        const t = i / (ys.length - 1); // 0 = 위, 1 = 아래
        const a = frontmost('brachial_artery', y) ?? frontmost('brachial_artery', y + 1) ?? frontmost('brachial_artery', y - 1);
        const h = slice('humerus', y, 0.5);
        if (a) {
          // 정중신경: 위에서는 동맥 가쪽, 가운데에서 앞을 지나, 아래에서는 안쪽
          out.median_nerve.push([lerp(-0.55, 0.6, t) + a[0], y, a[2] + 0.35 + 0.35 * Math.sin(Math.PI * t)]);
          // 자신경: 동맥 안쪽에서 시작해 아래로 갈수록 뒤(안쪽위관절융기 뒤)로
          if (h) {
            const target = [h.maxX + 0.4, y, h.cz - 1.0];
            const s = Math.pow(t, 1.3);
            out.ulnar_nerve.push([lerp(a[0] + 0.7, target[0], s), y, lerp(a[2] - 0.2, target[2], s)]);
          }
        }
        // 근육피부신경: 위팔두갈래근과 위팔근(위쪽은 부리위팔근) 사이, 가쪽으로
        const b = slice('biceps_brachii', y);
        const deep = slice('brachialis', y) ?? slice('coracobrachialis', y);
        if (b && deep) out.musculocutaneous_nerve.push([(b.cx + deep.cx) / 2 - 0.6 * t, y, (b.cz + deep.cz) / 2]);
        // 노신경: 위팔뼈 둘레를 150°(뒤안쪽) → 180°(뒤) → 290°(앞가쪽)로 감아 돈다
        if (h) {
          const phi = (lerp(150, 290, Math.min(1, t * 1.1)) * Math.PI) / 180;
          // 아래쪽 위관절융기에서 위팔뼈 폭이 넓어지므로, 몸통 굵기로 상한을 둔다
          const r = Math.min((h.maxX - h.minX) / 2, 1.4) + 0.45;
          out.radial_nerve.push([h.cx + r * Math.sin(phi), y, h.cz + r * Math.cos(phi)]);
        }
      });
      return out;
    },
  },

  forearm: {
    title: '오른쪽 아래팔',
    zLo: 815,
    zHi: 1015,
    axisFrom: ['radius', 'ulna'],
    axisZ: [830, 1000],
    sources: {
      radius: [['FMA23464', 'FJ3349']],
      ulna: [['FMA23467', 'FJ3391']],
      pronator_teres: [
        ['FMA38560', 'FJ1474'], // humeral head
        ['FMA38562', 'FJ1516'], // ulnar head
      ],
      flexor_carpi_radialis: [['FMA38460', 'FJ1496']],
      palmaris_longus: [['FMA38463', 'FJ1502']],
      flexor_carpi_ulnaris: [
        ['FMA38617', 'FJ1473'], // humeral head
        ['FMA38619', 'FJ1518'], // ulnar head
      ],
      flexor_digitorum_superficialis: [['FMA38470', 'FJ1475'], ['FMA38470', 'FJ1499']],
      flexor_digitorum_profundus: [['FMA38479', 'FJ1497']],
      flexor_pollicis_longus: [['FMA38482', 'FJ1498']],
      pronator_quadratus: [['FMA38454', 'FJ1503']],
      brachioradialis: [['FMA38486', 'FJ1487']],
      extensor_carpi_radialis_longus: [['FMA38495', 'FJ1490']],
      extensor_carpi_radialis_brevis: [['FMA38498', 'FJ1489']],
      extensor_digitorum: [['FMA38501', 'FJ1492']],
      extensor_digiti_minimi: [['FMA38504', 'FJ1491']],
      extensor_carpi_ulnaris: [['FMA38507', 'FJ1472'], ['FMA38507', 'FJ1517']],
      anconeus: [['FMA37705', 'FJ1485']],
      supinator: [['FMA38513', 'FJ1505']],
      abductor_pollicis_longus: [['FMA38516', 'FJ1484']],
      extensor_pollicis_brevis: [['FMA38519', 'FJ1494']],
      extensor_pollicis_longus: [['FMA38522', 'FJ1495']],
      extensor_indicis: [['FMA38525', 'FJ1493']],
      radial_artery: [['FMA22733', 'FJ2294']],
      ulnar_artery: [['FMA22797', 'FJ2310']],
      anterior_interosseous_artery: [['FMA22812', 'FJ2266']],
      cephalic_vein: [['FMA13325', 'FJ2272']],
      basilic_vein: [['FMA22909', 'FJ2270']],
    },
    groups: {},
    deep: [
      'radius',
      'ulna',
      'pronator_teres',
      'flexor_carpi_radialis',
      'palmaris_longus',
      'flexor_carpi_ulnaris',
      'flexor_digitorum_superficialis',
      'flexor_digitorum_profundus',
      'flexor_pollicis_longus',
      'pronator_quadratus',
      'brachioradialis',
      'extensor_carpi_radialis_longus',
      'extensor_carpi_radialis_brevis',
      'extensor_digitorum',
      'extensor_digiti_minimi',
      'extensor_carpi_ulnaris',
      'anconeus',
      'supinator',
      'abductor_pollicis_longus',
      'extensor_pollicis_brevis',
      'extensor_pollicis_longus',
      'extensor_indicis',
      'radial_artery',
      'ulnar_artery',
      'anterior_interosseous_artery',
    ],
    veins: ['cephalic_vein', 'basilic_vein'],
    nerves: ({ ys, slice, mix }) => {
      const out = { median_nerve: [], ulnar_nerve: [], superficial_radial_nerve: [], posterior_interosseous_nerve: [] };
      ys.forEach((y) => {
        // 정중신경: 얕은손가락굽힘근과 깊은손가락굽힘근 사이 (아래팔 가운데)
        const fds = slice('flexor_digitorum_superficialis', y);
        const fdp = slice('flexor_digitorum_profundus', y);
        if (fds && fdp) out.median_nerve.push(mix(fds, fdp, 0.5, y));
        // 자신경: 자쪽손목굽힘근 밑, 깊은손가락굽힘근 위 (자동맥 안쪽)
        const fcu = slice('flexor_carpi_ulnaris', y);
        if (fcu && fdp) out.ulnar_nerve.push(mix(fcu, fdp, 0.45, y));
        // 노신경 얕은가지: 위팔노근 밑, 노동맥 가쪽
        const br = slice('brachioradialis', y);
        const ra = slice('radial_artery', y);
        if (br && ra) {
          const p = mix(br, ra, 0.5, y);
          out.superficial_radial_nerve.push([p[0] - 0.3, y, p[2]]);
        }
        // 뒤뼈사이신경: 얕은 폄근(손가락폄근)과 깊은 폄근·손뒤침근 사이
        const ed = slice('extensor_digitorum', y);
        const deepExt =
          slice('supinator', y) ?? slice('extensor_pollicis_longus', y) ?? slice('abductor_pollicis_longus', y);
        if (ed && deepExt) out.posterior_interosseous_nerve.push(mix(ed, deepExt, 0.55, y));
      });
      return out;
    },
  },

  // ---------- 몸통·어깨·손 (catalog.mjs의 구조물) ----------
  // straighten: false = 몸통은 이미 곧게 서 있어 축을 세우지 않는다. envelope: false = 생성한 피부층 없음.
  neck: {
    title: '목',
    maxTris: 4000,
    zLo: 1290,
    zHi: 1500,
    straighten: false,
    envelope: false,
    sources: fromCatalog('neck'),
  },
  shoulder: {
    title: '오른쪽 어깨·겨드랑이',
    maxTris: 4000,
    zLo: 1150,
    zHi: 1420,
    straighten: false,
    envelope: false,
    // 어깨관절을 보이기 위해 위팔뼈 위끝을 함께 넣는다
    sources: { ...fromCatalog('shoulder'), humerus: [['FMA23130', 'FJ3368']] },
  },
  back: {
    title: '등',
    maxTris: 4000,
    zLo: 830,
    zHi: 1510,
    straighten: false,
    envelope: false,
    sources: fromCatalog('back'),
  },
  thorax: {
    title: '가슴',
    maxTris: 4000,
    zLo: 990,
    zHi: 1400,
    straighten: false,
    envelope: false,
    sources: fromCatalog('thorax'),
  },
  abdomen: {
    title: '배',
    maxTris: 4000,
    zLo: 780,
    zHi: 1200,
    straighten: false,
    envelope: false,
    sources: fromCatalog('abdomen'),
  },
  hand: {
    title: '오른손',
    zLo: 650,
    zHi: 815,
    axisFrom: ['metacarpal_2', 'metacarpal_3', 'metacarpal_4'],
    axisZ: [730, 780],
    envelope: false,
    sources: {
      ...fromCatalog('hand'),
      // 아래팔 근육의 힘줄과 동맥이 손으로 이어지는 부분 (같은 구조물 id로 잘라 넣는다)
      ...Object.fromEntries(
        [
          'flexor_digitorum_superficialis', 'flexor_digitorum_profundus', 'flexor_pollicis_longus', 'flexor_carpi_radialis',
          'flexor_carpi_ulnaris', 'palmaris_longus', 'extensor_digitorum', 'extensor_digiti_minimi', 'extensor_indicis',
          'extensor_pollicis_longus', 'extensor_pollicis_brevis', 'abductor_pollicis_longus', 'extensor_carpi_radialis_longus',
          'extensor_carpi_radialis_brevis', 'extensor_carpi_ulnaris', 'radial_artery', 'ulnar_artery', 'cephalic_vein', 'basilic_vein',
        ].map((id) => [id, null]),
      ),
    },
  },
};

// 손 부위의 아래팔 구조물은 아래팔 설정의 source를 그대로 쓴다
for (const [id, src] of Object.entries(REGIONS.hand.sources)) if (src === null) REGIONS.hand.sources[id] = REGIONS.forearm.sources[id];

/** 상체 전체 보기: 모든 부위의 구조물을 원래 몸 위치에 모은다. 오른팔 구조물은 왼쪽으로 대칭 복사해 보여 준다. */
export const COMBINED = {
  id: 'upper_body',
  title: '상체 전체',
  zLo: 640,
  zHi: 1500,
  parts: ['neck', 'shoulder', 'back', 'thorax', 'abdomen', 'arm', 'forearm', 'hand'],
  /** 오른쪽만 있는 부위 → 왼쪽은 대칭 복사 */
  mirrorParts: ['shoulder', 'arm', 'forearm', 'hand'],
  /** 신경 경로를 가져올 부위 (원래 좌표로 되돌려 쓴다) */
  nerveParts: ['arm', 'forearm'],
};
