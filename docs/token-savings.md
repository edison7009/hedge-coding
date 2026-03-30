# Saving Tokens When Working with AI Coding Assistants

A practical guide for developers using AI assistants (Claude Opus / Antigravity) on long-lived projects.

---

## Why Tokens Are Expensive

The biggest cost is **not** the AI "thinking" — it's the **context window**:

- Every message pays for the **entire conversation history** again (input tokens)
- The longer a session runs, the more expensive each subsequent message becomes
- File reads, tool outputs, and search results all accumulate in the context

---

## Rule 1: Keep Sessions Short and Focused

**Don't**: Start a session and keep adding unrelated tasks throughout the day.

**Do**: One session = one clearly scoped goal.

| Session type | Token efficiency |
|---|---|
| "Fix the role picker bug" (30 min, ~10 turns) | ✅ Efficient |
| "Fix the bug, then update Mother Agent, then refactor Channels, then release" (3 hours) | ❌ Very expensive — context grows huge |

> Today's session covered: parallel scan, skeletons, path fix, Mother Agent prompt, role picker UI, release, and translation planning. Each task paid for all the previous ones in its context. Splitting this into 3-4 sessions could have saved ~40–60% of input tokens.

---

## Rule 2: Delegate Batch / Repetitive Tasks to Cheaper Models

Tasks that do **not** need full project context can be done by a cheaper model:

| Task | Need full context? | Best model |
|---|---|---|
| Translating roles-en.json to Japanese | ❌ No | Gemini Flash / Claude Haiku |
| Writing boilerplate code from a spec | ❌ No | GPT-4o-mini |
| Debugging a specific Rust error | ✅ Yes | Stay with this assistant |
| Architecture decisions | ✅ Yes | Stay with this assistant |
| Reviewing a specific diff for correctness | ⚠️ Partial | Cheaper model + spot-check |

**Roles translation example**: 7 languages × ~21K tokens = ~$0.05 with Gemini Flash vs ~$13 with Opus-level. Feed it `TRANSLATE_TASK.md` + `roles-en.json` and let it run.

---

## Rule 3: Give Precise, Targeted Instructions

**Don't**: "Look around the codebase and figure out the channels page"

**Do**: "The role selector is in `src/pages/Channels/ChannelsComponents.tsx` at line 87. Move it to the input bar in `Channels.tsx` around line 1130."

Every investigation round (search → read → re-read) costs tokens. If you already know where the code is, say so upfront.

---

## Rule 4: Avoid Re-Reading Files Unnecessarily

If you've already told the assistant what a file contains, don't ask it to re-read it. Reference it directly:

**Expensive**: "Go look at what's in Channels.tsx and figure out the input area structure."  
**Cheap**: "In Channels.tsx, the input area starts at line 1111. The bottom row is at line 1130."

---

## Rule 5: Use the KI (Knowledge Base) System

The Knowledge Base stores distilled, reusable information from past sessions. Checking KIs at the start of a session means the assistant doesn't need to re-investigate familiar areas.

- After a complex session, **ask the assistant to update KIs** with key findings
- Future sessions start with this context already available at low cost

---

## Rule 6: For Translation / Generation Tasks → New Clean Session

Start a brand-new session with **only** what the task needs:

```
Session for translation:
1. Feed: TRANSLATE_TASK.md
2. Feed: roles-en.json
3. Instruction: "Translate to Japanese following the rules in TRANSLATE_TASK.md"
4. Save output directly to roles-ja.json
```

Cost: ~$0.05–0.10 per language, no project context needed.

---

## Rule 7: Avoid "Investigate Everything First" Patterns

Some tasks can be done in 2 steps; avoid turning them into 10:

**Expensive pattern**:
> "Check if the file exists → read it → check imports → read another file → check where component is used → read App.tsx → read index.ts → now make the change"

**Efficient pattern**:
> Know the codebase well enough to give the assistant a direct target, or use `grep_search` with precise queries rather than broad exploration.

---

## Rule 8: Use "Prompt Compilers" (Cheap Coder) for Global Context

When starting a massive new feature that requires touching many files, do **not** let an expensive model "explore" the project file by file. Exploring a codebase consumes tokens very quickly.

**Efficient pattern**: 
Use a local tool (like the planned **Cheap Coder App**) powered by a low-cost model (e.g., Gemini Flash). Point it at your local directory. The cheap model will scan the directory tree, extract a lightweight "Repo Map", select only the relevant files, and format them into a single, highly-structured `XML` prompt. 

You simply paste this **pre-compiled context** into a new, clean session with an expensive model like Opus.

---

## Summary: Cost vs. Value Matrix

| Action | Cost | When worth it |
|---|---|---|
| New focused session | Low | Always prefer for distinct tasks |
| Delegating to cheap model | Very low | Batch work, translation, boilerplate |
| Keeping session context short | Free | Every time |
| Giving precise file locations | Free | When you know them |
| Long explorative sessions | High | Only for genuine unknowns |
| Asking to re-investigate known areas | High | Rarely justified |
