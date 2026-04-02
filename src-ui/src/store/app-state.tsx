// Hedge Coding — Global App State (React Context)

import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { ScanResult, ModelConfig, ReviewFinding, GrepMatch } from '../tauri';

// ─── State Shape ─────────────────────────────────────────────────────────────

export interface PromptHistoryItem {
  id: string;
  promptPath: string;
  fullContent: string;
  goalSnippet: string;
  instructionsSnippet: string;
  meta: {
    taskSize: string;
    daCoverage: string;
    daFiles: number;
    charCount: number;
    tokenEst: number;
  };
  timestamp: number;
}

export interface AppState {
  // Folder
  folderPath: string | null;
  scanData: ScanResult | null;
  aiSummaries: Record<string, string>;
  deepAnalysisRunning: boolean;
  analyzingFile: string | null;

  // UI
  currentTheme: 'dark' | 'light';
  currentLang: 'en' | 'zh-CN';
  activeTab: 'hedge' | 'repomap' | 'skills' | 'costintel' | 'superprompt' | 'codereview' | 'docgen';

  // Compiler
  superPromptHistory: PromptHistoryItem[];
  modelConfig: ModelConfig | null;
  compilingPrompt: boolean; // true while compile_prompt IPC is in flight

  // Pricing
  pricingModels: ModelPrice[];

  // Code Review
  reviewFindings: ReviewFinding[];
  reviewSuperPrompt: string;
  reviewRules: string;

  // Skills injection context (built by Skills tab, read by Compiler)
  skillsContext: string[];

  // Project memory (MEMORY.md) — auto-injected into every Super Prompt
  claudeMd: string;


  // RepoMap grep search results
  grepResults: GrepMatch[];
  grepQuery: string;

  // Runtime Cost Tracker (Deep Analyze)
  analysisCost: {
    inputTokens: number;
    outputTokens: number;
    filesAnalyzed: number;
    sessionStart: number | null; // timestamp ms
  };
}

export interface ModelPrice {
  id: string;
  name: string;
  provider: string;
  input: number;   // $ per 1M tokens
  output: number;  // $ per 1M tokens
  context: number;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_FOLDER'; path: string }
  | { type: 'CLEAR_FOLDER' }
  | { type: 'SET_SCAN'; data: ScanResult }
  | { type: 'SET_AI_SUMMARY'; path: string; summary: string }
  | { type: 'SET_AI_SUMMARIES'; summaries: Record<string, string> }
  | { type: 'SET_DEEP_ANALYSIS_RUNNING'; running: boolean }
  | { type: 'SET_ANALYZING_FILE'; path: string | null }
  | { type: 'SET_THEME'; theme: 'dark' | 'light' }
  | { type: 'SET_LANG'; lang: 'en' | 'zh-CN' }
  | { type: 'SET_TAB'; tab: AppState['activeTab'] }
  | { type: 'SET_MODEL'; model: ModelConfig }
  | { type: 'SET_PRICING'; models: ModelPrice[] }
  // Code Review
  | { type: 'SET_REVIEW_FINDINGS'; findings: ReviewFinding[] }
  | { type: 'SET_REVIEW_SUPER_PROMPT'; content: string }
  | { type: 'SET_REVIEW_RULES'; rules: string }
  // Skills
  | { type: 'SET_SKILLS_CONTEXT'; context: string[] }
  // Project Memory
  | { type: 'SET_CLAUDE_MD'; content: string }
  | { type: 'ADD_SUPER_PROMPT'; item: PromptHistoryItem }
  | { type: 'SET_SUPER_PROMPT_HISTORY'; history: PromptHistoryItem[] }

