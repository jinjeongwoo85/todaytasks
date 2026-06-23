# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **상태(2026-06-23): 앱·위젯 개발 일단락.** 웹(PWA)·안드로이드 앱·홈 위젯 모두 운영 중. 이후 작업은
> **버그 수정·기능 확장** 위주다. 변경 시 아래 "작업 시 주의"와 "알려진 한계/향후 작업"을 먼저 보라.

## 개요

TodayTasks = Google Tasks와 연동되는 개인용 "오늘 할 일" 관리 앱.
한 코드베이스(React/Vite)로 **3개 타깃**에 배포된다:
- **웹 PWA** — GitHub Pages (`main` push 시 자동 배포)
- **안드로이드 앱** — Capacitor로 같은 웹 자산을 번들(완전 오프라인, `server.url` 미사용)
- **홈 위젯** — 네이티브(Java) 위젯이 별도 "오늘 스냅샷"을 읽어 렌더

백엔드 없음. 인증·데이터는 브라우저/기기에서 Google API에 직접.

## Build / Test Commands

```bash
npm run dev          # 웹 개발 서버 (http://localhost:5173)
npm run build        # 웹(GitHub Pages) 빌드 → dist/
npm run preview      # 빌드 결과 미리보기
npm test             # vitest (순수 로직 테스트 48개) — 회귀 가드

npm run build:native # 네이티브용 빌드 (cross-env BUILD_TARGET=native → base './' + SW 비활성)
npx cap sync android # dist/ → android 프로젝트로 동기화
```

**안드로이드 설치(Windows):** `npx cap run`은 Windows에서 실패 → gradlew 직접 사용.
환경변수 필요: `JAVA_HOME`=Android Studio jbr, `ANDROID_HOME`=local SDK(`%LOCALAPPDATA%\Android\Sdk`).
```bash
# 디버그 설치
android\gradlew.bat -p android installDebug
# 서명 release APK (keystore.properties 존재 시) → adb로 그 자리 업데이트(디버그키 재사용이라 서명 일치)
android\gradlew.bat -p android assembleRelease
adb -s R3CW30EZ8PV install -r android\app\build\outputs\apk\release\app-release.apk
```
실기기 = 갤럭시 S23, serial `R3CW30EZ8PV`. **터치/위젯은 자동 테스트가 없어 실기기 수동 검증 필수.**

## Environment Variables

`.env`에 설정 (`.env.example` 참고): `VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com`.
`VITE_` 접두사 없으면 브라우저에서 접근 불가. 시크릿은 `.env`에만(코드/문서 금지). `.env`·`credentials.json`·`token.json`은 `.gitignore` 유지.

## 배포

- **웹**: `main` push → `.github/workflows/deploy.yml`이 자동 빌드·배포. `vite.config.js`의 `REPO_BASE`가 저장소 이름과 일치해야 함. URL: https://jinjeongwoo85.github.io/todaytasks/
  - ⚠️ CI는 `npm ci`가 아니라 **`npm install`** 경로(로컬 npm11 vs CI npm10 lockfile 불일치로 `npm ci`가 esbuild missing으로 깨진 적 있음). 의존성 추가 시 `package-lock.json` 커밋하고 Actions green 확인. `gh` CLI는 미인증 → 배포 상태는 웹 Actions 탭에서 확인.
- **앱/위젯**: 위 gradlew로 빌드해 폰 사이드로드(수동). main push가 앱을 배포하진 않음.

## Project Structure

