// 위팔·아래팔 밖의 상체 구조물 목록 (목, 어깨, 등, 가슴, 배, 손).
// 변환 스크립트는 bp3d(BodyParts3D 영어 이름)로 메시를 찾고, 앱은 같은 목록을 catalog.json으로 읽어 이름·설명을 쓴다.
// 용어: 대한해부학회 용어 기준, 구용어는 aliases. 좌우가 있는 몸통 구조물은 id 끝에 _r/_l을 붙인다.
// 이름에서 '오른쪽/왼쪽'을 뺀 기본 이름도 aliases에 넣어 땡시에서 좌우 없이 답해도 맞게 한다.

const C = {
  bone: '#ece6d6',
  cartilage: '#dfe7ef',
  muscle: '#c0504d',
  muscleDeep: '#a8433f',
  muscleBack: '#9c3d3a',
  artery: '#d7263d',
  vein: '#3f5fd6',
};

const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const SIDES = [
  { s: 'r', en: 'right', En: 'Right', ko: '오른쪽' },
  { s: 'l', en: 'left', En: 'Left', ko: '왼쪽' },
];

/** 좌우 한 쌍. bp3d는 (side) => 영어 이름(들) */
function pair(id, regions, base) {
  return SIDES.map((sd) => {
    const names = base.bp3d(sd.en);
    return {
      ...base,
      id: `${id}_${sd.s}`,
      regions,
      bp3d: Array.isArray(names) ? names : [names],
      ko: `${sd.ko} ${base.ko}`,
      en: `${sd.En} ${base.en.charAt(0).toLowerCase()}${base.en.slice(1)}`,
      aliases: [base.ko, base.en, ...(base.aliases ?? [])],
    };
  });
}
const one = (id, regions, base) => ({ ...base, id, regions, bp3d: Array.isArray(base.bp3d) ? base.bp3d : [base.bp3d] });

const muscle = (o) => ({ layer: 'muscle', kind: 'muscle', color: C.muscle, ...o });
const bone = (o) => ({ layer: 'bone', kind: 'bone', color: C.bone, ...o });
const organ = (o) => ({ layer: 'organ', kind: 'organ', ...o });
const artery = (o) => ({ layer: 'neurovascular', kind: 'artery', color: C.artery, ...o });
const vein = (o) => ({ layer: 'neurovascular', kind: 'vein', color: C.vein, ...o });

// ---------------- 목 ----------------
const cervical = [
  bone({ id: 'atlas', ko: '고리뼈', en: 'Atlas', la: 'Atlas', bp3d: 'atlas', aliases: ['제1목뼈', '환추', 'C1'], description: '첫째 목뼈. 몸통과 가시돌기가 없는 고리 모양으로, 뒤통수뼈와 고리뒤통수관절을 이룬다.' }),
  bone({ id: 'axis', ko: '중쇠뼈', en: 'Axis', la: 'Axis', bp3d: 'axis', aliases: ['제2목뼈', '축추', 'C2'], description: '둘째 목뼈. 위로 솟은 치아돌기가 고리뼈 안에서 축이 되어 머리를 돌린다.' }),
  ...[3, 4, 5, 6, 7].map((n) =>
    bone({
      id: `cervical_${n}`,
      ko: n === 7 ? '제7목뼈(솟을뼈)' : `제${n}목뼈`,
      en: `${ORD[n - 1].charAt(0).toUpperCase()}${ORD[n - 1].slice(1)} cervical vertebra`,
      la: n === 7 ? 'Vertebra prominens' : `Vertebra cervicalis ${ROMAN[n - 1]}`,
      bp3d: `${ORD[n - 1]} cervical vertebra`,
      aliases: [`C${n}`, `제${n}경추`, ...(n === 7 ? ['솟을뼈', '제7목뼈', '융추'] : [])],
      description:
        n === 7
          ? '가시돌기가 길어 목 뒤에서 가장 잘 만져지는 목뼈. 척추 높이를 세는 기준점이 된다.'
          : '가로돌기에 가로구멍이 있어 척추동맥이 지나가는 것이 목뼈의 특징이다.',
    }),
  ),
].map((b) => one(b.id, ['neck', 'back'], b));

