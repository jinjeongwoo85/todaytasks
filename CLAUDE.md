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
  TodayTasks.jsx          # 메인 UI 컴포넌트 (모든 UI 상태 여기)
  hooks/
    useGoogleAuth.js      # Google OAuth 토큰 관리 + localStorage 캐싱
    useTasks.js           # Google Tasks API CRUD + 로컬 상태 관리
  api/
    googleTasks.js        # Google Tasks REST API 호출 함수
  db/                     # (Phase 5~) localDB.js (Dexie/IndexedDB)
public/
  icons/                  # (Phase 7~) PWA 아이콘 192x192, 512x512
index.html                # GIS 스크립트 포함 (accounts.google.com/gsi/client)
vite.config.js            # Vite + PWA 설정
.env                      # VITE_GOOGLE_CLIENT_ID 설정됨
```

## Current State

**Phase 1~4 완료. 다음 작업: Phase 5.**

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | Vite + React + vite-plugin-pwa 빌드 인프라 | ✅ |
| 2 | Google Cloud: Tasks API 활성화, OAuth 웹 클라이언트 생성 | ✅ |
| 3 | Google OAuth 로그인 + localStorage 토큰 캐싱(55분) | ✅ |
| 4 | Google Tasks API 연동 — 실제 데이터 CRUD | ✅ |
| 5 | 오프라인 저장 (Dexie/IndexedDB) | 다음 |
| 6 | UI 개선 | 대기 |
| 7 | PWA 완성 + GitHub Pages 배포 | 대기 |

## Key Architecture Decisions (Phase 3~4)

- **인증**: Google Identity Services(GIS) Token model — 백엔드 불필요, 브라우저에서 직접 액세스 토큰 발급
- **토큰 저장**: `localStorage`에 55분 TTL로 캐싱 → 앱 재실행 시 자동 로그인 (1시간 이내)
- **API 연동**: `useTasks` 훅이 로컬 state와 API를 동시에 관리 (optimistic update)
- **하위 작업(subtasks)**: Google Tasks의 `parent` 필드 활용 — 별도 태스크로 저장됨
- **Google Cloud 프로젝트**: "My First Project" 사용, OAuth 클라이언트 이름 "TodayTasks Web"
- **OAuth 앱 이름**: 로그인 팝업에 "주간뉴스-260616"으로 표시됨 — OAuth 동의 화면에서 수정 가능 (비기능적 이슈)

## Phase 5 계획 (다음 작업)

오프라인에서도 할 일 조회/추가가 되도록 IndexedDB에 데이터를 캐싱.
- `src/db/localDB.js` 생성 (Dexie 사용, 이미 `package.json`에 포함)
- `useTasks`에 오프라인 fallback 추가: 온라인이면 API, 오프라인이면 IndexedDB
- PWA Service Worker가 백그라운드에서 동기화 처리

The `workflows/` and `tools/` directories do not yet exist. Create them when the first workflow or tool is needed.

## TodayTasks Component Architecture

`TodayTasks.jsx` is a single-file React component (~770 lines). All state lives in the top-level `TodayTasks` export — no external state management.

**Component tree:**
```
TodayTasks (main, all state here)
├── MonthCalendar          — collapsible month grid picker
├── CopyDateButton         — invisible <input type="date"> overlay trick (single-tap)
├── LabeledDateField       — same invisible overlay trick for start/end date chips
├── SubtaskList            — inline subtask add/toggle/remove
└── TaskDetailModal        — bottom sheet (slide-up) for full task editing
```

**Key data shape per task:**
```js
{ id, text, done, dueDate, date, notes, expanded, subtasks: [{ id, text, done }] }
```
- `date` = start date (optional), `dueDate` = end/due date
- When both are set and `date < dueDate`, the task appears on every date in that range (`isTaskOnDate`)

**Date tone system** — drives chip colors based on `dueDate` vs today:
- `overdue` → warm red (`#F3E0D8` / `#B5562F`)
- `today` → sage green (`#E3EBE0` / `#4D6B4F`)
- `future` → muted warm (`#EDEAE2` / `#6B6862`)
- `none` → neutral

**Gesture handling:**
- Long-press (450 ms) on a task row enters multi-select mode
- Horizontal swipe on the container shifts the selected date ±1 day
- Both gestures cancel if pointer moves more than 10 px during press

**Typography:** `.mono` = IBM Plex Mono, `.sans` = Inter (loaded via Google Fonts inline in JSX `<style>`)

**Invisible date picker pattern:** `<input type="date">` is `position: absolute; opacity: 0` over a styled visible chip, so the first tap directly opens the native date picker.

## Secrets & Security

- Secrets go in `.env` only — never in tools, workflows, or this file
- `.env`, `credentials.json`, and `token.json` must stay in `.gitignore`

## Reporting

When presenting a plan: list exactly which files will be created or changed.
When something breaks: explain what happened in plain language before fixing it.