  | { type: 'SET_COMPILING_PROMPT'; value: boolean }
  // Grep
  | { type: 'SET_GREP_RESULTS'; results: GrepMatch[]; query: string }
  // Cost Tracker
  | { type: 'ACCUMULATE_ANALYSIS_TOKENS'; input: number; output: number }
  | { type: 'RESET_ANALYSIS_COST' };

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_FOLDER':
      return { ...state, folderPath: action.path };
    case 'CLEAR_FOLDER':
      return { ...state, folderPath: null, scanData: null, aiSummaries: {}, deepAnalysisRunning: false, analyzingFile: null, analysisCost: { inputTokens: 0, outputTokens: 0, filesAnalyzed: 0, sessionStart: null }, superPromptHistory: [] };
    case 'SET_SCAN':
      return { ...state, scanData: action.data };
    case 'SET_AI_SUMMARY':
      return { ...state, aiSummaries: { ...state.aiSummaries, [action.path]: action.summary } };
    case 'SET_AI_SUMMARIES':
      return { ...state, aiSummaries: action.summaries };
    case 'SET_DEEP_ANALYSIS_RUNNING':
      return { ...state, deepAnalysisRunning: action.running };
    case 'SET_ANALYZING_FILE':
      return { ...state, analyzingFile: action.path };
    case 'SET_THEME':
      return { ...state, currentTheme: action.theme };
    case 'SET_LANG':
      return { ...state, currentLang: action.lang };
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_COMPILING_PROMPT':
      return { ...state, compilingPrompt: action.value };
    case 'ADD_SUPER_PROMPT':
      return { ...state, superPromptHistory: [...state.superPromptHistory, action.item] };
    case 'SET_SUPER_PROMPT_HISTORY':
      return { ...state, superPromptHistory: action.history };
    case 'SET_MODEL':
      return { ...state, modelConfig: action.model };
    case 'SET_PRICING':
      return { ...state, pricingModels: action.models };
    case 'SET_REVIEW_FINDINGS':
      return { ...state, reviewFindings: action.findings };
    case 'SET_REVIEW_SUPER_PROMPT':
      return { ...state, reviewSuperPrompt: action.content };
    case 'SET_REVIEW_RULES':
      return { ...state, reviewRules: action.rules };
    case 'SET_SKILLS_CONTEXT':
      return { ...state, skillsContext: action.context };
    case 'SET_CLAUDE_MD':
      return { ...state, claudeMd: action.content };

    case 'SET_GREP_RESULTS':
      return { ...state, grepResults: action.results, grepQuery: action.query };
    case 'ACCUMULATE_ANALYSIS_TOKENS':
      return {
        ...state,
        analysisCost: {
          inputTokens: state.analysisCost.inputTokens + action.input,
          outputTokens: state.analysisCost.outputTokens + action.output,
          filesAnalyzed: state.analysisCost.filesAnalyzed + 1,
          sessionStart: state.analysisCost.sessionStart ?? Date.now(),
        },
      };
    case 'RESET_ANALYSIS_COST':
      return {
        ...state,
        analysisCost: { inputTokens: 0, outputTokens: 0, filesAnalyzed: 0, sessionStart: null },
      };
    default:
      return state;
  }
}

// ─── Initial State ────────────────────────────────────────────────────────────

function getInitialState(): AppState {
  let theme: 'dark' | 'light' = 'dark';
  let lang: 'en' | 'zh-CN' = 'en';      // Default: English (primary language)
  let folderPath: string | null = null;

  try {
    const savedTheme = localStorage.getItem('hc-theme') as 'dark' | 'light' | null;
    if (savedTheme) theme = savedTheme;
  } catch {}

  try { folderPath = localStorage.getItem('hc-folder'); } catch {}
  // Respect saved preference; if never set, keep zh-CN as default
  try {
    const savedLang = localStorage.getItem('hc-lang') as 'en' | 'zh-CN' | null;
    if (savedLang) lang = savedLang;
  } catch {}


  return {
    folderPath,
    scanData: null,
    aiSummaries: {},
    deepAnalysisRunning: false,
    analyzingFile: null,
    currentTheme: theme,
    currentLang: lang,
    activeTab: 'hedge',
    superPromptHistory: [],
    modelConfig: null,
    compilingPrompt: false,
    pricingModels: [],
    reviewFindings: [],
    reviewSuperPrompt: '',
    reviewRules: '',
    skillsContext: [],
    claudeMd: '',

    grepResults: [],
    grepQuery: '',
    analysisCost: { inputTokens: 0, outputTokens: 0, filesAnalyzed: 0, sessionStart: null },
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be inside AppProvider');
  return ctx;
}
