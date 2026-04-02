import { listen } from '@tauri-apps/api/event';
import type { Event } from '@tauri-apps/api/event';

// Tauri v2 typed invoke wrapper

// Extend Window with Tauri globals to avoid TS2339
declare global {
  interface Window {
    __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
    __TAURI__?: {
      invoke?: (cmd: string, args?: unknown) => Promise<unknown>;
      core?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
    };
  }
}

const isTauri = typeof window !== 'undefined' &&
  (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);


// Resolve the invoke function across Tauri v1 / v2
function resolveInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
  const w = window as unknown as Record<string, unknown>;
  const internals = w.__TAURI_INTERNALS__ as Record<string, unknown> | undefined;
  if (internals && typeof internals.invoke === 'function') return internals.invoke as never;
  const tauri = w.__TAURI__ as Record<string, unknown> | undefined;
  if (tauri) {
    const core = tauri.core as Record<string, unknown> | undefined;
    if (core && typeof core.invoke === 'function') return core.invoke as never;
    if (typeof tauri.invoke === 'function') return tauri.invoke as never;
  }
  return null;
}

let _invoke = isTauri ? resolveInvoke() : null;

export function retryInvoke() {
  if (isTauri && !_invoke) _invoke = resolveInvoke();
  return _invoke;
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!_invoke) throw new Error('Tauri IPC not available');
  return _invoke(cmd, args) as Promise<T>;
}

export { isTauri };

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface Symbol {
  name: string;
  kind: string;
  line: number;
}

export interface FileEntry {
  relative_path: string;
  size: number;
  extension: string;
  symbols: Symbol[];
  line_count: number;
}

export interface ScanResult {
  root: string;
  files: FileEntry[];
  total_scanned: number;
  skipped: string[];
  // Legacy fallback property
  token_estimate?: number; 
}

export interface CostEstimate {
  model: string;
  input_cost_usd: number;
}

export interface TokenEstimate {
  tokens: number;
  costs: CostEstimate[];
}

export interface CompileResult {
  super_prompt: string;
  /** Absolute path to the saved .md prompt file */
  prompt_path: string;
  file_count: number;
  source_chars: number;
  estimate: TokenEstimate;
  /** Whether smart file selection was triggered */
  smart_selected: boolean;
  /** Total files before smart selection */
  total_files: number;
  /** Task classification: "SMALL", "MEDIUM", "LARGE", or "" */
  task_size: string;
  /** Refined goal from budget model */
  refined_goal: string;
  /** Deep Analysis coverage: "full", "partial", or "none" */
  deep_analysis_coverage: string;
  /** Number of files with Deep Analysis summaries */
  deep_analysis_files: number;
}

export interface ModelConfig {
  name: string;
  model_id: string;
  base_url: string;
  /** true when an API key is present in models.json */
  configured: boolean;
}

export interface GitStatusResponse {
  files_changed: number;
  insertions: number;
  deletions: number;
}

export interface AnalysisProgress {
  file: string;
  summary: string;
  index: number;
  total: number;
  error: string | null;
  /** Tokens used for this file (0 on __ANALYZING__ event) */
  input_tokens: number;
  output_tokens: number;
}

// ─── Code Review Types ───────────────────────────────────────────────────────

export interface ReviewFinding {
  file: string;
  line: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
  exploit_scenario?: string;
  recommendation: string;
  confidence: number;
}

export interface ReviewAdversarialCheck {
  check: string;
  result: 'PASS' | 'FAIL' | 'PARTIAL';
  notes?: string;
}

export interface ReviewAnalysisSummary {
  files_reviewed: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  review_completed: boolean;
}

export interface ReviewFindingsResult {
  verdict: 'PASS' | 'FAIL' | 'PARTIAL';
  findings: ReviewFinding[];
  adversarial_checks?: ReviewAdversarialCheck[];
  analysis_summary: ReviewAnalysisSummary;
}

export interface ReviewCompileResult {
  super_prompt: string;
  files_in_diff: number;
  diff_chars: number;
  estimate: TokenEstimate;
}

// ─── Skills Types ────────────────────────────────────────────────────────────

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  auto_inject: boolean;
  char_count: number;
  when_to_use?: string;
}

// ─── Grep Types ───────────────────────────────────────────────────────────────

export interface GrepMatch {
  relative_path: string;
  line_number: number;
  line_content: string;
}

// ─── Super Docs Types ────────────────────────────────────────────────────────

export type DocFormat = 'docusaurus' | 'vitepress' | 'gitbook' | 'mkdocs' | 'markdown' | string;

