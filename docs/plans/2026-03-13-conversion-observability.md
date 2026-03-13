# Conversion Observability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal end-to-end logging trail for the document conversion flow so a single conversion attempt can be traced from UI click to API processing, file write, module reload, and board render.

**Architecture:** Add a small shared conversion trace ID generated in the client and propagated through the conversion request. Use structured server-side logs for each conversion phase and lightweight client-side logs around request start/progress/reload/render so debugging can correlate one run across browser, Next API, and board state. Keep the scope narrow to the conversion path only; do not introduce a full logging platform.

**Tech Stack:** Next.js 16 route handlers, React client components/hooks, Zustand, TypeScript, console-based structured logs

---

### Task 1: Add a tiny conversion logger utility

**Files:**
- Create: `apps/web/lib/logging/conversion-log.ts`
- Test: `apps/web/lib/logging/conversion-log.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { createConversionTraceId, formatConversionLog } from './conversion-log'

describe('conversion-log', () => {
  it('formats structured log lines with scope and trace id', () => {
    const line = formatConversionLog('client', 'trace-123', 'reload_done', { modules: 3 })

    expect(line).toContain('[convert][client][trace-123][reload_done]')
    expect(line).toContain('"modules":3')
  })

  it('creates a non-empty trace id', () => {
    expect(createConversionTraceId()).toMatch(/^conv-/)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run lib/logging/conversion-log.test.ts`
Expected: FAIL with module/file not found

**Step 3: Write minimal implementation**

```ts
export function createConversionTraceId() {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatConversionLog(
  scope: 'client' | 'server' | 'board',
  traceId: string,
  event: string,
  data?: Record<string, unknown>
) {
  const suffix = data ? ` ${JSON.stringify(data)}` : ''
  return `[convert][${scope}][${traceId}][${event}]${suffix}`
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run lib/logging/conversion-log.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/lib/logging/conversion-log.ts apps/web/lib/logging/conversion-log.test.ts
git commit -m "feat: add conversion logging utility"
```

### Task 2: Add client-side trace logging to document conversion hook

**Files:**
- Modify: `apps/web/hooks/use-document-converter.ts:58-144`
- Modify: `apps/web/lib/tmplan/data-access.ts:204-249`
- Test: `apps/web/lib/logging/conversion-log.test.ts`

**Step 1: Write the failing test**

Extend `apps/web/lib/logging/conversion-log.test.ts` with:

```ts
it('formats payloads with nested progress data', () => {
  const line = formatConversionLog('client', 'trace-456', 'progress', {
    step: 'writing_module',
    slug: 'auth',
  })

  expect(line).toContain('"step":"writing_module"')
  expect(line).toContain('"slug":"auth"')
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run lib/logging/conversion-log.test.ts`
Expected: FAIL if formatter cannot serialize the expected payload shape or test not yet added

**Step 3: Write minimal implementation**

Make these exact changes:

1. In `apps/web/hooks/use-document-converter.ts`:
   - generate `const traceId = createConversionTraceId()` at conversion start
   - log `convert_start`, `validation_failed`, `request_sent`, `progress_event`, `reload_start`, `reload_done`, `convert_success`, `convert_error`, `convert_cancelled`
   - include `projectId`, `docsCount`, and module count where relevant

2. In `apps/web/lib/tmplan/data-access.ts`:
   - extend `convertDocsStream(...)` with an optional `traceId?: string`
   - include header `x-conversion-trace-id: traceId` when provided
   - do not change existing behavior when traceId is missing

Minimal shape example:

```ts
const traceId = createConversionTraceId()
console.log(formatConversionLog('client', traceId, 'convert_start', {
  projectId,
  docsCount: projectDocs.length,
}))
```

```ts
headers: {
  'Content-Type': 'application/json',
  ...(traceId ? { 'x-conversion-trace-id': traceId } : {}),
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run lib/logging/conversion-log.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/hooks/use-document-converter.ts apps/web/lib/tmplan/data-access.ts apps/web/lib/logging/conversion-log.test.ts
git commit -m "feat: trace conversion flow on client"
```

### Task 3: Add server-side conversion phase logs in the route handler

**Files:**
- Modify: `apps/web/app/api/plans/[projectPath]/convert/route.ts:273-439`
- Modify: `apps/web/lib/logging/conversion-log.ts`
- Test: `apps/web/lib/logging/conversion-log.test.ts`

