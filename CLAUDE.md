# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Philosophy

This project follows a **Workflow → Agent → Tool** pattern defined in `claude_en.md`:

- **Workflows** (`workflows/`) — plain-language step-by-step instructions per task
- **Agent** (you) — reads the workflow, picks the right tool, executes
- **Tools** (`tools/`) — Python scripts that do the actual work (API calls, data transforms, file ops)

Before building anything new, check `tools/` for reusable scripts. If a task recurs, it gets a workflow.

## Build Commands

```bash
npm run dev       # 개발 서버 시작 (http://localhost:5173)
npm run build     # GitHub Pages 배포용 빌드 → dist/ 생성
npm run preview   # 빌드 결과물 로컬 미리보기
```

## Environment Variables

`.env` 파일에 설정 (`.env.example` 참고):
```
VITE_GOOGLE_CLIENT_ID=xxxxxx.apps.googleusercontent.com
```

`VITE_` 접두사가 없으면 브라우저에서 접근 불가.

## GitHub Pages 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 빌드 및 배포.
`vite.config.js`의 `REPO_BASE` 값이 GitHub 저장소 이름과 일치해야 함.

## Project Structure

```
src/
  main.jsx                # React 앱 진입점
  TodayTasks.jsx          # 메인 컨테이너 (~360줄) — 모든 UI 상태 + 화면 조립
  hooks/
    useGoogleAuth.js      # Google OAuth 토큰 관리 + localStorage 캐싱
    useTasks.js           # Tasks API CRUD + 로컬 state + IndexedDB 오프라인 fallback
    useTaskListGestures.js# 롱프레스·가로스와이프·드래그 제스처
    useReorderDrag.js     # 하위 작업 순서 변경 드래그
  components/             # UI 조각들 (Header, TaskList, TaskRow, TaskDetailModal,
                          #   BottomSheet, CalendarSheet, MonthCalendar, SettingsSheet,
                          #   SubtaskList, DateChip, LabeledDateField, LoginScreen)
  utils/
    date.js               # ISO 변환·날짜 톤·범위 판정(isTaskOnDate) 등
    taskModel.js          # Google Task ↔ 로컬 모델 변환, API body 빌더
    id.js                 # 임시 id 생성
  styles/
    tokens.js             # 색상(C)·톤(TONE)·z-index(Z)·제스처 상수
  api/
    googleTasks.js        # Google Tasks REST API 호출 함수
  db/
    localDB.js            # Dexie/IndexedDB 오프라인 캐시
public/
  icons/                  # PWA 아이콘 192x192, 512x512
index.html                # GIS 스크립트 포함 (accounts.google.com/gsi/client)
vite.config.js            # Vite + PWA 설정
.env                      # VITE_GOOGLE_CLIENT_ID 설정됨
```

## Current State

**Phase 1~7 + GitHub Pages 배포까지 완료.** 이후 순서/하위할일 UX 개선(커밋 3285b04)과 `TodayTasks.jsx` 컴포넌트 분리 리팩토링까지 진행됨.

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | Vite + React + vite-plugin-pwa 빌드 인프라 | ✅ |
| 2 | Google Cloud: Tasks API 활성화, OAuth 웹 클라이언트 생성 | ✅ |
| 3 | Google OAuth 로그인 + localStorage 토큰 캐싱(55분) | ✅ |
| 4 | Google Tasks API 연동 — 실제 데이터 CRUD | ✅ |
| 5 | 오프라인 저장 (Dexie/IndexedDB) | ✅ |
| 6 | UI 개선 | ✅ |
| 7 | PWA 완성 + GitHub Pages 배포 | ✅ |

**다음 작업 (남은 정리):** `useTasks.js`(~462줄)의 CRUD/optimistic-update 중복 로직 정리 리팩토링.

## Key Architecture Decisions

- **인증**: Google Identity Services(GIS) Token model — 백엔드 불필요, 브라우저에서 직접 액세스 토큰 발급
- **토큰 저장**: `localStorage`에 55분 TTL로 캐싱 → 앱 재실행 시 자동 로그인 (1시간 이내)
- **API 연동**: `useTasks` 훅이 로컬 state와 API를 동시에 관리 (optimistic update)
- **오프라인**: `useTasks`가 IndexedDB(`db/localDB.js`, Dexie)로 fallback — 온라인이면 API, 오프라인이면 로컬 캐시. `isOffline` 플래그로 배너 표시
- **순서(ordering)**: Google Tasks의 `position`(사전식 문자열)을 단일 출처로 사용. 새 항목은 마지막 실제 형제(`previous`) 뒤에 추가해 생성순서 보존 (`useTasks.js`의 `lastRealId` 주석 참고)
- **시작일·시각의 notes 저장**: Google 공개 API엔 날짜 칸이 `due`(날짜 단위, 시각 버림) 하나뿐 — 별도 시작일/시각/기한 필드 없음(실측 검증함). 그래서 **종료일만 `due`에**, **시작일·시각은 `notes` 끝줄 `⟦tt start=… time=…⟧` 마커**로 저장하고 앱에서 분리(`utils/taskNotes.js`). 트레이드오프: Google 공식 앱 세부정보엔 마커가 글자로 보임. ⚠️ notes엔 3값(메모+시작일+시각)이 한 칸에 뭉쳐 있어, 하나만 바꿔도 **병합된 최신 상태로 재인코딩**해야 나머지가 안 지워짐(`useTasks.updateTask` 참고). 디코드는 관대하게 설계(마커 깨져도 메모 보존)
- **하위 작업(subtasks)**: Google Tasks의 `parent` 필드 활용 — 별도 태스크로 저장됨. 하위작업은 시작일·시각 마커를 쓰지 않음(상위 작업만)
- **Google Cloud 프로젝트**: "My First Project" 사용, OAuth 클라이언트 이름 "TodayTasks Web"
- **OAuth 앱 이름**: 로그인 팝업에 "주간뉴스-260616"으로 표시됨 — OAuth 동의 화면에서 수정 가능 (비기능적 이슈)

