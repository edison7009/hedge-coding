# Budget Coder

**A Prompt Compiler for AI Coding Assistants**

> Let cheap models read your code, let expensive models write code.

Budget Coder scans your local codebase using Tree-sitter, generates a compact **Repo Map** (AST-based symbol index), and compiles a structured **Super Prompt** (XML) — ready to paste into expensive models like Claude Opus or GPT-4o.

## Why?

AI coding assistants spend **~70% of tokens** on codebase exploration — scanning directories, reading irrelevant files, accumulating context. This is wasteful when using expensive models ($5–25/M tokens).

Budget Coder moves the exploration phase to a **$0.10/M token** model (or your local LLM), then hands off a precision-compiled prompt to the expensive model.

**Result: 50–60% cost reduction per coding task.**

## Quick Start

```bash
# Install from source
cargo install --path .

# Scan a project and generate a Repo Map
budget-coder --dir ./my-project --map-only

# Generate a Super Prompt for a specific goal
budget-coder --dir ./my-project --goal "Add dark mode toggle" --output prompt.xml

# Filter to specific files/directories
budget-coder --dir ./my-project --goal "Fix auth bug" --include "src/auth,src/middleware"
```

## Features

- **Tree-sitter AST Parsing** — Extracts function names, classes, structs, interfaces, enums from JS/TS/Python/Rust (+ generic fallback for other languages)
- **Repo Map** — Compact project overview: file paths + symbol signatures (~2-5K tokens for a 10,000-file codebase)
- **Super Prompt Compiler** — Structured XML output optimized for Anthropic Prompt Caching
- **Token Counter** — Real-time token count + multi-model cost estimation (tiktoken)
- **Smart Filtering** — Respects `.gitignore`, skips binaries, enforces safety limits

## Super Prompt Output Format

```xml
<user_goal>
  Add a dark mode toggle to the settings page.
</user_goal>

<repo_map>
  src/App.tsx (120 lines)
    ├─ fn App
    ├─ const Router
  src/pages/Settings.tsx (85 lines)
    ├─ fn Settings
    ├─ fn ThemeToggle
</repo_map>

<project_context>
  <file path="src/App.tsx">
    ...full source code...
  </file>
  <file path="src/pages/Settings.tsx">
    ...full source code...
  </file>
</project_context>

<execution_instructions>
  Implement the requested changes...
</execution_instructions>
```

## CLI Options

```
Options:
  -d, --dir <DIR>           Project directory to scan [default: .]
  -g, --goal <GOAL>         Your coding goal / instruction
  -o, --output <FILE>       Output file for the Super Prompt
  -i, --include <PATTERNS>  Include specific files (comma-separated)
      --max-files <N>       Maximum files to include [default: 50]
      --map-only            Show only the Repo Map
      --scan-only           Show scan results only
  -h, --help                Print help
  -V, --version             Print version
```

## Cost Savings

| Scenario | Without Budget Coder | With Budget Coder | Savings |
|---|---|---|---|
| Medium task | $0.78 | $0.33 | **57%** |
| Large refactor | $1.95 | $0.94 | **52%** |
| Monthly (active dev) | $95+ | $58 | **39%** |
| + Prompt Caching | — | — | **70–85%** |

## Roadmap

- [x] Phase 1: Core Engine + CLI (Scanner, Parser, Repo Map, Compiler, Token Counter)
- [ ] Phase 2: Web UI (local browser interface with file selection)
- [ ] Phase 3: LLM Integration (cheap model auto-selects files + generates checklist)
- [ ] Phase 3: Skills Injection (load best-practice knowledge from skills repos)

## License

MIT
