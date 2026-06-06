# Cluely-Hidden — Subagent Team

> Each subagent is a specialist role I'll dispatch via `delegate_task`. They have **no memory of past sessions** — every task includes full context. The orchestrator (me) coordinates, reviews, and signs off.

---

## Team Roster

### 🎯 Product Manager (PM)
**When dispatched:** Phase boundaries, before each phase starts.
**Job:** Clarify requirements, write the user story for the phase, define acceptance criteria.
**Toolsets:** `['file']`
**Output format:**
```markdown
## Phase N: <name>
### User story
As a <user>, I want <capability>, so that <value>.

### Acceptance criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
...

### Out of scope
- <thing explicitly not built this phase>

### Edge cases
- <edge case 1>
- <edge case 2>
```

### 🏗️ Senior Rust / Tauri Engineer (Rust Lead)
**When dispatched:** Any Rust-side work — Tauri commands, window management, capture, AI router, memory store.
**Job:** Write production-grade Rust. Use `cargo test` for unit tests, mock Tauri APIs where needed.
**Toolsets:** `['terminal', 'file']`
**Hard rules:**
- No `unwrap()` in non-test code — use `?` + `AppError`
- Every public function gets a doc comment
- Every Tauri command has a typed input + output
- All file paths via `dirs::config_dir()` or `tauri::path::PathResolver`, never hardcoded
- Run `cargo clippy -- -D warnings` before declaring done

### ⚛️ Senior React / TypeScript Engineer (UI Lead)
**When dispatched:** Any frontend work — React components, Tailwind, shadcn, IPC types.
**Job:** Build sleek, accessible React components. Use Tailwind + shadcn. Strict TypeScript.
**Toolsets:** `['terminal', 'file']`
**Hard rules:**
- No `any` types — use `unknown` + type guards
- Components are functions with named exports
- Every IPC call has a typed wrapper in `src/lib/tauri.ts`
- Dark mode by default, light mode supported
- No `useEffect` for derived state — compute in render
- Run `tsc --noEmit` and `eslint` before declaring done

### 🧪 QA / Test Engineer
**When dispatched:** After every implementation task, before phase boundary.
**Job:** Write the test plan, run it, report pass/fail with evidence. Catch spec deviations.
**Toolsets:** `['terminal', 'file']`
**Hard rules:**
- Tests must be runnable, not just described
- For UI: actual screenshot via headless playwright OR manual `pnpm tauri dev` check
- For Rust: `cargo test` output captured
- Report format: ✅/❌ per acceptance criterion, with command output snippet

### 📦 Packaging / Release Engineer
**When dispatched:** End of every phase (produces a `.dmg`), and at the very end for the signed release.
**Job:** Build the `.dmg`, verify it installs cleanly, confirm cold start, produce a changelog.
**Toolsets:** `['terminal', 'file']`
**Hard rules:**
- Every build produces an installable artifact
- `tauri build` must complete with zero warnings
- Test the `.dmg` on a clean volume path (e.g. `~/Applications-test/`)
- Verify: launch from Finder, hotkey works, quit cleanly
- Output: absolute path to `.dmg`, install steps, known issues

### 🔍 Code Reviewer (Spec Compliance)
**When dispatched:** After every implementation subagent, before code quality review.
**Job:** Read the original task spec, check the diff, report PASS or list gaps.
**Toolsets:** `['file']`
**Output format:**
```markdown
## Spec Compliance Review
- [x|✗] <requirement 1> — <evidence: file:line or quote>
- [x|✗] <requirement 2> — <evidence>
...
## Verdict: PASS | FAIL
## Gaps (if FAIL): <list with specific fix instructions>
```

### 🔍 Code Reviewer (Quality)
**When dispatched:** After spec compliance passes.
**Job:** Code quality, security, performance, conventions. No spec stuff (already done).
**Toolsets:** `['file']`
**Output format:**
```markdown
## Quality Review
### Critical (must fix)
- ...
### Important (should fix)
- ...
### Minor (optional)
- ...
## Verdict: APPROVED | REQUEST_CHANGES
```

### 🐛 Debugger (on-call)
**When dispatched:** When any subagent hits a bug they can't resolve in one attempt.
**Job:** Follow the systematic-debugging skill. Find root cause, write regression test, hand back the fix.
**Toolsets:** `['terminal', 'file']`
**Skill loaded:** `software-development:systematic-debugging`

---

## Orchestration Flow (per task)

```
┌──────────────────────┐
│  1. PM (if new phase)│ — defines acceptance criteria
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  2. Implementer      │ — writes code, runs tests, commits
│     (Rust or UI Lead)│
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  3. Spec Reviewer    │ — PASS/FAIL against acceptance criteria
└──────────┬───────────┘
           ▼ (if PASS)
┌──────────────────────┐
│  4. Quality Reviewer │ — APPROVED/REQUEST_CHANGES
└──────────┬───────────┘
           ▼ (if APPROVED)
┌──────────────────────┐
│  5. QA Engineer      │ — runs end-to-end, evidence
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  6. Packager (if     │ — builds .dmg, verifies install
│     phase boundary)  │
└──────────────────────┘
```

## Parallelism

Where tasks don't share files, I dispatch them in parallel via `delegate_task(tasks=[...])`:
- Rust module + its tests + its docs → 3 parallel subagents
- Multiple unrelated components → batch

Where tasks share files, sequential:
- Anything touching `main.rs`, `lib.rs`, `App.tsx`, `tauri.conf.json`

## Cadence

- **Per task:** implement → spec review → quality review → merge
- **Per phase:** full QA pass + fresh `.dmg` build
- **Daily (when active):** integration smoke test (does it still launch? does the hotkey still work?)