```
src/
  main.jsx                # 진입점 + @fontsource 로컬 폰트 import
  App.jsx                 # 메인 컨테이너(~390줄) — 모든 UI 상태 보유 + 화면 조립
  hooks/
    useGoogleAuth.js      # 토큰 관리. 웹=GIS Token model / 네이티브=GoogleAuthNative. 55분 캐싱+자동갱신
    useTasks.js           # Tasks CRUD + 로컬 state + IndexedDB 오프라인 + 동기화 단일출처(applyOp)
    useToday.js           # 자정/포커스 시 "오늘" 재계산
    useBackButton.js      # 뒤로가기 레이어 스택(모달→시트→선택모드 순 닫기)
    useWidgetBridge.js    # 위젯 스냅샷 갱신 디바운스 + 딥링크 소비(네이티브 전용 동작)
    useSelection.js       # 다중선택(롱프레스) 상태
    useNewTaskDraft.js    # 새 할일 모달 draft 상태
    usePressDragCore.js   # 제스처 공통 코어(리스너 생명주기·롱프레스/탭 감지·id해석) — 아래 3훅이 사용
    useTaskListGestures.js# 메인 리스트: 가로 스와이프(날짜±1)+롱프레스 다중선택+세로 정렬+autoscroll
    useReorderDragVertical.js   # 모달 하위할일 세로 정렬
    useReorderDragHorizontal.js # 목록화면 하위할일 가로 칩 정렬(floating-clone)
  components/             # Header, TaskList, TaskRow, SubtaskList(모달 세로), SubtaskChips(목록 가로 칩),
                          #   SubtaskAddRow, CheckboxButton, Checkbox, ProgressBar, BottomSheet,
                          #   CalendarSheet, MonthCalendar, SettingsSheet, SearchSheet, TaskDetailModal,
                          #   ClockTimePicker, DateChip, LabeledDateField, LoginScreen
  utils/
    date.js               # ISO 변환·날짜 톤·범위 판정(isTaskOnDate)·행 라벨(rowDateLabel)
    taskModel.js          # Google Task ↔ 로컬 모델 변환, API body 빌더(단일 출처)
    taskNotes.js          # notes 끝줄 ⟦tt …⟧ 마커 인/디코드(시작일·시각)
    dragGeometry.js       # 드래그 순수 기하/재배치(테스트 대상)
    id.js                 # newId(로컬)·newTempId('opt-')·isTempId
  styles/tokens.js        # 색상(C)·톤(TONE)·z-index(Z)·제스처 상수
  api/googleTasks.js      # Google Tasks REST 호출(⚠️ parent/previous는 쿼리 파라미터로)
  db/localDB.js           # Dexie/IndexedDB 오프라인 캐시 + pendingOps 큐
  native/                 # googleAuthNative.js, todaySnapshot.js (Capacitor 플러그인 래퍼)
  *.test.js               # vitest: date / taskModel / taskNotes / googleTasks / dragGeometry

android/app/src/main/
  java/com/jinjeongwoo/todaytasks/
    MainActivity.java         # 플러그인 등록
    GoogleAuthPlugin.java     # 네이티브 Google 로그인(GoogleSignIn+GoogleAuthUtil)
    TodaySnapshotPlugin.java  # JS→네이티브 스냅샷 빌드 트리거
    SnapshotEngine.java       # ★ "오늘 스냅샷" 생성/저장 단일 출처(Tasks REST + 오늘필터/마커 파싱 + write-back)
    SnapshotScheduler/Worker  # WorkManager 15분 안전망 + 잠금해제/부팅 트리거
    BootReceiver.java         # 부팅 후 위젯/스케줄 복구
    TodayWidgetProvider.java  # 위젯 액션 라우팅(탭/체크/펼침/테마)
    TodayWidgetFactory.java   # 위젯 행 렌더(상위행/하위행, viewTypeCount=2)
    TodayWidgetService.java   # RemoteViewsService
    WidgetUpdater.java        # 위젯 갱신 헬퍼
    WidgetTheme.java          # 라이트/다크 색
  res/layout/                 # widget_today / widget_row / widget_subrow / activity_main

index.html                # GIS 스크립트 포함(웹 전용; 네이티브는 미사용)
vite.config.js            # Vite + PWA(네이티브 빌드 시 base './' + SW off). workbox precache에 woff2 포함
```

## 현재 상태 / 진행 이력

전 과정 완료·배포됨. 주요 마일스톤:
- **Phase 1~7**: PWA 인프라 → Google OAuth → Tasks CRUD → 오프라인(Dexie) → UI → GitHub Pages 배포.
- **안드로이드 앱+위젯 Phase 0~6 완료·`main` 머지·배포**(앱화 / 네이티브 로그인 / 오늘 스냅샷 / 갱신 트리거 / Glance·RemoteViews 위젯 / 서명·사이드로드).
- **재구조화 R0~R3 완료**: R0(vitest 도입) → R1(useTasks CRUD 단일화 applyOp) → R2(App.jsx 횡단 훅 추출) → R3(제스처 공통 코어 usePressDragCore + dragGeometry).
- **마무리 개선**: 하위할일 temp-id race 수정 / 날짜칩 종일 토글 / 시작 속도(캐시 우선 표시·폰트 로컬 번들·재인증 중 캐시 화면) / CheckboxButton 통합.

## Key Architecture Decisions