const neck = [
  ...cervical,
  one('hyoid', ['neck'], bone({ ko: '목뿔뼈', en: 'Hyoid bone', la: 'Os hyoideum', bp3d: 'hyoid bone', aliases: ['설골'], description: '다른 뼈와 관절을 이루지 않고 근육과 인대로만 매달린 U자 뼈. 혀와 후두를 받친다.' })),
  one('thyroid_cartilage', ['neck'], organ({ ko: '방패연골', en: 'Thyroid cartilage', la: 'Cartilago thyroidea', bp3d: 'thyroid cartilage', color: C.cartilage, aliases: ['갑상연골'], description: '후두에서 가장 큰 연골. 두 판이 앞에서 만나 후두융기(울대뼈)를 이룬다.' })),
  one('cricoid_cartilage', ['neck'], organ({ ko: '반지연골', en: 'Cricoid cartilage', la: 'Cartilago cricoidea', bp3d: 'cricoid cartilage', color: C.cartilage, aliases: ['윤상연골'], description: '후두 아래쪽의 완전한 고리 연골. C6 높이로, 아래로 기관이 이어진다.', clinical: '반지방패막(윤상갑상막)은 응급 기도 확보(반지방패막절개) 자리다.' })),
  ...pair('sternocleidomastoid', ['neck'], muscle({
    ko: '목빗근', en: 'Sternocleidomastoid', la: 'Musculus sternocleidomastoideus', aliases: ['흉쇄유돌근', 'SCM'],
    bp3d: (s) => `${s} sternocleidomastoid`,
    origin: '복장갈래: 복장뼈자루 앞면 / 빗장갈래: 빗장뼈 안쪽 1/3',
    insertion: '관자뼈 꼭지돌기, 위목덜미선 가쪽',
    action: '한쪽: 머리를 같은 쪽으로 기울이고 얼굴을 반대쪽으로 돌림 / 양쪽: 목 굽힘',
    innervationNote: '더부신경(제11뇌신경)',
    clinical: '목을 앞삼각과 뒤삼각으로 나눈다. 짧아지면 선천 근육성 사경이 생긴다.',
  })),
  ...pair('scalenus_anterior', ['neck'], muscle({
    ko: '앞목갈비근', en: 'Scalenus anterior', la: 'Musculus scalenus anterior', aliases: ['전사각근'], color: C.muscleDeep,
    bp3d: (s) => `${s} scalenus anterior`,
    origin: '제3~6목뼈 가로돌기 앞결절', insertion: '제1갈비뼈 앞목갈비근결절',
    action: '제1갈비뼈 올림(들숨 보조), 목 가쪽굽힘', innervationNote: '목신경 앞가지(C4~C6)',
    clinical: '앞·중간목갈비근 사이(목갈비근사이틈)로 빗장밑동맥과 팔신경얼기가 지나간다. 빗장밑정맥은 이 근육 앞을 지난다.',
  })),
  ...pair('scalenus_medius', ['neck'], muscle({
    ko: '중간목갈비근', en: 'Scalenus medius', la: 'Musculus scalenus medius', aliases: ['중사각근'], color: C.muscleDeep,
    bp3d: (s) => `${s} scalenus medius`,
    origin: '제2~7목뼈 가로돌기 뒤결절', insertion: '제1갈비뼈 위면 (빗장밑동맥고랑 뒤)',
    action: '제1갈비뼈 올림, 목 가쪽굽힘', innervationNote: '목신경 앞가지(C3~C8)',
  })),
  ...pair('scalenus_posterior', ['neck'], muscle({
    ko: '뒤목갈비근', en: 'Scalenus posterior', la: 'Musculus scalenus posterior', aliases: ['후사각근'], color: C.muscleDeep,
    bp3d: (s) => `${s} scalenus posterior`,
    origin: '제4~6목뼈 가로돌기 뒤결절', insertion: '제2갈비뼈 바깥면',
    action: '제2갈비뼈 올림, 목 가쪽굽힘', innervationNote: '목신경 앞가지(C6~C8)',
  })),
  ...pair('platysma', ['neck'], muscle({
    ko: '넓은목근', en: 'Platysma', la: 'Platysma', aliases: ['광경근'],
    bp3d: (s) => `${s} platysma`,
    origin: '큰가슴근·어깨세모근 위의 근막', insertion: '아래턱뼈 아래모서리, 입꼬리 피부',
    action: '목 피부를 긴장시키고 입꼬리를 아래로 당김', innervationNote: '얼굴신경 목가지',
    clinical: '피하조직 안에 있는 얇은 피부근이다.',
  })),
  ...pair('common_carotid', ['neck'], artery({
    ko: '온목동맥', en: 'Common carotid artery', la: 'Arteria carotis communis', aliases: ['총경동맥'],
    bp3d: (s) => `${s} common carotid artery`,
    course: '오른쪽은 팔머리동맥에서, 왼쪽은 대동맥활에서 시작한다. 목동맥집 안에서 속목정맥 안쪽을 올라가 방패연골 위모서리 높이에서 속·바깥목동맥으로 갈라진다.',
    clinical: '갈림부의 목동맥팽대는 혈압을 감지한다. 목에서 맥박을 짚는 자리다.',
  })),
  ...pair('internal_jugular', ['neck'], vein({
    ko: '속목정맥', en: 'Internal jugular vein', la: 'Vena jugularis interna', aliases: ['내경정맥'],
    bp3d: (s) => `${s} internal jugular vein`,
    course: '목정맥구멍에서 시작해 목동맥집 안에서 온목동맥 가쪽을 내려가, 빗장밑정맥과 합쳐 팔머리정맥이 된다.',
    clinical: '중심정맥관을 넣는 대표적인 자리다.',
  })),
];

// ---------------- 어깨 (오른쪽) ----------------
const shoulder = [
  one('clavicle', ['shoulder'], bone({ ko: '빗장뼈', en: 'Clavicle', la: 'Clavicula', bp3d: 'right clavicle', aliases: ['쇄골'], description: '팔을 몸통에 잇는 유일한 뼈 버팀대. 안쪽은 복장뼈, 가쪽은 어깨뼈봉우리와 관절을 이룬다.', clinical: '가운데 1/3과 가쪽 1/3 경계에서 가장 잘 부러진다.' })),
  one('scapula', ['shoulder', 'back'], bone({ ko: '어깨뼈', en: 'Scapula', la: 'Scapula', bp3d: 'right scapula', aliases: ['견갑골'], description: '가슴우리 뒤쪽 제2~7갈비뼈 높이의 세모난 납작뼈. 어깨뼈가시·봉우리·부리돌기·관절오목이 있다.' })),
  one('deltoid', ['shoulder'], muscle({
    ko: '어깨세모근', en: 'Deltoid', la: 'Musculus deltoideus', aliases: ['삼각근'],
    bp3d: ['clavicular part of right deltoid', 'acromial part of right deltoid', 'spinal part of right deltoid'],
    origin: '빗장뼈 가쪽 1/3, 어깨뼈봉우리, 어깨뼈가시', insertion: '위팔뼈 세모근거친면',
    action: '봉우리부분: 위팔 벌림(15° 이후) / 빗장부분: 굽힘·안쪽돌림 / 가시부분: 폄·가쪽돌림',
    innervationNote: '겨드랑신경(C5·C6)',
    clinical: '위팔뼈 외과목 골절이나 어깨 탈구 때 겨드랑신경이 다치면 이 근육이 마비된다.',
  })),
  one('supraspinatus', ['shoulder', 'back'], muscle({
    ko: '가시위근', en: 'Supraspinatus', la: 'Musculus supraspinatus', aliases: ['극상근'], color: C.muscleDeep, bp3d: 'right supraspinatus',
    origin: '어깨뼈 가시위오목', insertion: '위팔뼈 큰결절 위면', action: '위팔 벌림 시작(처음 15°), 위팔뼈머리 안정',
    innervationNote: '어깨위신경(C5·C6)', clinical: '돌림근띠 중 가장 흔히 찢어지는 힘줄이다.',
  })),
  one('infraspinatus', ['shoulder', 'back'], muscle({
    ko: '가시아래근', en: 'Infraspinatus', la: 'Musculus infraspinatus', aliases: ['극하근'], color: C.muscleDeep,
    bp3d: 'infraspinatus', origin: '어깨뼈 가시아래오목', insertion: '위팔뼈 큰결절 가운데면', action: '위팔 가쪽돌림, 위팔뼈머리 안정',
    innervationNote: '어깨위신경(C5·C6)',
  })),
  one('teres_minor', ['shoulder', 'back'], muscle({
    ko: '작은원근', en: 'Teres minor', la: 'Musculus teres minor', aliases: ['소원근'], color: C.muscleDeep, bp3d: 'right teres minor',
    origin: '어깨뼈 가쪽모서리 위쪽 2/3', insertion: '위팔뼈 큰결절 아래면', action: '위팔 가쪽돌림, 위팔뼈머리 안정', innervationNote: '겨드랑신경',
  })),
  one('subscapularis', ['shoulder'], muscle({
    ko: '어깨밑근', en: 'Subscapularis', la: 'Musculus subscapularis', aliases: ['견갑하근'], color: C.muscleDeep, bp3d: 'right subscapularis',
    origin: '어깨뼈 어깨밑오목', insertion: '위팔뼈 작은결절', action: '위팔 안쪽돌림, 위팔뼈머리 안정', innervationNote: '위·아래어깨밑신경',
    clinical: '돌림근띠 네 근육(가시위근·가시아래근·작은원근·어깨밑근) 가운데 유일하게 앞쪽에 있다.',
  })),
  one('teres_major', ['shoulder', 'back'], muscle({
    ko: '큰원근', en: 'Teres major', la: 'Musculus teres major', aliases: ['대원근'], bp3d: 'right teres major',
    origin: '어깨뼈 아래각 뒷면', insertion: '위팔뼈 결절사이고랑 안쪽입술', action: '위팔 모음·안쪽돌림·폄', innervationNote: '아래어깨밑신경',
    clinical: '아래모서리에서 겨드랑동맥이 위팔동맥으로 이름이 바뀐다.',
  })),
  one('axillary_artery', ['shoulder'], artery({
    ko: '겨드랑동맥', en: 'Axillary artery', la: 'Arteria axillaris', aliases: ['액와동맥'], bp3d: 'right axillary artery',
    course: '제1갈비뼈 가쪽모서리에서 빗장밑동맥에 이어지고, 큰원근 아래모서리에서 위팔동맥이 된다. 작은가슴근이 세 부분으로 나눈다.',
  })),
  one('axillary_vein', ['shoulder'], vein({
    ko: '겨드랑정맥', en: 'Axillary vein', la: 'Vena axillaris', aliases: ['액와정맥'], bp3d: 'right axillary vein',
    course: '큰원근 아래모서리에서 위팔정맥·자쪽피부정맥이 모여 시작하고, 제1갈비뼈 가쪽모서리에서 빗장밑정맥이 된다.',
  })),
];

