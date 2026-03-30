# Budget Coder (Prompt Compiler) - Functional Specification

> **Naming**: Chinese name "廉价编程". Recommended English UI name is **Budget Coder** or **Context Builder** — avoids the "low quality" connotation of "cheap" in English software branding.

---

## 1. Product Concept

A standalone tool available inside Echobird App Manager (similar to AI Translator or Reversi), or packaged as an independent installable application.

**Goal**: The user points a cheap/fast model (e.g., Gemini Flash, 4o-mini, local Deepseek) at a local codebase directory. The cheap model acts as an **Architect** — it reads the local code, understands the user's raw instruction, and compiles a highly structured, context-rich **"Super Prompt"** ready to paste into an expensive model (Claude Opus / Sonnet) for actual code generation.

This eliminates the most expensive part of a coding session: the expensive model's blind exploration of an unfamiliar codebase.

---

## 2. Core Inspiration

- **Aider (Repo Map)**: Aider extracts AST function/class signatures across all files into a compact "map", so the model understands the full project without reading everything. We borrow this idea.
- **Repopack**: An open-source tool that packs an entire codebase into a single AI-ready XML/Markdown file, respecting `.gitignore`. We borrow its filtering and output format.
- **LangChain Map-Reduce**: Batch-summarize each file with a cheap model, then aggregate only the relevant summaries.

---

## 3. Core Workflow

### Step 1 — User Input
- User types a raw, vague feature request (e.g., "Add dark mode toggle to settings page").
- User selects a local project directory.
- User selects a cheap model from their configured Model Nexus list (Gemini Flash recommended).

### Step 2 — Analysis (Repo Map & File Filter)
- App reads the directory tree, automatically ignoring: `node_modules`, `dist`, `.env`, `build`, `*.lock`, binary files, and anything in `.gitignore`.
- Generates a lightweight **Repo Map**: a compact text representation of directory structure + key file signatures (function names, exports, component names via regex/ctags).
- Sends the Repo Map + user instruction to the cheap model with the prompt: *"List only the files I need to read to implement this task."*

### Step 3 — Compilation
- App fetches full content of selected files only.
- Cheap model plays the "Architect" role: it breaks down the instruction into a numbered **Execution Checklist**.
- App assembles the final payload: User Goal + Checklist + full file contents, wrapped in XML tags.

### Step 4 — Handoff
- UI displays **Token Count + Estimated Cost** (e.g., "32,000 tokens → ~$0.45 with Opus").
- User can **manually untick irrelevant files** before finalizing.
- One-click: **Copy to Clipboard** OR **Send directly to Echobird Channels** (via window event, targeting the user's Opus/Sonnet model).

---

## 4. Super Prompt Output Format (XML)

The cheap model is required to output in strict XML. This format is optimized for Anthropic Prompt Caching (static prefix blocks).

```xml
<user_goal>
  Add a dark mode toggle to the settings page.
</user_goal>

<implementation_checklist>
- [ ] 1. Add `darkMode` toggle state to SettingsStore
- [ ] 2. Update `Settings.tsx` to render the toggle UI
- [ ] 3. Apply `dark:` Tailwind classes to the root layout in `App.tsx`
- [ ] 4. Persist the setting to localStorage
</implementation_checklist>

<project_context>
  <file path="src/App.tsx">
    ...full code...
  </file>
  <file path="src/pages/Settings/Settings.tsx">
    ...full code...
  </file>
  <file path="src/stores/settingsStore.ts">
    ...full code...
  </file>
</project_context>

<execution_instructions>
Implement the checklist above step by step. Output modified files in full inside markdown code blocks labeled with the file path. Do not invent new dependencies. You are a senior software engineer.
</execution_instructions>
```

---

## 5. Technical Requirements

### Frontend (React)
| Component | Detail |
|-----------|--------|
| Directory Picker | Native OS picker via Tauri `dialog.open()` API |
| Token Estimator | Lightweight JS tokenizer (`gpt-tokenizer` npm) — real-time count + USD cost estimate |
| File Tree UI | Checklist of selected files, user can untick before finalizing |
| Model Selector | Reads from existing Model Nexus config — defaults to cheapest/fastest model |
| Output Panel | Read-only textarea showing final Super Prompt, copy button, send-to-channels button |

### Backend (Rust / Tauri)
| Command | Detail |
|---------|--------|
| `scan_project_tree` | Uses the `ignore` crate (same engine as ripgrep) — respects `.gitignore` automatically |
| `read_selected_files` | Reads file contents in parallel using `tokio::spawn`, returns UTF-8 text |
| `extract_repo_map` | Regex-based extraction of function/class/component names per file for the compact Repo Map |

---

## 6. Potential Pitfalls & Mitigations

| Pitfall | Mitigation |
|---------|-----------|
| User selects `C:\` or huge monorepo | Hard cap: max 8 directory depth, max 5,000 files scanned |
| Cheap model selects too many files | If selected files > 80K tokens, show warning and ask user to narrow scope |
| Cheap model returns malformed XML | Retry once with stricter system prompt; if fails again, show raw text with a parse error notice |
| Binary or non-UTF-8 files break reader | Skip files that fail UTF-8 decoding, show skipped list in UI |
| User forgets which cheap model to use | Default to the cheapest model configured in Model Nexus; show price-per-token hint next to model name |

---

## 7. Relationship to `token-savings.md`

`token-savings.md` is a **user guide** (rules for humans to follow manually).  
This spec is the **engineering document** for building a tool that automates Rule 8 from that guide:

> *"Use Prompt Compilers (Cheap Coder) for Global Context — point a cheap model at your directory, let it build a high-quality context payload, then hand off to Opus."*

---

## 8. Deployment Options

| Mode | Description |
|------|-------------|
| **Embedded in Echobird** | Appears in App Manager as a built-in tool, shares Model Nexus config |
| **Standalone App** | Packaged separately as `budget-coder-setup.exe`, can be installed without Echobird |
| **CLI mode** | Optional: `budget-coder --dir ./myproject --goal "add dark mode" --output prompt.xml` |