**Step 1: Write the failing test**

Extend `apps/web/lib/logging/conversion-log.test.ts` with:

```ts
it('supports server scope logs', () => {
  const line = formatConversionLog('server', 'trace-789', 'modules_written', {
    count: 2,
  })

  expect(line).toContain('[convert][server][trace-789][modules_written]')
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run lib/logging/conversion-log.test.ts`
Expected: FAIL before implementation if scope typing/formatting is incomplete

**Step 3: Write minimal implementation**

In `apps/web/app/api/plans/[projectPath]/convert/route.ts`:
- read `const traceId = req.headers.get('x-conversion-trace-id') ?? createConversionTraceId()`
- add logs for:
  - `request_received`
  - `reading_started`
  - `reading_completed`
  - `ai_analysis_started`
  - `ai_analysis_completed`
  - `project_written`
  - `module_written` (per module)
  - `decision_written` (per decision)
  - `cache_written`
  - `stream_done`
  - `stream_error`
- never log API key or full document content
- only log safe metadata: projectPath, docsCount, doc names/paths, module count, decision count, slug, traceId

Minimal example:

```ts
console.log(formatConversionLog('server', traceId, 'request_received', {
  projectPath: basePath,
  docsCount: body.docs.length,
}))
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run lib/logging/conversion-log.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/app/api/plans/[projectPath]/convert/route.ts apps/web/lib/logging/conversion-log.ts apps/web/lib/logging/conversion-log.test.ts
git commit -m "feat: add server conversion trace logs"
```

### Task 4: Add board-side render/load logs for correlation

**Files:**
- Modify: `apps/web/components/board/pipeline-board.tsx:18-173`
- Modify: `apps/web/app/project/[id]/page.tsx:158-169`
- Test: `apps/web/lib/logging/conversion-log.test.ts`

**Step 1: Write the failing test**

Extend `apps/web/lib/logging/conversion-log.test.ts` with:

```ts
it('supports board scope logs', () => {
  const line = formatConversionLog('board', 'trace-board', 'render', {
    modules: 4,
    selectedModule: 'auth',
  })

  expect(line).toContain('[convert][board][trace-board][render]')
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run lib/logging/conversion-log.test.ts`
Expected: FAIL before implementation if board scope typing is incomplete

**Step 3: Write minimal implementation**

1. In `apps/web/app/project/[id]/page.tsx`:
   - pass `projectPath={projectId}` to `PipelineBoard`
   - optionally pass a lightweight `conversionTraceKey` prop if needed for correlation after success

2. In `apps/web/components/board/pipeline-board.tsx`:
   - log on mount/update when props change
   - log before `fetchModules(projectPath)`
   - log after module render decisions with safe metadata only:
     - total modules
     - featureModules count
     - implModules count
     - activeLayer
     - selectedModule present or not
   - if `modules.length === 0`, log `empty_state`

Minimal example:

```ts
console.log(formatConversionLog('board', traceId, 'render', {
  projectPath,
  modules: modules.length,
  activeLayer,
  selectedModule,
}))
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run lib/logging/conversion-log.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/components/board/pipeline-board.tsx apps/web/app/project/[id]/page.tsx apps/web/lib/logging/conversion-log.test.ts
git commit -m "fix: trace board reload after conversion"
```

### Task 5: Verify the full trace manually in Tauri dev

**Files:**
- Modify: none
- Test: manual verification using `apps/web/.next/dev/logs/next-development.log` and dev terminal output

**Step 1: Start the app**

Run: `./start-dev.ps1`
Expected: Tauri dev starts and Next dev server becomes ready

**Step 2: Trigger one conversion**

Run manually in UI: open one project, click `转换`
Expected: UI shows progress and terminal prints grouped `[convert][...]` logs sharing the same trace id

**Step 3: Verify log chain**

Check that one trace id appears in this order:
- client `convert_start`
- server `request_received`
- server `ai_analysis_completed`
- server `module_written`
- client `reload_done`
- board `render`

Expected: all events share one trace id and show where data stops flowing if the board stays empty

**Step 4: Verify empty-state diagnosis**

If the board is still empty, inspect the logs to determine which state is true:
- API wrote zero modules
- reload returned zero modules
- board rendered with non-zero modules but wrong layer/selection
- board never fetched because wrong prop path

Expected: root cause becomes directly observable from logs

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify conversion observability flow"
```