// ---------------- 척주 (등뼈·허리뼈) ----------------
const thoracicVertebrae = Array.from({ length: 12 }, (_, i) =>
  one(`thoracic_${i + 1}`, ['thorax', 'back'], bone({
    ko: `제${i + 1}등뼈`, en: `${ORD[i].charAt(0).toUpperCase()}${ORD[i].slice(1)} thoracic vertebra`, la: `Vertebra thoracica ${ROMAN[i]}`,
    bp3d: `${ORD[i]} thoracic vertebra`, aliases: [`T${i + 1}`, `제${i + 1}흉추`],
    description: '몸통과 가로돌기에 갈비뼈와 관절하는 오목이 있다. 가시돌기가 길고 아래로 기운다.',
  })),
);
const lumbarVertebrae = Array.from({ length: 5 }, (_, i) =>
  one(`lumbar_${i + 1}`, ['abdomen', 'back'], bone({
    ko: `제${i + 1}허리뼈`, en: `${ORD[i].charAt(0).toUpperCase()}${ORD[i].slice(1)} lumbar vertebra`, la: `Vertebra lumbalis ${ROMAN[i]}`,
    bp3d: `${ORD[i]} lumbar vertebra`, aliases: [`L${i + 1}`, `제${i + 1}요추`],
    description: '척추뼈 가운데 몸통이 가장 크고, 가시돌기가 뒤로 곧게 뻗는다.',
    ...(i === 3 ? { clinical: '엉덩뼈능선 꼭대기를 이은 선(야코비선)이 제4허리뼈 가시돌기를 지나, 허리천자 위치를 잡는 기준이 된다.' } : {}),
  })),
);

// ---------------- 등 ----------------
const back = [
  ...pair('trapezius', ['back', 'neck'], muscle({
    ko: '등세모근', en: 'Trapezius', la: 'Musculus trapezius', aliases: ['승모근'], color: C.muscleBack,
    bp3d: (s) => [`descending part of ${s} trapezius`, `transverse part of ${s} trapezius`, `ascending part of ${s} trapezius`],
    origin: '위목덜미선, 바깥뒤통수뼈융기, 목덜미인대, 제7목뼈~제12등뼈 가시돌기',
    insertion: '빗장뼈 가쪽 1/3, 어깨뼈봉우리, 어깨뼈가시',
    action: '내림부분: 어깨뼈 올림 / 가로부분: 뒤당김 / 오름부분: 내림 · 함께 어깨뼈 위쪽돌림',
    innervationNote: '더부신경(제11뇌신경), 감각은 목신경(C3·C4)',
    clinical: '더부신경이 다치면 어깨가 처지고 팔을 머리 위로 들기 어렵다.',
  })),
  ...pair('rhomboid_major', ['back'], muscle({
    ko: '큰마름근', en: 'Rhomboid major', la: 'Musculus rhomboideus major', aliases: ['대능형근'], color: C.muscleDeep,
    bp3d: (s) => `${s} rhomboid major`,
    origin: '제2~5등뼈 가시돌기', insertion: '어깨뼈 안쪽모서리 (어깨뼈가시 아래)', action: '어깨뼈 뒤당김·아래쪽돌림', innervationNote: '등쪽어깨신경(C4·C5)',
  })),
  ...pair('rhomboid_minor', ['back'], muscle({
    ko: '작은마름근', en: 'Rhomboid minor', la: 'Musculus rhomboideus minor', aliases: ['소능형근'], color: C.muscleDeep,
    bp3d: (s) => `${s} rhomboid minor`,
    origin: '목덜미인대, 제7목뼈·제1등뼈 가시돌기', insertion: '어깨뼈 안쪽모서리 (어깨뼈가시 높이)', action: '어깨뼈 뒤당김·아래쪽돌림', innervationNote: '등쪽어깨신경(C4·C5)',
  })),
  ...pair('levator_scapulae', ['back', 'neck'], muscle({
    ko: '어깨올림근', en: 'Levator scapulae', la: 'Musculus levator scapulae', aliases: ['견갑거근'], color: C.muscleDeep,
    bp3d: (s) => `${s} levator scapulae`,
    origin: '제1~4목뼈 가로돌기', insertion: '어깨뼈 위각과 안쪽모서리 위쪽', action: '어깨뼈 올림·아래쪽돌림', innervationNote: '등쪽어깨신경, 목신경(C3·C4)',
  })),
  one('iliocostalis', ['back'], muscle({
    ko: '엉덩갈비근', en: 'Iliocostalis', la: 'Musculus iliocostalis', aliases: ['장늑근'], color: C.muscleBack, bp3d: 'iliocostalis',
    origin: '엉치뼈, 엉덩뼈능선, 허리뼈 가시돌기 (척주세움근 공통 힘줄)', insertion: '갈비뼈각, 아래 목뼈 가로돌기',
    action: '척주 폄·가쪽굽힘', innervationNote: '척수신경 뒤가지', description: '척주세움근 세 기둥 가운데 가장 가쪽 기둥 (좌우 함께 표시).',
  })),
  one('longissimus', ['back'], muscle({
    ko: '가장긴근', en: 'Longissimus', la: 'Musculus longissimus', aliases: ['최장근'], color: C.muscleBack, bp3d: 'longissimus',
    origin: '척주세움근 공통 힘줄, 등뼈 가로돌기', insertion: '갈비뼈, 등·목뼈 가로돌기, 관자뼈 꼭지돌기',
    action: '척주 폄·가쪽굽힘, 머리 폄', innervationNote: '척수신경 뒤가지', description: '척주세움근 가운데 기둥 (좌우 함께 표시).',
  })),
  one('spinalis', ['back'], muscle({
    ko: '가시근', en: 'Spinalis', la: 'Musculus spinalis', aliases: ['극근'], color: C.muscleBack, bp3d: 'spinalis',
    origin: '위 허리뼈·아래 등뼈 가시돌기', insertion: '위 등뼈 가시돌기',
    action: '척주 폄', innervationNote: '척수신경 뒤가지', description: '척주세움근 가운데 가장 안쪽 기둥 (좌우 함께 표시).',
  })),
  ...thoracicVertebrae,
  ...lumbarVertebrae,
];

