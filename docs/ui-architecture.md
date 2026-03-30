# Budget Coder — UI & Distribution Architecture Decision

---

## 1. Distribution: `npx` One-Command Install

No installer. No setup.exe. No Tauri MSI. Just:

```bash
# Use directly without installing
npx budget-coder

# Or install globally
npm install -g budget-coder

# Then run
budget-coder --dir ./my-project --goal "add dark mode"
```

### Why npm/npx?

| Factor | npm/npx | Tauri (original spec) | Python pip |
|---|---|---|---|
| Install complexity | `npx budget-coder` ✅ | Download .msi/.dmg ❌ | `pip install` ✅ |
| No installer needed | ✅ | ❌ Needs installer | ✅ |
| Cross-platform | ✅ Win/Mac/Linux | ✅ but needs builds | ✅ |
| GitHub-friendly | ✅ npm publish | ❌ needs release artifacts | ✅ |
| Tree-sitter support | ✅ npm `tree-sitter` | ✅ Rust native | ⚠️ Python bindings exist but weaker |
| Web UI capability | ✅ natural | ✅ WebView | ⚠️ needs Flask/FastAPI |
| Target audience (devs) | ✅ all devs have Node | ⚠️ some don't install Rust | ✅ most have Python |
| Bundle size | ~15MB | ~50MB+ | ~20MB |

> **Decision: TypeScript/Node.js + npm distribution.** Every developer already has Node.js. `npx` means zero-install usage.

---

## 2. UI Architecture: CLI + Local Web UI (Hybrid)

**NOT a separate frontend app.** Everything ships as one npm package.

### How it works

```
User runs: npx budget-coder

    ┌──────────────────────────────────────┐
    │  CLI process starts                  │
    │                                      │
    │  1. Parse args (commander)           │
    │  2. Scan project (tree-sitter)       │
    │  3. Start local Express server       │
    │  4. Auto-open browser                │
    │     → http://localhost:3141          │
    └──────────────┬───────────────────────┘
                   │
    ┌──────────────▼───────────────────────┐
    │  Browser Tab (Web UI)                │
    │                                      │
    │  ┌─────────────────────────────────┐ │
    │  │  Project: ./my-project          │ │
    │  │  Goal: [Add dark mode_______]   │ │
    │  │  Model: Gemini Flash-Lite ▼     │ │
    │  │                                 │ │
    │  │  ┌── Repo Map ───────────────┐  │ │
    │  │  │ src/App.tsx              │  │ │
    │  │  │   ├─ function App()      │  │ │
    │  │  │ src/Settings.tsx         │  │ │
    │  │  │   ├─ function Settings() │  │ │
    │  │  │ src/store.ts             │  │ │
    │  │  │   ├─ useSettingsStore    │  │ │
    │  │  └──────────────────────────┘  │ │
    │  │                                 │ │
    │  │  Selected files:                │ │
    │  │  ☑ Settings.tsx                 │ │
    │  │  ☑ App.tsx                      │ │
    │  │  ☑ store.ts                     │ │
    │  │  ☐ index.html (irrelevant)      │ │
    │  │                                 │ │
    │  │  Token count: 25,340            │ │
    │  │  Est. Opus cost: $0.33          │ │
    │  │                                 │ │
    │  │  [📋 Copy Super Prompt]         │ │
    │  │  [🚀 Send to Echobird]          │ │
    │  └─────────────────────────────────┘ │
    └──────────────────────────────────────┘
```

### Also supports pure CLI mode (no browser)

```bash
# GUI mode (default)
budget-coder --dir ./my-project

# Pure CLI mode (for scripts, CI, SSH)
budget-coder --dir ./my-project --goal "add dark mode" --output prompt.xml --no-ui
```

---

## 3. Why NOT Separate Frontend?

| Approach | Pros | Cons |
|---|---|---|
| **Monorepo (recommended)** | Single `npm install`, one repo, easy to maintain | UI is simpler |
| Separate frontend repo | Can use React/Next.js | Over-engineered, 2 repos to maintain, harder install |
| Electron app | Rich native UI | Heavy (~100MB), needs installer |
| Tauri app | Fast, small binary | Needs Rust toolchain, needs installer |
| VS Code extension | IDE integration | Locks to VS Code users |

> **Decision: Single npm package, monorepo structure.** The Web UI is pre-built and bundled as static files inside the npm package. No separate `npm install` for frontend.

---

## 4. Language: TypeScript (Full Stack)

