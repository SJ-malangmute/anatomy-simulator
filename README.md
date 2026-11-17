# 해부 실습 시뮬레이터 (프로토타입)

의과대학 해부학 실습을 위한 웹 시뮬레이터의 1단계 프로토타입입니다. 오른쪽 위팔 앞칸 한 부위를 다룹니다.

> 뼈·근육·동맥·표재정맥은 **BodyParts3D 실제 메시**입니다.
> 피부·피하조직·근막 껍질과 신경 4개는 BodyParts3D에 위팔용 메시가 없어 실제 구조물 위치에 맞춰 **생성한 근사치**입니다.

**바로 써 보기:** https://sj-malangmute.github.io/anatomy-simulator/

## 실행

```bash
npm install
npm run dev
```

http://localhost:5173 에서 열립니다. 변환된 모델(`public/models/arm.glb`, `src/data/generated/arm-meta.json`)이 저장소에 포함되어 있어 바로 실행됩니다.

## 배포

`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해 GitHub Pages에 올립니다.
빌드는 상대 경로(`base: './'`)라 Pages 하위 경로와 로컬에서 모두 동작합니다.

## 3D 모델 다시 만들기

원본은 [BodyParts3D 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)
(© The Database Center for Life Science, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) 입니다.

1. 배포처에서 `isa_BP3D_4.0_obj_99.zip`, `partof_BP3D_4.0_obj_99.zip`을 받아 `.data/bodyparts3d/extracted/`에 풉니다 (`.data`는 git 제외).
2. 변환합니다:

```bash
node scripts/bp3d/build-arm.mjs .data/bodyparts3d/extracted
```

변환 과정: 오른쪽 위팔 구조물만 골라 팔꿈치 위~겨드랑이 아래(원본 z 1030–1280mm)로 자르고, 약 10° 기울어진 팔을 위팔뼈 축에 맞춰 세운 뒤 cm 단위 glb로 저장합니다.
같은 단계에서 근육·정맥을 감싸는 피부·근막 껍질과, 실제 동맥·근육·뼈에 맞춘 신경 경로를 만들어 `arm-meta.json`에 넣습니다.
사용한 FMA ID와 OBJ 파일 ID는 `build-arm.mjs`의 `SOURCES`에 있습니다.

## 기능

| 모드 | 내용 |
| --- | --- |
| 탐색 | 7개 층(피부·피하조직·표재정맥·근막·근육·신경혈관·뼈)을 보임/반투명/숨김으로 조절, 구조물 클릭 시 기시·정지·작용·지배신경·임상 정보 |
| 해부 실습 | 7단계 가이드형 시나리오: 메스로 피부 절개(정중선 판정, 표재정맥 손상 감점) → 피부판 젖히기 → 표재정맥 찾기 → 피하조직·근막 제거 → 앞칸 근육 찾기 → 위팔두갈래근 젖히기 → 신경·혈관 찾기 |
| 땡시 | 핀이 꽂힌 구조물 이름 맞히기(한글·구용어·영어·라틴어 인정), 근육의 지배신경 고르기, 문항당 제한 시간 |

## 구조

```
src/
  types.ts                         구조물·시나리오 타입
  data/structures.ts               구조물 지식 데이터 (fmaId 칸은 에셋 도입 시 채움)
  data/layers.ts                   층 정의
  data/scenarios/anterior-arm.json 해부 시나리오 (코드 수정 없이 편집 가능)
  data/generated/arm-meta.json     변환 스크립트 출력: 껍질 반지름, 정맥 중심선, 신경 경로, 핀 위치
  model/anatomyGeometry.ts         glb·메타데이터를 앱 형상으로 바꾸는 곳
scripts/bp3d/                      BodyParts3D → glb 변환 스크립트
public/models/arm.glb              변환된 실제 메시
  model/ArmScene.tsx               3D 장면, 피부판, 절개선, 라벨, 땡시 핀
  lib/incision.ts                  절개 판정 (정중선 이탈, 구간 커버율, 정맥 손상)
  store.ts                         상태와 모드별 로직 (zustand)
  ui/                              사이드바 패널, 정보 카드, 출처 화면
```

## 다음 단계

1. 신경과 피부층의 실제 메시를 구할 다른 출처를 찾는다 (BodyParts3D에는 위팔 신경 메시가 없음).
2. 해부학 교수 검수로 시나리오, 구조물 설명, 생성한 신경 경로를 확정한다.