// ---------------- 가슴 ----------------
const ribs = [];
for (let i = 0; i < 12; i++) {
  ribs.push(
    ...pair(`rib_${i + 1}`, ['thorax'], bone({
      ko: `제${i + 1}갈비뼈`, en: `${ORD[i].charAt(0).toUpperCase()}${ORD[i].slice(1)} rib`, la: `Costa ${ROMAN[i]}`,
      bp3d: (s) => `${s} ${ORD[i]} rib`, aliases: [`제${i + 1}늑골`, '갈비뼈'],
      description: i < 7 ? '참갈비뼈: 자기 갈비연골로 복장뼈에 직접 붙는다.' : i < 10 ? '거짓갈비뼈: 갈비연골이 위 갈비연골에 붙는다.' : '뜬갈비뼈: 앞끝이 복장뼈에 닿지 않는다.',
      ...(i === 0 ? { clinical: '가장 짧고 넓으며, 위면에 빗장밑동맥·정맥이 지나는 고랑이 있다.' } : {}),
    })),
  );
}
const costalCartilages = [];
for (let i = 0; i < 7; i++) {
  costalCartilages.push(
    ...pair(`costal_cartilage_${i + 1}`, ['thorax'], bone({
      ko: `제${i + 1}갈비연골`, en: `${ORD[i].charAt(0).toUpperCase()}${ORD[i].slice(1)} costal cartilage`, la: `Cartilago costalis ${ROMAN[i]}`,
      bp3d: (s) => `${s} ${ORD[i]} costal cartilage`, aliases: [`제${i + 1}늑연골`, '갈비연골'], color: C.cartilage, kind: 'cartilage',
      description: '갈비뼈 앞끝을 복장뼈에 잇는 유리연골. 숨 쉴 때 가슴우리가 움직이게 해 준다.',
    })),
  );
}
const thorax = [
  one('sternum', ['thorax'], bone({
    ko: '복장뼈', en: 'Sternum', la: 'Sternum', aliases: ['흉골'], bp3d: ['manubrium', 'body of sternum', 'xiphoid process'],
    description: '복장뼈자루·몸통·칼돌기로 이루어진다. 자루와 몸통이 만나는 복장뼈각은 제2갈비연골 높이로 갈비뼈를 세는 기준이다.',
    clinical: '복장뼈각 높이(T4~T5)에서 기관이 갈라지고 대동맥활이 시작·끝난다.',
  })),
  ...ribs,
  ...costalCartilages,
  ...thoracicVertebrae,
  ...pair('pectoralis_major', ['thorax'], muscle({
    ko: '큰가슴근', en: 'Pectoralis major', la: 'Musculus pectoralis major', aliases: ['대흉근'],
    bp3d: (s) => `${s} pectoralis major`,
    origin: '빗장갈래: 빗장뼈 안쪽 절반 / 복장갈비갈래: 복장뼈, 제1~6갈비연골, 배바깥빗근 널힘줄',
    insertion: '위팔뼈 결절사이고랑 가쪽입술', action: '위팔 모음·안쪽돌림 / 빗장갈래: 굽힘',
    innervationNote: '가쪽·안쪽가슴신경', clinical: '아래모서리가 겨드랑 앞벽(앞겨드랑주름)을 이룬다.',
  })),
  ...pair('pectoralis_minor', ['thorax', 'shoulder'], muscle({
    ko: '작은가슴근', en: 'Pectoralis minor', la: 'Musculus pectoralis minor', aliases: ['소흉근'], color: C.muscleDeep,
    bp3d: (s) => `${s} pectoralis minor`,
    origin: '제3~5갈비뼈 앞면', insertion: '어깨뼈 부리돌기', action: '어깨뼈를 앞아래로 당김', innervationNote: '안쪽가슴신경',
    clinical: '겨드랑동맥을 세 부분으로 나누는 기준이다.',
  })),
  ...pair('serratus_anterior', ['thorax', 'shoulder'], muscle({
    ko: '앞톱니근', en: 'Serratus anterior', la: 'Musculus serratus anterior', aliases: ['전거근'],
    bp3d: (s) => `${s} serratus anterior`,
    origin: '제1~8(9)갈비뼈 바깥면', insertion: '어깨뼈 안쪽모서리 앞면', action: '어깨뼈 앞내밈·위쪽돌림, 어깨뼈를 가슴벽에 붙임',
    innervationNote: '긴가슴신경(C5~C7)', clinical: '긴가슴신경이 다치면 어깨뼈 안쪽모서리가 들뜬다(날개어깨뼈).',
  })),
  one('external_intercostal', ['thorax'], muscle({
    ko: '바깥갈비사이근', en: 'External intercostal muscles', la: 'Musculi intercostales externi', aliases: ['외늑간근', '갈비사이근'], color: C.muscleDeep,
    bp3d: 'external intercostal muscle', origin: '위 갈비뼈 아래모서리', insertion: '아래 갈비뼈 위모서리',
    action: '들숨 때 갈비뼈를 올림', innervationNote: '갈비사이신경', description: '섬유가 앞아래로 주행한다 (좌우·모든 갈비사이 함께 표시).',
  })),
  one('diaphragm', ['thorax', 'abdomen'], muscle({
    ko: '가로막', en: 'Diaphragm', la: 'Diaphragma', aliases: ['횡격막'],
    bp3d: 'diaphragm', origin: '복장부분: 칼돌기 / 갈비부분: 아래 6개 갈비연골 / 허리부분: 위 허리뼈 몸통(다리), 안쪽·가쪽활꼴인대',
    insertion: '중심널힘줄', action: '수축하면 내려가 가슴안을 넓힘 (주된 들숨근)', innervationNote: '가로막신경(C3~C5)',
    clinical: '대정맥구멍(T8), 식도구멍(T10), 대동맥구멍(T12)이 있다. 가로막 자극은 어깨로 연관통을 일으킨다.',
  })),
  one('heart', ['thorax'], organ({
    ko: '심장', en: 'Heart', la: 'Cor', bp3d: 'heart', color: '#a83232', aliases: ['heart'],
    description: '가운데세로칸에 있는 근육성 펌프. 오른심방·오른심실·왼심방·왼심실로 나뉘며, 심장끝은 왼쪽 제5갈비사이공간 빗장중간선에 있다.',
  })),
  one('right_lung', ['thorax'], organ({
    ko: '오른허파', en: 'Right lung', la: 'Pulmo dexter', bp3d: 'right lung', color: '#e7a8a3', aliases: ['우폐', '허파', '폐'],
    description: '위·중간·아래엽 3엽. 수평틈새와 빗틈새가 엽을 나눈다. BodyParts3D에는 허파 겉면 메시가 없어, 허파 안의 기관지·허파혈관 가지로 표시된다.',
  })),
  one('left_lung', ['thorax'], organ({
    ko: '왼허파', en: 'Left lung', la: 'Pulmo sinister', bp3d: 'left lung', color: '#e7a8a3', aliases: ['좌폐', '허파', '폐'],
    description: '위·아래엽 2엽. 앞모서리에 심장패임과 허파혀(소엽)가 있다. BodyParts3D에는 허파 겉면 메시가 없어, 허파 안의 기관지·허파혈관 가지로 표시된다.',
  })),
  one('trachea', ['thorax', 'neck'], organ({
    ko: '기관', en: 'Trachea', la: 'Trachea', bp3d: 'trachea', color: '#e8d9c0', aliases: ['기관'],
    description: 'C6 높이 반지연골 아래에서 시작해 복장뼈각 높이(T4~T5)에서 좌우 주기관지로 갈라진다. 뒤쪽이 열린 C자 연골고리가 받친다.',
  })),
  one('right_main_bronchus', ['thorax'], organ({
    ko: '오른주기관지', en: 'Right main bronchus', la: 'Bronchus principalis dexter', bp3d: 'right main bronchus', color: '#e8d9c0', aliases: ['우주기관지', '주기관지'],
    clinical: '왼쪽보다 짧고 넓으며 수직에 가까워 이물이 잘 들어간다.',
  })),
  one('left_main_bronchus', ['thorax'], organ({
    ko: '왼주기관지', en: 'Left main bronchus', la: 'Bronchus principalis sinister', bp3d: 'left main bronchus', color: '#e8d9c0', aliases: ['좌주기관지', '주기관지'],
    description: '대동맥활 아래를 지나 왼허파로 들어간다.',
  })),
  one('esophagus', ['thorax'], organ({
    ko: '식도', en: 'Esophagus', la: 'Oesophagus', bp3d: 'esophagus', color: '#d4877a', aliases: ['oesophagus'],
    description: '인두에서 위까지 이어지는 관. 기관 뒤를 내려가 T10 높이에서 가로막을 지난다.',
    clinical: '반지연골, 대동맥활·왼주기관지, 가로막 식도구멍에서 좁아진다.',
  })),
  one('thymus', ['thorax'], organ({
    ko: '가슴샘', en: 'Thymus', la: 'Thymus', bp3d: 'thymus', color: '#e8c6a0', aliases: ['흉선'],
    description: '위세로칸 앞쪽의 림프기관. T세포가 성숙하는 곳으로, 사춘기 이후 지방으로 바뀐다.',
  })),
  one('ascending_aorta', ['thorax'], artery({
    ko: '오름대동맥', en: 'Ascending aorta', la: 'Pars ascendens aortae', bp3d: 'ascending aorta', aliases: ['상행대동맥', '대동맥'],
    course: '왼심실에서 시작해 위로 올라가며, 시작 부위에서 오른·왼심장동맥을 낸다.',
  })),
  one('aortic_arch', ['thorax'], artery({
    ko: '대동맥활', en: 'Arch of aorta', la: 'Arcus aortae', bp3d: 'arch of aorta', aliases: ['대동맥궁', '대동맥'],
    course: '복장뼈각 높이에서 시작해 끝나는 활. 팔머리동맥, 왼온목동맥, 왼빗장밑동맥을 낸다.',
  })),
  one('pulmonary_trunk', ['thorax'], artery({
    ko: '허파동맥줄기', en: 'Pulmonary trunk', la: 'Truncus pulmonalis', bp3d: 'pulmonary trunk', color: '#3f5fd6', aliases: ['폐동맥간', '폐동맥'],
    course: '오른심실에서 정맥혈을 받아 대동맥활 아래에서 오른·왼허파동맥으로 갈라진다.',
  })),
  one('superior_vena_cava', ['thorax'], vein({
    ko: '위대정맥', en: 'Superior vena cava', la: 'Vena cava superior', bp3d: 'superior vena cava', aliases: ['상대정맥', '대정맥'],
    course: '좌우 팔머리정맥이 합쳐 만들어져 오른심방으로 들어간다. 홀정맥이 뒤에서 합류한다.',
  })),
  one('azygos_vein', ['thorax'], vein({
    ko: '홀정맥', en: 'Azygos vein', la: 'Vena azygos', bp3d: 'azygos vein', aliases: ['기정맥'],
    course: '척주 오른쪽을 올라가 오른허파뿌리 위를 넘어 위대정맥으로 들어간다. 위·아래대정맥 사이의 곁순환길이다.',
  })),
];

