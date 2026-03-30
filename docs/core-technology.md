# Budget Coder — Core Technology Architecture

---

## TL;DR

Budget Coder's core technology is a **3-layer pipeline**:

```
Layer 1: Local Code Indexing (Tree-sitter AST + Repo Map)
Layer 2: Cheap Model Intelligence (File Selection + Checklist Generation + Skills Injection)
Layer 3: Structured Output Compilation (Super Prompt in XML)
```

It is NOT just "cheap model + RAG". It's a full **Prompt Compiler** with deterministic indexing, intelligent filtering, and knowledge enrichment.

---

## 1. The 3 Core Technologies

### Technology 1: Deterministic Code Indexing (No LLM needed)

This is the **foundation layer** — it runs locally, costs $0.00 in tokens, and produces a compact "Repo Map."

| Component | Tool | What it does |
|---|---|---|
| **Directory Scanner** | Rust `ignore` crate (same as ripgrep) | Walks the file tree, respects `.gitignore`, skips binaries |
| **AST Parser** | **Tree-sitter** | Parses each file into an Abstract Syntax Tree |
| **Symbol Extractor** | Tree-sitter queries | Extracts function names, class names, exports, type definitions |
| **Repo Map Generator** | Custom (Aider-inspired) | Builds a compact text of: file paths + signatures |

**Example output** (Repo Map for a React project, ~500 tokens):

```
src/App.tsx
  ├─ function App()
  ├─ const router = createBrowserRouter(...)
  └─ export default App

src/pages/Settings/Settings.tsx
  ├─ interface SettingsProps { theme: Theme }
  ├─ function Settings(props: SettingsProps)
  ├─ function ThemeToggle()
  └─ export default Settings

src/stores/settingsStore.ts
  ├─ interface SettingsState { darkMode: boolean }
  ├─ const useSettingsStore = create<SettingsState>(...)
  └─ export { useSettingsStore }
```

> **Key insight**: This step is 100% local, zero-cost, and deterministic. It converts a 10,000-file codebase into a ~2K-5K token map. This is what Aider does, and it's the most proven technique in the field.

---

### Technology 2: Cheap Model Intelligence (The "Architect")

This is where the LLM comes in — but it's a **cheap** one (Gemini Flash-Lite: $0.10/M input).

The cheap model receives:
1. The Repo Map (from Technology 1)
2. The user's raw instruction
3. (Optional) Relevant Skills context

And produces:
1. **File Selection**: Which files need to be read in full
2. **Implementation Checklist**: Step-by-step plan for the expensive model
3. **Relevance Judgment**: Which skills/patterns apply

```
┌──────────────────────────────────────────────────┐
│  INPUT to cheap model:                           │
│  ┌─────────────┐  ┌──────────────────────┐       │
│  │ Repo Map     │  │ User instruction     │      │
│  │ (~2K tokens) │  │ "Add dark mode"      │      │
│  └─────────────┘  └──────────────────────┘       │
│  ┌──────────────────────┐                        │
│  │ Skills index (opt.)  │                        │
│  │ (~500 tokens)        │                        │
│  └──────────────────────┘                        │
│                                                  │
│  OUTPUT from cheap model:                        │
│  ┌──────────────────────────────────────┐        │
│  │ 1. Read: Settings.tsx, App.tsx,      │        │
│  │    settingsStore.ts                  │        │
│  │ 2. Checklist:                        │        │
│  │    - Add darkMode to store           │        │
│  │    - Add toggle component            │        │
│  │    - Apply dark classes to root      │        │
│  │    - Persist to localStorage         │        │
│  │ 3. Relevant skill: css-dark-mode     │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  Cost: ~$0.001                                   │
└──────────────────────────────────────────────────┘
```

---

### Technology 3: Super Prompt Compilation

The app (not an LLM — this is deterministic code) assembles the final output:

1. Read full content of ONLY the selected files
2. Inject the checklist
3. Inject relevant skill content (full text of 1-3 skills)
4. Wrap everything in structured XML
5. Calculate token count and estimated cost

This is a **compiler step**, not an AI step. It's fast, free, and deterministic.

---

## 2. What about RAG?

RAG (Retrieval-Augmented Generation) is a specific technique. Budget Coder uses a **variant** of it, but the comparison is nuanced:

| Aspect | Traditional RAG | Budget Coder |
|---|---|---|
| **Index type** | Vector embeddings | Tree-sitter AST + directory structure |
| **Retrieval** | Cosine similarity on vectors | Cheap model semantic selection |
| **Infrastructure** | Needs embedding model + vector DB | Needs only Tree-sitter (local, free) |
| **Accuracy** | Good for text, weak for code structure | Better — understands code semantics |
| **External knowledge** | Not typical | ✅ Skills repos can be injected |

### Budget Coder is better described as:

> **Semantic Code Indexing + LLM-guided Retrieval + Knowledge Enrichment → Prompt Compilation**

Or more simply: **a Prompt Compiler.**

---

## 3. Where Skills Fit In

Skills repositories (like `obra/superpowers`) are **external knowledge sources** that enrich the Super Prompt with best practices the codebase itself doesn't contain.

### 2-Phase Skills Loading

