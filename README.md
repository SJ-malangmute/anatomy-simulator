# 해부 실습 시뮬레이터 (프로토타입)

의과대학 해부학 실습을 위한 웹 시뮬레이터 프로토타입입니다. 오른쪽 **위팔**과 **아래팔** 두 부위를 다룹니다.

> 뼈·근육·동맥·표재정맥은 **BodyParts3D 실제 메시**입니다.
> 피부·피하조직·근막 껍질과 신경 경로는 BodyParts3D에 해당 메시가 없어 실제 구조물 위치에 맞춰 **생성한 근사치**입니다.
> 해부 시나리오와 구조물 설명은 검수되지 않은 초안입니다.

**바로 써 보기:** https://sj-malangmute.github.io/anatomy-simulator/

## 실행

```bash
npm install
npm run dev
```

http://localhost:5173 에서 열립니다. 변환된 모델(`public/models/*.glb`, `src/data/generated/*-meta.json`)이 저장소에 포함되어 있어 바로 실행됩니다.

## 배포

`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해 GitHub Pages에 올립니다.
빌드는 상대 경로(`base: './'`)라 Pages 하위 경로와 로컬에서 모두 동작합니다.

## 기능

| 모드 | 내용 |
| --- | --- |
| 탐색 | 부위(위팔·아래팔)를 고르고, 7개 층(피부·피하조직·표재정맥·근막·근육·신경혈관·뼈)을 보임/반투명/숨김으로 조절. 구조물을 클릭하면 기시·정지·작용·지배신경·임상 정보 |
| 해부 실습 | 가이드형 시나리오 3개. **위팔 앞칸**(7단계), **위팔 뒤칸**(8단계), **아래팔 앞칸**(9단계: 정중선 절개 → 피부판 → 표재정맥 → 얕은 굽힘근·위팔노근 → 가장자리 젖히기 → 노동맥·자동맥과 신경 → 얕은·중간층 들어올리기 → 정중신경과 깊은층) |
| 땡시 | 지금 부위에서 5가지 유형을 골라 출제: 핀 구조물 이름(한글·구용어·영어·라틴어 인정), 지배신경, 기시, 작용, 신경 손상 증상. 한 번 낸 문제는 다 쓸 때까지 반복하지 않음 |

| 부위 | 실제 메시 | 생성한 근사치 |
| --- | --- | --- |
| 위팔 | 위팔뼈, 근육 7개(위팔두갈래근 2갈래, 위팔세갈래근 3갈래 포함), 위팔동맥, 깊은위팔동맥, 노쪽·자쪽피부정맥 | 정중·자·근육피부·노신경, 피부층 |
| 아래팔 | 노뼈, 자뼈, 근육 20개, 노동맥, 자동맥, 앞뼈사이동맥, 노쪽·자쪽피부정맥 | 정중·자신경, 노신경 얕은가지, 뒤뼈사이신경, 피부층 |

## 3D 모델 다시 만들기

원본은 [BodyParts3D 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)
(© The Database Center for Life Science, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) 입니다.

1. 배포처에서 `isa_BP3D_4.0_obj_99.zip`, `partof_BP3D_4.0_obj_99.zip`을 받아 `.data/bodyparts3d/extracted/`에 풉니다 (`.data`는 git 제외).
2. 변환합니다 (부위 id를 빼면 전체):

```bash
node scripts/bp3d/build-region.mjs .data/bodyparts3d/extracted arm forearm
```

부위마다 `scripts/bp3d/regions.mjs`에 설정이 있습니다: 사용할 FMA ID·OBJ 파일, 잘라낼 높이 범위, 축을 맞출 뼈, 신경 경로를 만드는 규칙.
변환 과정은 구조물을 골라 높이 범위로 자르고, 기울어진 뼈 축(위팔 약 10°, 아래팔 약 17°)을 전단 변환으로 세운 뒤 cm 단위 glb로 저장합니다.
같은 단계에서 근육·정맥을 감싸는 피부·근막 껍질과 신경 경로를 만들어 `<부위>-meta.json`에 넣습니다. 신경은 근막 안쪽에 머물도록 당기고 매끄럽게 폅니다.

새 부위를 추가하려면 `regions.mjs`에 설정을 더하고, `src/data/regions.ts`·구조물 데이터·시나리오를 추가합니다.

## 구조

```
scripts/bp3d/
  regions.mjs                      부위별 변환 설정
  build-region.mjs                 BodyParts3D → glb + 메타데이터 변환
public/models/<부위>.glb           변환된 실제 메시
src/
  types.ts                         구조물·시나리오 타입
  data/regions.ts                  부위 목록 (모델 파일, 지배신경 보기)
  data/structures.ts               구조물 지식 데이터 (위팔·공통), structures-forearm.ts (아래팔)
  data/layers.ts                   층 정의
  data/scenarios/*.json            해부 시나리오 (코드 수정 없이 편집·추가 가능, store.ts의 SCENARIOS에 등록)
  data/generated/<부위>-meta.json  변환 출력: 껍질 반지름, 정맥 중심선, 신경 경로, 핀 위치
  model/anatomyGeometry.ts         부위별 glb·메타데이터를 앱 형상으로 바꾸는 곳
  model/ArmScene.tsx               3D 장면, 피부판, 절개선, 라벨, 땡시 핀
  lib/incision.ts                  절개 판정 (정중선 이탈, 구간 커버율, 정맥 손상)
  store.ts                         상태와 모드별 로직 (zustand)
  ui/                              사이드바 패널, 정보 카드, 출처 화면
```

## 라이선스

- 코드: [MIT](LICENSE)
- 3D 모델 데이터(`public/models/*.glb`, `src/data/generated/*-meta.json`): BodyParts3D를 가공한 것으로 MIT가 아니라
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)을 따릅니다. 출처: BodyParts3D, © The Database Center for Life Science.
  자세한 출처와 수정 내역은 [NOTICE](NOTICE)에 있습니다.

## 다음 단계

1. 신경과 피부층의 실제 메시를 구할 다른 출처를 찾는다 (BodyParts3D에는 팔 신경 메시가 없음).
2. 아래팔 뒤칸 시나리오, 다른 부위(손, 하지 등)로 넓힌다.
3. 학생별 기록 저장과 교수자 대시보드 (서버 필요).