```
budget-coder/
├── package.json
├── tsconfig.json
├── bin/
│   └── cli.ts                  # Entry point: `budget-coder` command
├── src/
│   ├── core/
│   │   ├── scanner.ts          # Directory walker (uses 'ignore' or 'globby')
│   │   ├── parser.ts           # Tree-sitter AST parser
│   │   ├── repo-map.ts         # Repo Map generator (Aider-style)
│   │   ├── file-selector.ts    # Cheap model file selection logic
│   │   ├── checklist.ts        # Cheap model checklist generation
│   │   ├── skills-loader.ts    # Skills index + selective loading
│   │   ├── compiler.ts         # Super Prompt XML assembler
│   │   └── token-counter.ts    # Token estimation (gpt-tokenizer)
│   ├── llm/
│   │   ├── provider.ts         # LLM provider abstraction
│   │   ├── gemini.ts           # Gemini Flash / Flash-Lite client
│   │   ├── openai.ts           # OpenAI-compatible API client
│   │   └── anthropic.ts        # Anthropic API client (for future)
│   ├── server/
│   │   ├── app.ts              # Express server for Web UI
│   │   ├── api.ts              # REST API routes (scan, compile, etc.)
│   │   └── websocket.ts        # WebSocket for real-time progress
│   └── config/
│       ├── models.ts           # Model configuration (reads models.json)
│       └── defaults.ts         # Default settings
├── ui/                         # Web UI (built with Vite, bundled into dist/)
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx             # React app
│   │   ├── components/
│   │   │   ├── FileTree.tsx    # Interactive file tree with checkboxes
│   │   │   ├── RepoMap.tsx     # Repo Map visualization
│   │   │   ├── GoalInput.tsx   # User instruction input
│   │   │   ├── ModelPicker.tsx # Model selector dropdown
│   │   │   ├── CostEstimate.tsx # Token count + cost display
│   │   │   ├── SuperPrompt.tsx # Read-only output preview
│   │   │   └── SkillsPicker.tsx # Skills selection UI
│   │   └── styles/
│   │       └── index.css       # Dark theme, premium design
│   ├── vite.config.ts
│   └── dist/                   # Pre-built, committed or built on install
├── skills/                     # Default bundled skills (optional)
│   └── README.md
└── test/
    ├── scanner.test.ts
    ├── parser.test.ts
    └── compiler.test.ts
```

### Why TypeScript for everything?

| Reason | Detail |
|---|---|
| **One language** | Backend CLI + Web UI both TypeScript — no context switching |
| **tree-sitter npm** | Official Node.js bindings exist (`npm install tree-sitter`) |
| **npm distribution** | Native to the ecosystem |
| **Web UI** | React/Vite compiles to static files, served by Express |
| **Developer audience** | Target users are devs who already use npm daily |
| **Community contribution** | TypeScript has wider contributor base than Rust |
| **Speed** | Tree-sitter parsing is native C++ under the hood, speed is fine |

---

## 5. Build & Publish Flow

```bash
# Development
npm run dev          # Starts server + Vite HMR for UI development

# Build
npm run build        # 1. Vite builds UI → ui/dist/
                     # 2. tsc compiles TS → dist/
                     # 3. Bundle ready

# Publish
npm publish          # Pushes to npm registry

# Users run
npx budget-coder     # Downloads + runs instantly
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/publish.yml
name: Publish to npm
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 6. Key Dependencies

| Package | Purpose | Size Impact |
|---|---|---|
| `tree-sitter` | AST parsing (native C++ bindings) | ~5MB |
| `tree-sitter-javascript` | JS/TS grammar | ~1MB |
| `tree-sitter-python` | Python grammar | ~1MB |
| `tree-sitter-rust` | Rust grammar (add more as needed) | ~1MB |
| `commander` | CLI argument parsing | tiny |
| `express` | Local web server | ~500KB |
| `open` | Cross-platform browser opening | tiny |
| `gpt-tokenizer` | Token count estimation | ~2MB |
| `globby` | File pattern matching (.gitignore aware) | tiny |
| `ws` | WebSocket for real-time UI updates | tiny |

**Total npm package size estimate: ~15MB** (vs Tauri ~50MB+, Electron ~100MB+)

---

## 7. Decision Summary

| Question | Answer |
|---|---|
| Distribution? | `npm` / `npx` — no installer |
| Language? | **TypeScript** — full stack |
| Frontend separate? | **No** — monorepo, UI bundled inside npm package |
| UI technology? | **React + Vite** → pre-built static files → served by Express |
| UI access? | Browser opens `localhost:3141` automatically |
| Also works without UI? | **Yes** — `--no-ui` flag for pure CLI mode |
| GitHub repo structure? | Single repo, single `package.json` |
| Target command? | `npx budget-coder` or `npm i -g budget-coder` |