The `workflows/` and `tools/` directories do not yet exist. Create them when the first workflow or tool is needed.

## TodayTasks Component Architecture

`TodayTasks.jsx`(~360줄)가 컨테이너로 **모든 UI 상태**를 보유하고, 화면은 `components/`의 조각들로 조립한다 — 외부 상태관리 라이브러리 없음.

**Component tree:**
```
TodayTasks (main, all state here)
├── Header                 — 날짜/뷰 토글, 설정 진입
├── TaskList               — 날짜별 할일 목록
│   └── TaskRow            — 한 줄 (체크/제목수정/하위 펼침)
│       └── SubtaskList    — inline 하위작업 추가·토글·삭제
├── CalendarSheet          — 바텀시트 달력
│   └── MonthCalendar      — 월 그리드 picker
├── SettingsSheet          — 설정 바텀시트
├── TaskDetailModal        — 할일 상세 편집 바텀시트(slide-up)
│   ├── DateChip / LabeledDateField — invisible <input type="date"> 오버레이
│   └── SubtaskList
└── LoginScreen            — 미로그인 시
(BottomSheet = 시트 공통 래퍼)
```

**Key data shape per task:**
```js
{ id, text, done, dueDate, date, time, notes, expanded, subtasks: [{ id, text, done }],
  _listId, _parentId, _position }   // _접두사 = Google Tasks 동기화용 내부 필드
```
- `dueDate` = **종료일(기본 날짜)** — Google `due`에 네이티브 저장
- `date` = 시작일(optional), `time` = 시각 'HH:mm'(종료일에 종속) — **둘 다 Google `notes`에 마커로 저장**
- 둘 다 있고 `date < dueDate`면 그 사이 모든 날에 표시(`isTaskOnDate`)
- 행 라벨 규칙은 `rowDateLabel`(`utils/date.js`): 시각은 있으면 항상 뒤에 붙음. 기간은 시작일을 `~`로 대체(`~6.19 18:00`, 종료=오늘이면 `~오늘 18:00`), 단일은 종료=오늘→`오늘`, 그 외→`6.22(화)`(예: `6.22(화) 18:00`)
- 모델 변환은 `utils/taskModel.js`(`googleToTask` / `taskToGoogleBody`), 마커 인코딩은 `utils/taskNotes.js`. 단, 실제 동기화 경로(매핑/인코딩)는 `hooks/useTasks.js` 인라인에도 있음(둘을 함께 맞춰야 함)

**Design tokens** — 색상·톤·z-index·제스처 상수는 `styles/tokens.js`로 모음:
- `C` = 색상 팔레트, `Z` = z-index 레이어
- `TONE` = 날짜 톤(none/overdue/today/future) 배경·전경·테두리. `dateTone()`(`utils/date.js`)가 키 결정
- `LONG_PRESS_MS`(450) · `PRESS_MOVE_TOLERANCE`(10) · `SWIPE_THRESHOLD`(50)

**Gesture handling** (`hooks/useTaskListGestures.js`):
- 롱프레스(`LONG_PRESS_MS`) → 다중선택·드래그 진입
- 컨테이너 가로 스와이프(`SWIPE_THRESHOLD` 이상) → 선택 날짜 ±1일 (좌→우 -1, 우→좌 +1)
- press 중 `PRESS_MOVE_TOLERANCE`(10px) 넘게 움직이면 제스처 취소

**Typography:** `.mono` = IBM Plex Mono, `.sans` = Inter (loaded via Google Fonts inline in JSX `<style>`)

**Invisible date picker pattern:** `<input type="date">` is `position: absolute; opacity: 0` over a styled visible chip, so the first tap directly opens the native date picker.

## Secrets & Security

- Secrets go in `.env` only — never in tools, workflows, or this file
- `.env`, `credentials.json`, and `token.json` must stay in `.gitignore`

## Reporting

When presenting a plan: list exactly which files will be created or changed.
When something breaks: explain what happened in plain language before fixing it.