- **인증**: 웹=GIS Token model(백엔드 불필요). **네이티브=`GoogleAuthPlugin`(GoogleSignIn+GoogleAuthUtil)** — WebView는 file:// 출처라 GIS 미작동 + 1시간 만료라, 기기 계정으로 영구 로그인. `useGoogleAuth`가 `Capacitor.isNativePlatform()`로 분기. 토큰 localStorage 55분 캐싱 + 만료 전 자동 갱신.
- **데이터/동기화**: `useTasks`가 로컬 state + API(optimistic) + IndexedDB(오프라인)를 함께 관리. **단순 쓰기는 `applyOp` 하나가 온라인 직접 경로·오프라인 재생 경로 공용 단일 출처**(`dispatch`/`sendOp`). 생성(addTask/addSubtask)만 temp→실제 id 재조정이 경로별로 달라 각 경로가 전담.
- **오프라인 큐**: 오프라인 쓰기는 `db.pendingOps`에 큐잉, 온라인 복귀/앱 resume/콜드스타트에 `flushPendingOps`로 순서대로 재생(실패 시 중단·재시도).
- **시작 속도(stale-while-revalidate)**: 마운트 즉시 IndexedDB 캐시를 그려 첫 화면을 띄우고(토큰 불필요), 네트워크 응답이 오면 교체. 게이트는 "보여줄 게 없을 때만 빈 화면 / 인증 끝+미로그인일 때만 로그인". `hadTokenRef`로 **로그아웃에만** 캐시를 비움(재인증 중엔 캐시 유지).
- **순서(ordering)**: Google `position`(사전식 문자열)이 단일 출처. 읽기=position 정렬, 쓰기(드래그)=move API. 새 항목은 마지막 실제 형제(`previous`) 뒤에 삽입(`lastRealId`).
- **시작일·시각 저장(중요)**: Google 공개 API의 날짜 칸은 `due`(날짜 단위, 시각 버림) **하나뿐**(실측 검증). 그래서 **종료일만 `due`에**, **시작일(`date`)·시각(`time`)은 `notes` 끝줄 `⟦tt start=… time=…⟧` 마커**로 저장(`utils/taskNotes.js`). ⚠️ notes엔 메모+시작일+시각 3값이 한 칸에 뭉쳐 있어, 하나만 바꿔도 **병합된 최신 상태로 재인코딩**해야 나머지가 안 지워짐(`useTasks.updateTask`). 디코드는 관대(마커 깨져도 메모 보존). 트레이드오프: Google 공식 앱엔 마커가 글자로 보임.
- **하위 작업**: Google `parent` 필드로 별도 태스크 저장. **`parent`/`previous`는 반드시 쿼리 파라미터**(body에 넣으면 무시돼 최상위로 생성됨 — `googleTasks.createTask` 주석). 하위작업엔 시작일·시각 마커 미사용.
- **폰트**: `@fontsource/inter`·`@fontsource/ibm-plex-mono`의 **latin subset(400/500/600)만** 로컬 번들(`main.jsx`). 한글은 시스템 폰트 폴백. Google Fonts 네트워크 의존 제거.
- **Google Cloud**: "My First Project". OAuth 동의 화면에 "주간뉴스-260616" 표시(비기능 이슈). 네이티브는 별도 Android OAuth 클라이언트+SHA-1+테스트사용자 등록 필요.

## App Component Architecture

`App.jsx`가 컨테이너로 **모든 UI 상태**를 보유하고, 화면은 `components/` 조각으로 조립(외부 상태관리 없음).

```
App (모든 state)
├── Header              — 날짜/뷰 토글, 다중선택 툴바(복사/이동/삭제), 설정·검색 진입
├── TaskList → TaskRow  — 한 줄(체크/제목수정/날짜칩/하위 펼침)
│   └── SubtaskChips    — 목록화면 하위할일(가로 칩, 롱프레스 가로 드래그 정렬)
├── CalendarSheet → MonthCalendar  — 바텀시트 달력(+시각바·종일 토글: 날짜칩 편집 시)
├── SettingsSheet / SearchSheet
├── TaskDetailModal     — 상세 편집(슬라이드업)
│   ├── EndDateTimeField(종료일+시각) / 내부 CalendarSheet·ClockTimePicker
│   └── SubtaskList     — 모달 하위할일(세로 리스트, 롱프레스 세로 드래그 정렬)
└── LoginScreen
(BottomSheet = 시트 공통 래퍼 / CheckboxButton = 완료 체크 공용 버튼)
```

**Task 데이터 형태:**
```js
{ id, text, done, dueDate, date, time, notes, expanded,
  subtasks: [{ id, text, done /* +모델엔 dueDate,notes 보존 */ }],
  _listId, _parentId, _position }   // _접두사 = 동기화용 내부 필드
```
- `dueDate`=종료일(Google `due` 네이티브). `date`=시작일·`time`='HH:mm'(둘 다 notes 마커).
- `date`<`dueDate`면 그 사이 모든 날 표시(`isTaskOnDate`). 행 라벨은 `rowDateLabel`(date.js).
- 모델 변환=`taskModel.js`, 마커=`taskNotes.js`. 동기화 경로(useTasks)는 이 유틸을 호출(매핑 단일화됨).