```
Phase 1: Index scan (zero LLM cost)
─────────────────────────────────────
Read skills directory → extract file names + first-line descriptions
Output: skills index (~200-500 tokens)

Phase 2: Selective loading (near-zero cost)
─────────────────────────────────────
Cheap model picks 1-3 relevant skills based on task
Read full content of selected skills (~1K-3K tokens)
Inject into Super Prompt as <skills_context>
```

### What skills provide that code indexing cannot:

| Code Indexing tells you... | Skills tell you... |
|---|---|
| What functions exist | How to structure new ones |
| What the current architecture is | What patterns to follow |
| What files to modify | What conventions to respect |
| Current state | Best practices |

**Skills = "how-to knowledge" that complements "what-is knowledge" from code indexing.**

---

## 4. Complete Pipeline Diagram

```
USER INPUT                    LOCAL PROCESSING              CHEAP MODEL              COMPILATION
─────────                    ────────────────              ───────────              ───────────

"Add dark mode              ┌─────────────────┐
 to settings"               │ Directory Walk   │
        │                   │ (ignore crate)   │
        │                   └────────┬────────┘
        │                            │
        │                   ┌────────▼────────┐
        │                   │ Tree-sitter AST  │
        │                   │ Parse all files  │
        │                   └────────┬────────┘
        │                            │
        │                   ┌────────▼────────┐
        │                   │ Repo Map         │         ┌─────────────────┐
        │                   │ (~2-5K tokens)   │────────►│ Cheap Model     │
        │                   └─────────────────┘         │ (Flash-Lite)    │
        │                                               │                 │
        │                   ┌─────────────────┐         │ • Select files  │
        ├──────────────────►│ User Instruction │────────►│ • Make checklist│
        │                   └─────────────────┘         │ • Pick skills   │
        │                                               └────────┬────────┘
        │                   ┌─────────────────┐                  │
        │                   │ Skills Index     │                  │
        │                   │ (local, free)    │──────────────────┘
        │                   └─────────────────┘
        │                                               ┌─────────────────┐
        │                                               │ Selected files: │
        │                                               │ • Settings.tsx  │
        │                                               │ • App.tsx       │
        │                                               │ • store.ts      │
        │                                               │                 │
        │                                               │ Checklist:      │
        │                                               │ 1. Add state    │
        │                                               │ 2. Add toggle   │
        │                                               │ 3. Apply theme  │
        │                                               │ 4. Persist      │
        │                                               │                 │
        │                                               │ Skill: dark-mode│
        │                                               └────────┬────────┘
        │                                                        │
        │                                               ┌────────▼─────────────┐
        │                                               │ COMPILER (local)     │
        │                                               │ • Read selected files│
        │                                               │ • Read skill content │
        │                                               │ • Assemble XML       │
        │                                               │ • Count tokens       │
        │                                               │ • Estimate cost      │
        │                                               └────────┬─────────────┘
        │                                                        │
        │                                                        ▼
        │                                               ┌────────────────────┐
        │                                               │   SUPER PROMPT     │
        │                                               │   (XML, ~25K tok)  │
        │                                               │                    │
        │                                               │  → Copy to clip    │
        │                                               │  → Send to Opus    │
        │                                               └────────────────────┘
```

---

## 5. Technology Stack Summary

| Layer | Technology | Cost | Purpose |
|---|---|---|---|
| **File Discovery** | Rust `ignore` crate | $0 | Walk directory, respect .gitignore |
| **Code Parsing** | Tree-sitter | $0 | Extract AST, symbols, signatures |
| **Repo Map** | PageRank-style ranking (Aider method) | $0 | Compress project structure to ~2-5K tokens |
| **File Selection** | Cheap LLM (Flash-Lite) | ~$0.001 | Intelligently pick relevant files |
| **Checklist** | Cheap LLM (Flash-Lite) | ~$0.001 | Break task into actionable steps |
| **Skills Retrieval** | Local index + Cheap LLM | ~$0.0003 | Inject relevant best practices |
| **Compilation** | Deterministic code (Rust) | $0 | Assemble final XML Super Prompt |
| **Token Estimation** | `gpt-tokenizer` (JS) | $0 | Show cost before sending |

### Total cost of the entire pipeline: **~$0.002 per task**

Compare to: Opus exploring the same codebase directly = **$0.50 - $1.00+**

---

## 6. Key Differentiators vs. Existing Tools

| Feature | Aider | Repomix | Budget Coder |
|---|---|---|---|
| Repo Map (Tree-sitter) | ✅ | ❌ | ✅ |
| Cheap model file selection | ❌ (uses same model) | ❌ | ✅ |
| Skills/knowledge injection | ❌ | ❌ | ✅ |
| XML Super Prompt output | ❌ | ✅ (but dumb dump) | ✅ (smart, filtered) |
| Token cost estimation | ❌ | ✅ | ✅ |
| User file review before send | ❌ | ❌ | ✅ |
| Prompt Caching optimized | ❌ | ❌ | ✅ |
| GUI with Echobird integration | ❌ | ❌ | ✅ |
| Cheap→Expensive model split | ❌ | ❌ | ✅ |

> **Budget Coder = Aider's Repo Map + Repomix's packaging + Cheap model intelligence + Skills enrichment + Cost transparency**

