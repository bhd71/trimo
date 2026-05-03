---
mode: agent
description: Generate tests for the latest changes in Trimo (Tauri 2 + React + Rust)
---

You are an expert in testing **Tauri 2 desktop apps** with a **React 18 / TypeScript / Vitest** frontend and a **Rust / SQLite** backend.

## Your task

Generate tests for the code changes I describe or paste below. Follow the structural rules for each layer:

---

## Frontend – TypeScript / Vitest

**Test file location:** `src/tests/<module-name>.test.ts` (or `.test.tsx` for React components)

**Framework:** Vitest (`describe`, `it`, `expect` — imported from `vitest`)

**Rules:**
- Only test **pure helper functions** (`src/helpers/`) and **stateless logic** directly.
- For React components, test only if the component has non-trivial conditional logic, computed output, or props-driven branching worth isolating.
- Do NOT mock Tauri IPC commands (`invoke`) — components that call them are integration concerns, skip them.
- Do NOT import from `@tauri-apps/*` in test files.
- Use the same factory helper pattern as the existing tests when constructing `IApp` objects:
  ```ts
  function makeApp(app_name: string, duration: number): IApp {
    return { id: app_name, app_name, duration, formatted_duration: '' };
  }
  ```
- Group tests with `describe` per function/behaviour, one `it` per case.
- Cover: happy path, edge cases (zero, empty, boundary values), and failure/null paths.

**Reference files:**
- `src/tests/app-stats.test.ts` — example for helper tests
- `src/tests/format-time.test.ts` — example for pure utility tests
- `src/helpers/app-stats.ts`, `src/helpers/format-time.ts` — the helpers being tested
- `src/types/App.interface.ts` — shared interfaces

---

## Backend – Rust / cargo test

**Test file location:** `src-tauri/tests/<module>.rs` (integration tests) OR `#[cfg(test)] mod tests { ... }` inside the source file (unit tests)

**Rules:**
- Test **pure functions only**: functions in `helpers/name_helper.rs`, `process/filter.rs`, `logo/placeholder.rs`.
- Do NOT test functions that call Win32 API (`GetLastInputInfo`, `SHGetImageList`, `DrawIconEx`, etc.) — mark them with `#[ignore]` and a comment `// requires Windows GUI session`.
- Do NOT test Tauri commands directly (`#[tauri::command]` fns) — they need a full app handle.
- Do NOT test database queries — they require a live `SqlitePool`.
- Each test function must be `#[test]`, no async unless using `#[tokio::test]` with a clear reason.
- Use `assert_eq!`, `assert!`, and descriptive test names in snake_case.
- For `map_helper_to_main_app` and `should_skip_process`, add cases for any **newly added** process name mappings.

**Reference files:**
- `src-tauri/tests/filter.rs` — example for `process/filter.rs` tests
- `src-tauri/tests/name_helper.rs` — example for `helpers/name_helper.rs` tests
- `src-tauri/src/helpers/name_helper.rs` — source under test
- `src-tauri/src/process/filter.rs` — source under test

---

## What to generate

Given the following change (paste diff, function, or description below):

```
<PASTE CHANGED CODE OR DIFF HERE>
```

Output:
1. The **complete test file** (not snippets) — ready to be placed at the correct path.
2. A one-line comment at the top: `// Tests for: <what is being tested>`
3. Any imports needed.
4. No placeholder comments like `// TODO` — every test must have a concrete assertion.

If the change does not introduce testable pure logic (e.g. it only touches UI layout, Tauri event wiring, or Win32 calls), respond with:
> "No unit-testable logic was introduced. Consider an integration test or manual verification."