export interface DocsCompileResult {
  super_prompt: string;
  file_count: number;
  source_chars: number;
  format_label: string;
  estimate: TokenEstimate;
}

/// Raw snake_case shape returned by the Rust `load_prompt_history` command.
/// Mapped to camelCase PromptHistoryItem in App.tsx before entering the store.
export interface PromptHistoryRaw {
  id?: string;
  prompt_path?: string;
  full_content?: string;
  goal_snippet?: string;
  instructions_snippet?: string;
  task_size?: string;
  da_coverage?: string;
  da_files?: number;
  char_count?: number;
  token_est?: number;
  timestamp?: number;
}

// ─── Typed Commands ──────────────────────────────────────────────────────────

export const commands = {
  pickFolder: () => invoke<string>('pick_folder'),
  // invoke('scan_project' ...) matches #[tauri::command] fn scan_project(path: Option<String>) in server.rs
  scanFolder: (path: string) =>
    invoke<ScanResult>('scan_project', { path }),

  // invoke('compile_prompt' ...) — Standard Super Prompt compilation
  compilePrompt: (
    goal: string,
    selectedFiles: string[],
    skillsIds?: string[],
    claudeMd?: string,
  ) =>
    invoke<CompileResult>('compile_prompt', {
      goal,
      selectedFiles,
      checklist: null,
      skillsIds: skillsIds || null,
      claudeMd: claudeMd || null,
    }),

  loadPromptHistory: (dir: string) =>
    invoke<PromptHistoryRaw[]>('load_prompt_history', { dir }),
  // invoke('get_model' ...) matches fn get_model()
  loadModel: () => invoke<ModelConfig>('get_model'),

  // invoke('deep_analyze' ...) matches fn deep_analyze()
  startDeepAnalysis: (files: string[]) =>
    invoke<void>('deep_analyze', { files }),

  cancelDeepAnalysis: () =>
    invoke<void>('cancel_deep_analysis'),

  listenAnalysisProgress: (callback: (payload: AnalysisProgress) => void) =>
    listen('analysis-progress', (event: Event<AnalysisProgress>) => callback(event.payload)),

  // invoke('load_analysis_cache' ...)
  loadCachedAnalysis: () =>
    invoke<Record<string, string>>('load_analysis_cache'),

  // invoke('save_analysis_cache' ...)
  saveAnalysisCache: (cacheJson: string) =>
    invoke<void>('save_analysis_cache', { cacheJson }),

  // invoke('check_model_config' ...)
  checkModelConfig: () =>
    invoke<string>('check_model_config'),

  // Window decorators
  windowMinimize: () => invoke<void>('window_minimize'),
  windowMaximize: () => invoke<void>('window_maximize'),
  windowClose: () => invoke<void>('window_close'),


  // ─── CLAUDE.md Project Memory ─────────────────────────────────────────────
  loadClaudeMd: () =>
    invoke<string | null>('load_claude_md'),

  saveClaudeMd: (content: string) =>
    invoke<void>('save_claude_md', { content }),

  // ─── Grep Search ──────────────────────────────────────────────────────────
  grepProject: (pattern: string) =>
    invoke<GrepMatch[]>('grep_project', { pattern }),

  // ─── Code Review Commands ─────────────────────────────────────────────────
  compileReview: (diffText: string) =>
    invoke<ReviewCompileResult>('compile_review', { diffText }),

  loadReviewRules: () =>
    invoke<string | null>('load_review_rules'),

  saveReviewRules: (content: string) =>
    invoke<void>('save_review_rules', { content }),

  // ─── Skills Commands ──────────────────────────────────────────────────────
  listSkills: () =>
    invoke<SkillMeta[]>('list_skills'),

  openSkillsDir: () =>
    invoke<void>('open_skills_dir'),

  loadSkill: (skillId: string) =>
    invoke<string>('load_skill', { skillId }),

  saveSkill: (skillId: string, content: string) =>
    invoke<void>('save_skill', { skillId, content }),

  createExampleSkill: () =>
    invoke<SkillMeta[]>('create_example_skill'),

  // ─── Super Docs ────────────────────────────────────────────────────────────
  compileDocs: (goal: string, selectedFiles: string[], format: DocFormat) =>
    invoke<DocsCompileResult>('compile_docs', { goal, selectedFiles, format }),

  // ─── Git Status ─────────────────────────────────────────────────────────────
  getGitStatus: () =>
    invoke<GitStatusResponse | null>('get_git_status'),
};