// ---------------- 배 ----------------
const abdomen = [
  ...lumbarVertebrae,
  ...pair('external_oblique', ['abdomen'], muscle({
    ko: '배바깥빗근', en: 'External oblique', la: 'Musculus obliquus externus abdominis', aliases: ['외복사근'],
    bp3d: (s) => `${s} external oblique`,
    origin: '제5~12갈비뼈 바깥면', insertion: '백색선, 두덩결절, 엉덩뼈능선 앞쪽 절반',
    action: '몸통 굽힘·반대쪽으로 돌림, 배안 압력 높임', innervationNote: '아래 갈비사이신경(T7~T11), 갈비밑신경(T12)',
    clinical: '널힘줄 아래모서리가 샅고랑인대가 된다.',
  })),
  ...pair('psoas_major', ['abdomen'], muscle({
    ko: '큰허리근', en: 'Psoas major', la: 'Musculus psoas major', aliases: ['대요근'], color: C.muscleDeep,
    bp3d: (s) => `${s} psoas major`,
    origin: '제12등뼈~제5허리뼈 몸통·가로돌기', insertion: '넙다리뼈 작은돌기 (엉덩근과 함께)',
    action: '엉덩관절 굽힘, 몸통 굽힘', innervationNote: '허리신경 앞가지(L1~L3)',
  })),
  one('liver', ['abdomen'], organ({
    ko: '간', en: 'Liver', la: 'Hepar', bp3d: 'liver', color: '#8b3a2b', aliases: ['hepar'],
    description: '가장 큰 샘. 오른위배부분에서 가로막 아래에 있으며, 간문맥과 간동맥으로 혈액을 받아 쓸개즙을 만든다.',
  })),
  one('gallbladder', ['abdomen'], organ({
    ko: '쓸개', en: 'Gallbladder', la: 'Vesica biliaris', bp3d: 'gallbladder', color: '#4f7a3a', aliases: ['담낭'],
    description: '간 아랫면에서 쓸개즙을 모아 농축한다.', clinical: '바닥은 오른쪽 빗장중간선과 갈비활이 만나는 곳에 있다(Murphy 징후).',
  })),
  one('stomach', ['abdomen'], organ({
    ko: '위', en: 'Stomach', la: 'Gaster', bp3d: 'stomach', color: '#d98c7a', aliases: ['gaster'],
    description: '들문·바닥·몸통·날문부분으로 나뉜다. 작은굽이와 큰굽이가 있다.',
  })),
  one('spleen', ['abdomen'], organ({
    ko: '지라', en: 'Spleen', la: 'Splen', bp3d: 'spleen', color: '#7d2e3b', aliases: ['비장', 'lien'],
    description: '왼위배부분 제9~11갈비뼈 높이의 림프기관. 오래된 적혈구를 거른다.', clinical: '왼쪽 아래 갈비뼈 골절 때 잘 터진다.',
  })),
  one('pancreas', ['abdomen'], organ({
    ko: '이자', en: 'Pancreas', la: 'Pancreas', bp3d: 'pancreas', color: '#e6c27a', aliases: ['췌장'],
    description: '복막뒤기관. 머리는 샘창자 안에, 꼬리는 지라문에 닿는다. 소화효소와 인슐린을 만든다.',
  })),
  one('duodenum', ['abdomen'], organ({
    ko: '샘창자', en: 'Duodenum', la: 'Duodenum', bp3d: 'duodenum', color: '#e3a38f', aliases: ['십이지장'],
    description: '작은창자의 첫 부분. C자로 이자머리를 감싸고, 내림부분에 온쓸개관·이자관이 열린다.',
  })),
  one('jejunum', ['abdomen'], organ({
    ko: '빈창자', en: 'Jejunum', la: 'Jejunum', bp3d: 'jejunum', color: '#e7ae99', aliases: ['공장'],
    description: '작은창자 몸쪽 2/5. 벽이 두껍고 돌림주름이 뚜렷하다.',
  })),
  one('ileum', ['abdomen'], organ({
    ko: '돌창자', en: 'Ileum', la: 'Ileum', bp3d: 'ileum', color: '#eab9a6', aliases: ['회장'],
    description: '작은창자 먼쪽 3/5. 막창자로 이어지며 비타민 B12와 쓸개즙산을 흡수한다.',
  })),
  one('cecum', ['abdomen'], organ({
    ko: '막창자', en: 'Cecum', la: 'Caecum', bp3d: 'cecum', color: '#c98a6b', aliases: ['맹장'],
    description: '큰창자의 첫 부분. 아래끝에 막창자꼬리가 붙는다.',
  })),
  one('ascending_colon', ['abdomen'], organ({ ko: '오름잘록창자', en: 'Ascending colon', la: 'Colon ascendens', bp3d: 'ascending colon', color: '#c98a6b', aliases: ['상행결장'], description: '오른쪽 옆구리를 올라가 간 아래에서 오른잘록창자굽이를 이룬다.' })),
  one('transverse_colon', ['abdomen'], organ({ ko: '가로잘록창자', en: 'Transverse colon', la: 'Colon transversum', bp3d: 'transverse colon', color: '#c98a6b', aliases: ['횡행결장'], description: '창자간막을 가져 움직임이 크다. 큰그물막이 붙는다.' })),
  one('descending_colon', ['abdomen'], organ({ ko: '내림잘록창자', en: 'Descending colon', la: 'Colon descendens', bp3d: 'descending colon', color: '#c98a6b', aliases: ['하행결장'], description: '왼쪽 옆구리를 내려가 구불잘록창자로 이어진다.' })),
  one('right_kidney', ['abdomen', 'back'], organ({
    ko: '오른콩팥', en: 'Right kidney', la: 'Ren dexter', bp3d: 'right kidney', color: '#8e3b35', aliases: ['우신장', '콩팥', '신장'],
    description: '복막뒤기관. 간 때문에 왼쪽보다 약간 낮다.',
  })),
  one('left_kidney', ['abdomen', 'back'], organ({
    ko: '왼콩팥', en: 'Left kidney', la: 'Ren sinister', bp3d: 'left kidney', color: '#8e3b35', aliases: ['좌신장', '콩팥', '신장'],
    description: '복막뒤기관. 제12갈비뼈가 뒷면 위쪽을 가로지른다.',
  })),
  one('abdominal_aorta', ['abdomen'], artery({
    ko: '배대동맥', en: 'Abdominal aorta', la: 'Pars abdominalis aortae', bp3d: 'abdominal aorta', aliases: ['복대동맥', '대동맥'],
    course: 'T12 높이 가로막 대동맥구멍에서 시작해 L4 높이에서 좌우 온엉덩동맥으로 갈라진다.',
    clinical: '배대동맥류는 주로 콩팥동맥 아래에 생긴다.',
  })),
  one('inferior_vena_cava', ['abdomen', 'thorax'], vein({
    ko: '아래대정맥', en: 'Inferior vena cava', la: 'Vena cava inferior', bp3d: 'inferior vena cava', aliases: ['하대정맥', '대정맥'],
    course: 'L5 높이에서 좌우 온엉덩정맥이 합쳐 시작한다. 대동맥 오른쪽을 올라가 T8 높이에서 가로막을 지나 오른심방으로 들어간다.',
  })),
  one('celiac_trunk', ['abdomen'], artery({
    ko: '복강동맥', en: 'Celiac trunk', la: 'Truncus coeliacus', bp3d: 'celiac trunk', aliases: ['복강동맥간'],
    course: 'T12 높이에서 배대동맥 앞면에서 나와 왼위동맥, 온간동맥, 지라동맥으로 갈라진다. 앞창자(위·샘창자 앞부분·간·이자·지라)를 먹인다.',
  })),
  one('superior_mesenteric_artery', ['abdomen'], artery({
    ko: '위창자간막동맥', en: 'Superior mesenteric artery', la: 'Arteria mesenterica superior', bp3d: 'superior mesenteric artery', aliases: ['상장간막동맥'],
    course: 'L1 높이에서 배대동맥 앞면에서 나온다. 중간창자(샘창자 뒷부분~가로잘록창자 2/3)를 먹인다.',
    clinical: '왼콩팥정맥이 이 동맥과 대동맥 사이에 끼면 호두까기 증후군이 생긴다.',
  })),
  ...pair('renal_artery', ['abdomen'], artery({
    ko: '콩팥동맥', en: 'Renal artery', la: 'Arteria renalis', aliases: ['신동맥'],
    bp3d: (s) => `${s} renal artery`,
    course: 'L1~L2 높이에서 배대동맥 옆면에서 나온다. 오른쪽이 더 길어 아래대정맥 뒤를 지난다.',
  })),
];

