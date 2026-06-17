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
  main.jsx          # React 앱 진입점
  TodayTasks.jsx    # 메인 UI 컴포넌트 (프로토타입)
  hooks/            # (Phase 3~) useGoogleAuth, useTasks
  api/              # (Phase 4~) googleTasks.js
  db/               # (Phase 5~) localDB.js (Dexie/IndexedDB)
public/
  icons/            # (Phase 7~) PWA 아이콘 192x192, 512x512
index.html          # Vite HTML 진입점
vite.config.js      # Vite + PWA 설정
```

## Current State

Phase 1 완료: Vite + React + vite-plugin-pwa 빌드 인프라 설정됨.
현재 `src/TodayTasks.jsx`는 하드코딩 데이터를 사용하는 프로토타입 상태.

남은 작업: Phase 2(Google Cloud 설정) → Phase 3(OAuth) → Phase 4(API) → Phase 5(오프라인) → Phase 6(UI 연결) → Phase 7(PWA 완성)

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