**제스처(`usePressDragCore` 위 3훅):** 리스너 생명주기·롱프레스(450ms)/탭 감지·`closest(idAttr)` id해석·vibrate는 코어가 담당, 드래그 본체는 각 훅. 측정은 **변형 안 되는 바깥 래퍼**(`data-task-id`/`data-subtask-id`)의 실측으로(`dragGeometry`) — 시각 이동이 판정에 영향 없게. 상수: `LONG_PRESS_MS`(450)·`PRESS_MOVE_TOLERANCE`(10)·`SWIPE_THRESHOLD`(50). 하위할일 영역(`data-list-subtasks`)은 메인 제스처에서 제외.

**Design tokens(`styles/tokens.js`):** `C`=색상, `Z`=z-index, `TONE`=날짜 톤(none/overdue/today/future).

## 위젯(네이티브) 아키텍처

- **스냅샷 단일 출처 = `SnapshotEngine.java`**: 기기 계정 토큰 → Tasks REST 전량 조회 → 오늘 필터·마커 파싱(JS와 동일 규칙) → SharedPreferences(`CapacitorStorage` store)에 `tt_today_snapshot` JSON 저장. 위젯은 이 스냅샷만 읽어 렌더(`TodayWidgetFactory`).
- **갱신 트리거**: 앱 내 변경 시 즉시(`useWidgetBridge`→`TodaySnapshotPlugin`) + 잠금해제/부팅 + WorkManager 15분 안전망(`SnapshotScheduler`/`Worker`). Tasks API엔 변경 푸시(watch)가 없어 외부 변경은 폴링만 가능.
- **위젯 상호작용**: 체크 토글(낙관적 스냅샷 갱신 + 서버 write-back), 펼침 토글(`tt_widget_expanded`), 테마(`tt_widget_theme`), 행 탭→앱 딥링크.
- ⚠️ **이중 구현**: 오늘 필터(`isTaskOnDate`)·notes 마커 파싱이 `src/utils/{date.js,taskNotes.js}`(JS)와 `SnapshotEngine.java`(Java)에 **둘 다** 존재(번들앱+네이티브 위젯 구조상 불가피). **규칙 변경 시 양쪽 함께 수정.** 위젯 행 라벨(`widgetMeta`)은 앱 `rowDateLabel`과 별개 규칙.

## 작업 시 주의 (버그수정·확장 공통)

- **동기화 경로를 건드리면** `useTasks`(applyOp/flushPendingOps/createTaskWithSubtasks) + `taskModel`/`taskNotes`를 함께 본다. notes는 재인코딩 규칙 때문에 한 곳만 바꾸면 데이터 유실 위험.
- **날짜/마커 규칙을 바꾸면** JS(date.js/taskNotes.js)와 **Java(SnapshotEngine)** 둘 다 고친다.
- **`parent`/`previous`는 쿼리 파라미터**로만(googleTasks.js). body에 넣으면 하위가 최상위로 생성됨.
- **순수 로직은 `utils/`로 빼고 vitest 추가**(현재 48개). 제스처/UI는 자동 테스트가 없으니 **S23 실기기 수동 검증**.
- **커밋 후 정책**: web UI 변경은 `main` push 시 PWA 자동배포됨(반쯤 된 변경 주의). 위젯/네이티브 변경은 release APK 재빌드해 S23 재설치. 큰/위험 변경은 피처 브랜치 권장.
- **리포팅**: 계획 제시 시 변경/생성 파일을 명시. 깨지면 원인을 평이하게 설명 후 수정.

## 알려진 한계 / 향후 작업 후보

- **temp-id race(부분 해결)**: 갓 만든 할일에 곧바로 하위할일 추가는 해결(`inflightParentRef`). 하지만 **갓 만든 할일을 동기화 전에 즉시 완료토글/수정/삭제/순서변경**하면 임시 id가 API로 새는 동일류 race가 남음(저빈도, 보류). 빠른 연속 신규 생성(addTask) 직렬화도 미적용. 근본 해결책=전역 temp→real 해소 계층(회귀 위험 커 보류).
- **Google Tasks API 한계(코드로 해결 불가)**: `due`는 날짜 단위(시각 무시), 반복(recurrence) 생성 불가, `created` 시각 없음(과거 잘못된 position은 자동 복구 불가 — 한 번 드래그로 정리하면 영구 저장). 변경 푸시 없음(폴링만).
- **토큰**: 웹은 1시간 만료 시 재로그인(백엔드 없어 refresh token 불가). 네이티브는 기기 계정으로 자동 갱신.
- **확장 시 참고**: 반복일정·시각 등은 `taskModel`에 예약 필드를 두고 매퍼 한 곳에서 확장. 데이터/동기화 층이 UI와 분리돼 있어 새 화면 추가가 쉬움.