// ---------------- 손 (오른쪽) ----------------
const FINGERS = [
  ['thumb', '엄지', 'pollicis'],
  ['index finger', '검지', 'digiti II'],
  ['middle finger', '가운뎃손가락', 'digiti III'],
  ['ring finger', '반지손가락', 'digiti IV'],
  ['little finger', '새끼손가락', 'digiti V'],
];
const PHALANX = [
  ['proximal', '첫마디뼈', 'Phalanx proximalis', '근위지골'],
  ['middle', '중간마디뼈', 'Phalanx media', '중위지골'],
  ['distal', '끝마디뼈', 'Phalanx distalis', '원위지골'],
];
const carpals = [
  ['scaphoid', '손배뼈', 'Os scaphoideum', '주상골', '해부학코담배갑 바닥에서 만져진다. 넘어질 때 가장 흔히 부러지는 손목뼈로, 몸쪽 조각에 무혈성 괴사가 오기 쉽다.'],
  ['lunate', '반달뼈', 'Os lunatum', '월상골', '손목뼈 가운데 가장 잘 탈구된다. 앞으로 빠지면 손목굴의 정중신경을 누른다.'],
  ['triquetral', '세모뼈', 'Os triquetrum', '삼각골', '콩알뼈와 관절을 이룬다.'],
  ['pisiform', '콩알뼈', 'Os pisiforme', '두상골', '자쪽손목굽힘근 힘줄 속의 종자뼈. 자신경굴(Guyon관)의 안쪽 벽이다.'],
  ['trapezium', '큰마름뼈', 'Os trapezium', '대능형골', '첫째 손허리뼈와 안장관절을 이뤄 엄지 맞섬을 가능하게 한다.'],
  ['trapezoid', '작은마름뼈', 'Os trapezoideum', '소능형골', '둘째 손허리뼈와 관절을 이룬다.'],
  ['capitate', '알머리뼈', 'Os capitatum', '유두골', '가장 큰 손목뼈. 셋째 손허리뼈와 관절을 이룬다.'],
  ['hamate', '갈고리뼈', 'Os hamatum', '유구골', '갈고리가 자신경굴의 가쪽 벽이 된다.'],
];
const hand = [
  ...carpals.map(([en, ko, la, old, description]) =>
    one(`${en === 'triquetral' ? 'triquetrum' : en}`, ['hand'], bone({ ko, en: en === 'triquetral' ? 'Triquetrum' : en.charAt(0).toUpperCase() + en.slice(1), la, bp3d: `right ${en}`, aliases: [old], description })),
  ),
  ...[1, 2, 3, 4, 5].map((n) =>
    one(`metacarpal_${n}`, ['hand'], bone({
      ko: `${['첫째', '둘째', '셋째', '넷째', '다섯째'][n - 1]} 손허리뼈`, en: `${ORD[n - 1].charAt(0).toUpperCase()}${ORD[n - 1].slice(1)} metacarpal`,
      la: `Os metacarpi ${ROMAN[n - 1]}`, bp3d: `right ${ORD[n - 1]} metacarpal bone`, aliases: [`제${n}중수골`],
      ...(n === 5 ? { clinical: '목 골절(복서 골절)이 흔하다.' } : {}),
    })),
  ),
  ...FINGERS.flatMap(([fEn, fKo, fLa], fi) =>
    PHALANX.filter(([pos]) => !(fi === 0 && pos === 'middle')).map(([pos, pKo, pLa, pOld]) =>
      one(`phalanx_${pos}_${fi + 1}`, ['hand'], bone({
        ko: `${fKo} ${pKo}`, en: `${pos.charAt(0).toUpperCase()}${pos.slice(1)} phalanx of ${fEn}`, la: `${pLa} ${fLa}`,
        bp3d: `${pos} phalanx of right ${fEn}`, aliases: [`${fKo} ${pOld}`],
      })),
    ),
  ),
  one('abductor_pollicis_brevis', ['hand'], muscle({
    ko: '짧은엄지벌림근', en: 'Abductor pollicis brevis', la: 'Musculus abductor pollicis brevis', aliases: ['단무지외전근'], bp3d: 'right abductor pollicis brevis',
    origin: '굽힘근지지띠, 손배뼈·큰마름뼈 결절', insertion: '엄지 첫마디뼈 바닥 가쪽', action: '엄지 벌림',
    innervationNote: '정중신경 되돌이가지', clinical: '손목굴증후군에서 먼저 위축되는 엄지두덩근이다.',
  })),
  one('opponens_pollicis', ['hand'], muscle({
    ko: '엄지맞섬근', en: 'Opponens pollicis', la: 'Musculus opponens pollicis', aliases: ['무지대립근'], color: C.muscleDeep, bp3d: 'right opponens pollicis',
    origin: '굽힘근지지띠, 큰마름뼈 결절', insertion: '첫째 손허리뼈 가쪽모서리', action: '엄지 맞섬', innervationNote: '정중신경 되돌이가지',
  })),
  one('adductor_pollicis', ['hand'], muscle({
    ko: '엄지모음근', en: 'Adductor pollicis', la: 'Musculus adductor pollicis', aliases: ['무지내전근'], color: C.muscleDeep,
    bp3d: ['oblique head of right adductor pollicis', 'transverse head of right adductor pollicis'],
    origin: '빗갈래: 알머리뼈, 둘째·셋째 손허리뼈 바닥 / 가로갈래: 셋째 손허리뼈 앞면', insertion: '엄지 첫마디뼈 바닥 안쪽', action: '엄지 모음',
    innervationNote: '자신경 깊은가지', clinical: '자신경 손상 때 종이를 엄지로 누르지 못하고 엄지를 굽혀 버티게 된다(Froment 징후).',
  })),
  one('abductor_digiti_minimi_hand', ['hand'], muscle({
    ko: '새끼벌림근', en: 'Abductor digiti minimi', la: 'Musculus abductor digiti minimi manus', aliases: ['소지외전근'], bp3d: 'abductor digiti minimi of right hand',
    origin: '콩알뼈, 자쪽손목굽힘근 힘줄', insertion: '새끼손가락 첫마디뼈 바닥 안쪽', action: '새끼손가락 벌림', innervationNote: '자신경 깊은가지',
  })),
  one('flexor_digiti_minimi_brevis_hand', ['hand'], muscle({
    ko: '짧은새끼굽힘근', en: 'Flexor digiti minimi brevis', la: 'Musculus flexor digiti minimi brevis manus', aliases: ['단소지굴근'], bp3d: 'flexor digiti minimi brevis of right hand',
    origin: '갈고리뼈갈고리, 굽힘근지지띠', insertion: '새끼손가락 첫마디뼈 바닥', action: '새끼손가락 손허리손가락관절 굽힘', innervationNote: '자신경 깊은가지',
  })),
  one('opponens_digiti_minimi', ['hand'], muscle({
    ko: '새끼맞섬근', en: 'Opponens digiti minimi', la: 'Musculus opponens digiti minimi', aliases: ['소지대립근'], color: C.muscleDeep, bp3d: 'opponens digiti minimi of right hand',
    origin: '갈고리뼈갈고리, 굽힘근지지띠', insertion: '다섯째 손허리뼈 안쪽모서리', action: '새끼손가락 맞섬', innervationNote: '자신경 깊은가지',
  })),
  one('lumbricals_hand', ['hand'], muscle({
    ko: '벌레근', en: 'Lumbricals', la: 'Musculi lumbricales manus', aliases: ['충양근'], color: C.muscleDeep, bp3d: 'set of lumbricals of right hand',
    origin: '깊은손가락굽힘근 힘줄', insertion: '둘째~다섯째 손가락 폄근널힘줄 가쪽', action: '손허리손가락관절 굽힘 + 손가락뼈사이관절 폄',
    innervationNote: '1·2번: 정중신경 / 3·4번: 자신경 깊은가지', description: '네 개를 함께 표시한다.',
  })),
  one('palmar_interossei', ['hand'], muscle({
    ko: '바닥쪽뼈사이근', en: 'Palmar interossei', la: 'Musculi interossei palmares', aliases: ['장측골간근'], color: C.muscleDeep, bp3d: 'set of palmar interossei of right hand',
    origin: '둘째·넷째·다섯째 손허리뼈', insertion: '같은 손가락 첫마디뼈와 폄근널힘줄', action: '손가락 모음 (PAD)', innervationNote: '자신경 깊은가지',
  })),
  one('dorsal_interossei', ['hand'], muscle({
    ko: '등쪽뼈사이근', en: 'Dorsal interossei', la: 'Musculi interossei dorsales manus', aliases: ['배측골간근'], color: C.muscleDeep, bp3d: 'set of dorsal interossei of right hand',
    origin: '이웃한 두 손허리뼈 마주 보는 면', insertion: '둘째~넷째 손가락 첫마디뼈와 폄근널힘줄', action: '손가락 벌림 (DAB)', innervationNote: '자신경 깊은가지',
  })),
  one('deep_palmar_arch', ['hand'], artery({
    ko: '깊은손바닥동맥활', en: 'Deep palmar arch', la: 'Arcus palmaris profundus', aliases: ['심장동맥궁'], bp3d: 'right deep palmar arch',
    course: '주로 노동맥 끝가지로 이루어져 손허리뼈 바닥 높이를 가로지른다. 얕은활보다 몸쪽에 있다.',
  })),
];

/** 중복 id(등뼈처럼 여러 부위 목록에 나온 것)는 regions를 합친다 */
function merge(lists) {
  const byId = new Map();
  for (const e of lists.flat()) {
    const prev = byId.get(e.id);
    if (prev) prev.regions = [...new Set([...prev.regions, ...e.regions])];
    else byId.set(e.id, { ...e, regions: [...e.regions] });
  }
  return [...byId.values()];
}

export const CATALOG = merge([neck, shoulder, back, thorax, abdomen, hand]);

/** 부위 id → 그 부위에 들어갈 catalog 항목들 */
export const catalogFor = (region) => CATALOG.filter((e) => e.regions.includes(region));
