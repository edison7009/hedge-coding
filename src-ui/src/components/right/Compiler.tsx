// Compiler.tsx — Right panel: budget model, token estimate, compile

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../store/app-state';
import type { ModelPrice } from '../../store/app-state';
import { useT } from '../../i18n/useT';
import { commands } from '../../tauri';
import type { GitStatusResponse } from '../../tauri';
import './Compiler.css';

interface AttachedImage {
  id: string;
  dataUrl: string; // base64 data URL
  name: string;
}

// ── Premium Benchmark Models ──────────────────────────────────────────────────
// Hardcoded: these 7 are the gold-standard expensive models that Hedge Coding
// saves you from burning tokens on. Prices in USD per 1M tokens (OpenRouter /
// official API rates as of 2026-Q1).
const PREMIUM_BENCHMARKS: ModelPrice[] = [
  { id: 'anthropic/claude-opus-4-thinking',   name: 'Claude Opus 4.6 (Thinking)',   provider: 'Anthropic', input:  5.00, output: 25.00, context: 1_000_000 },
  { id: 'anthropic/claude-sonnet-4-thinking', name: 'Claude Sonnet 4.6 (Thinking)', provider: 'Anthropic', input:  3.00, output: 15.00, context: 1_000_000 },
  { id: 'anthropic/claude-opus-4',            name: 'Claude Opus 4.6',              provider: 'Anthropic', input:  5.00, output: 25.00, context: 1_000_000 },
  { id: 'anthropic/claude-sonnet-4',          name: 'Claude Sonnet 4.6',            provider: 'Anthropic', input:  3.00, output: 15.00, context: 1_000_000 },
  { id: 'google/gemini-3-1-pro-high',         name: 'Gemini 3.1 Pro (high)',        provider: 'Google',    input:  4.00, output: 18.00, context: 2_000_000 },
  { id: 'openai/gpt-5-4',                     name: 'GPT-5.4',                      provider: 'OpenAI',    input:  2.50, output: 15.00, context: 1_050_000 },
  { id: 'openai/gpt-oss-120b',                name: 'GPT-oss 120B',                 provider: 'OpenAI',    input:  2.00, output:  8.00, context:   128_000 },
];

export function Compiler() {
  const { state, dispatch } = useAppState();
  const t = useT();
  const [goal, setGoal] = useState('');
  const [expandedPrices, setExpandedPrices] = useState(false);

  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState('');
  const [screenshots, setScreenshots] = useState<AttachedImage[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Read image file => base64 dataURL
  const readImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addImages = useCallback((dataUrls: string[]) => {
    if (!dataUrls.length) return;
    const newImages = dataUrls.map((url) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dataUrl: url,
      name: 'screenshot.png',
    }));
    setScreenshots(prev => [...prev, ...newImages].slice(0, 6));
  }, []);

  // Paste listener — supports Ctrl+V image paste from any screenshot tool
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter(it => it.type.startsWith('image/'));
      if (!imageItems.length) return;
      const files = imageItems.map(it => it.getAsFile()).filter(Boolean) as File[];
      const urls = await Promise.all(files.map(readImageFile));
      addImages(urls);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addImages]);

  // Fetch git status on mount and when scanData changes
  useEffect(() => {
    if (!state.scanData) return;
    commands.getGitStatus()
      .then(status => setGitStatus(status))
      .catch(() => setGitStatus(null));
  }, [state.scanData]);

  // Sync textarea height when goal changes externally
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [goal]);

  const removeImage = (id: string) =>
    setScreenshots(prev => prev.filter(img => img.id !== id));

  const canCompile = !!state.scanData && state.scanData.files.length > 0;



  // Build screenshot XML block to append to goal
  const buildScreenshotBlock = () => {
    if (!screenshots.length) return '';
    const items = screenshots
      .map((img, i) =>
        `  <image index="${i + 1}" name="${img.name}">
    ${img.dataUrl}
  </image>`
      )
      .join('\n');
    return `\n\n<screenshots>\n${items}\n</screenshots>\n<instruction>Analyze the screenshots above to understand the visual context, UI layout, or errors shown. Use this information to inform your implementation.</instruction>`;
  };

  const compile = async () => {
    if ((!goal.trim() && !screenshots.length) || !state.scanData) return;
    const effectiveGoal = goal.trim() + buildScreenshotBlock();
    const allFiles = state.scanData.files.map(f => f.relative_path);

    // Immediately: switch to SuperPrompt tab + mark as compiling
    // This prevents UI freeze perception — tab switches instantly
    dispatch({ type: 'SET_TAB', tab: 'superprompt' });
    dispatch({ type: 'SET_COMPILING_PROMPT', value: true });
    setCompiling(true);
    setCompileError('');
    setGoal('');

    try {
      // Refresh git status before compile
      commands.getGitStatus()
        .then(status => setGitStatus(status))
        .catch(() => {});

      const result = await commands.compilePrompt(
        effectiveGoal,
        allFiles,
        state.skillsContext.length > 0 ? state.skillsContext : undefined,
        state.claudeMd || undefined,
      );
      const fullContent = result.super_prompt;
      const goalMatch = fullContent.match(/<user_goal>\s*([\s\S]*?)\s*<\/user_goal>/);
      const instMatch = fullContent.match(/<execution_instructions>\s*([\s\S]*?)\s*<\/execution_instructions>/);
      
      const charCount = fullContent.length;
      const tokenEst = Math.ceil(charCount / 4);

      dispatch({ 
        type: 'ADD_SUPER_PROMPT', 
        item: {
          id: Date.now().toString(),
          promptPath: result.prompt_path,
          fullContent,
          goalSnippet: goalMatch ? goalMatch[1].trim() : (result.refined_goal || effectiveGoal),
          instructionsSnippet: instMatch ? instMatch[1].trim() : '',
          meta: {
            taskSize: result.task_size,
            daCoverage: result.deep_analysis_coverage,
            daFiles: result.deep_analysis_files,
            charCount,
            tokenEst
          },
          timestamp: Date.now()
        }
      });
    } catch (e) {
      console.error('[HC] compile failed:', e);
      setCompileError(String(e));
    } finally {
      setCompiling(false);
      dispatch({ type: 'SET_COMPILING_PROMPT', value: false });
    }
  };

  // Auto-detect model icon
  const getModelIcon = (modelName: string | undefined) => {
    if (!modelName) return 'claude.svg';
    const n = modelName.toLowerCase();
    if (n.includes('openai') || n.includes('gpt')) return 'chatgpt.svg';
    if (n.includes('anthropic') || n.includes('claude')) return 'claude.svg';
    if (n.includes('google') || n.includes('gemini')) return 'gemini.svg';
    if (n.includes('meta') || n.includes('llama')) return 'llama.svg';
    if (n.includes('mistral')) return 'mistral.svg';
    if (n.includes('cohere')) return 'cohere.svg';
    if (n.includes('deepseek')) return 'deepseek.svg';
    if (n.includes('alibaba') || n.includes('qwen')) return 'qwen.svg';
    if (n.includes('zhipu') || n.includes('glm')) return 'glm.svg';
    if (n.includes('x-ai') || n.includes('grok')) return 'grok.svg';
    if (n.includes('bytedance') || n.includes('doubao')) return 'bytedance.svg';
    
    const available = ['chatgpt', 'claude', 'cohere', 'deepseek', 'ernie', 'gemini', 'gemma', 'glm', 'grok', 'groq', 'hunyuan', 'internlm', 'kimi', 'llama', 'minimax', 'mistral', 'nemotron', 'perplexity', 'phi', 'qwen', 'stepfun', 'together', 'xiaomi', 'yi'];
    const matched = available.find(ic => n.includes(ic));
    if (matched) return `${matched}.svg`;
    
    return null; // triggers fallback
  };

  const iconFile = getModelIcon(state.modelConfig?.name);
  const brandInitial = state.modelConfig?.name ? state.modelConfig.name.charAt(0).toUpperCase() : '?';

  // Extract IP/hostname from api_url
  const getEndpoint = (url: string | undefined): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.host; // e.g. "localhost:11434" or "api.minimax.io"
    } catch {
      return url.split('/')[0] || null;
    }
  };
  const endpoint = getEndpoint(state.modelConfig?.base_url);

  // Count injected skills
  const skillsCount = state.skillsContext ? state.skillsContext.length : 0;

  return (
    <div className="compiler-top">
      {/* 1. Budget Model — only render when a model is actually configured */}
      {state.modelConfig?.configured && (
        <div className="model-card new-model-card">
          <div className="model-icon-bare">
            {iconFile ? (
              <img
                src={`/models/${iconFile}`}
                alt="model-icon"
                className="model-icon-big"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = 'none';
                  if (t.parentElement) t.parentElement.innerText = brandInitial;
                }}
              />
            ) : (
              <span className="model-icon-fallback">{brandInitial}</span>
            )}
          </div>
          <div className="model-info">
            <div className="model-head">
              <span id="model-name">{state.modelConfig.name}</span>
            </div>
            {endpoint && (
              <div className="model-endpoint">{endpoint}</div>
            )}
          </div>
        </div>
      )}

      {/* 2. Cost Tracker (Hedge Ledger) */}
      <div className="cost-card yield-card">
        <div className="section-title" style={{padding: '0 0 8px 0'}}>Hedge Ledger</div>
        <div className="token-row" style={{marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none'}}>
          <div style={{display:'flex', alignItems: 'baseline', gap: '8px'}}>
            <span className="token-lbl" style={{display: 'inline-block', width: '12px'}}>—</span>
            <span className="token-val" style={{color: 'var(--accent)', fontSize: '20px'}}>
              {(state.analysisCost.inputTokens + state.analysisCost.outputTokens).toLocaleString()}
            </span>
            <span className="token-lbl" style={{marginLeft: '4px'}}>tokens</span>
          </div>
        </div>

        {/* Repo Status Bar — scouting pulse OR git diff badges */}
        <div className="repo-status-bar">
          {state.deepAnalysisRunning ? (
            <div className="repo-status-scanning">
              <span className="repo-status-dot" />
              <span className="repo-status-label">{t('status.scouting' as never)}</span>
            </div>
          ) : gitStatus ? (
            <div className="repo-status-git">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>
              </svg>
              <span className="repo-status-files">{gitStatus.files_changed} {t('status.files' as never)}</span>
              <span className="repo-status-ins">+{gitStatus.insertions}</span>
              <span className="repo-status-del">−{gitStatus.deletions}</span>
            </div>
          ) : null}
        </div>


        <div className="premium-cost-list" style={{marginTop: '6px'}}>
          <div style={{
            fontSize: '10px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px', 
            color: 'var(--text-3)', 
            marginBottom: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '18px',          /* fixed — no jitter on lang switch */
            overflow: 'hidden',
            fontFamily: 'var(--font)',/* unified to prevent CJK line-height blowout */
          }}>
            <span>{t('compiler.yield_est')}</span>
            <span>{t('compiler.est_cost')}</span>
          </div>

          {PREMIUM_BENCHMARKS.slice(0, expandedPrices ? 7 : 3).map(m => {
            const inputCost = (state.analysisCost.inputTokens / 1_000_000) * m.input;
            const outputCost = (state.analysisCost.outputTokens / 1_000_000) * m.output;
            const totalCost = inputCost + outputCost;
            return (
              <div key={m.id} style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0'}}>
                <span style={{color: 'var(--text-2)'}}>{m.name}</span>
                <span style={{fontFamily: 'var(--mono)', color: '#7ec783', fontWeight: totalCost > 0 ? 700 : 400}}>
                  ${totalCost === 0 ? '0.00' : totalCost.toFixed(4).replace(/(\.\d*?[1-9])0+$/, '$1')}
                </span>
              </div>
            );
          })}
          <div
            className="expand-arrow-btn"
            onClick={() => setExpandedPrices(!expandedPrices)}
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expandedPrices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'block', margin: '0 auto' }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </div>


      {/* 3. Prompt Builder — input area, moved up */}
      <div className="compiler-builder new-builder">
        <div className="chat-input-container">
          {/* Screenshot previews */}
          {screenshots.length > 0 && (
            <div className="screenshot-preview-row">
              {screenshots.map(img => (
                <div key={img.id} className="screenshot-thumb">
                  <img 
                    src={img.dataUrl} 
                    alt={img.name} 
                    className="screenshot-thumb-img" 
                    onClick={() => setPreviewImage(img.dataUrl)}
                  />
                  <button
                    className="screenshot-remove-btn"
                    onClick={() => removeImage(img.id)}
                    type="button"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            id="goal-input"
            rows={4}
            placeholder={t('goal.placeholder')}
            value={goal}
            onChange={e => {
              setGoal(e.target.value);
              // Auto-resize logic
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
              }
            }}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); compile(); } }}
          />
          {compileError && <div className="compile-error-msg">{compileError}</div>}
          <div className="chat-input-bottom">
            {skillsCount > 0 ? (
              <div className="input-skills-badge">
                Skills {skillsCount}
              </div>
            ) : (
              <div /> 
            )}
            <button
              className={`chat-submit-btn ${compiling ? 'compiling' : ''}`}
              disabled={!canCompile || (!goal.trim() && !screenshots.length) || compiling}
              onClick={compile}
              id="btn-compile"
            >
              {compiling ? (
                <svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                  <path d="M20 3v4"/>
                  <path d="M22 5h-4"/>
                  <path d="M4 17v2"/>
                  <path d="M5 18H3"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Fullscreen Image Preview */}
      {previewImage && createPortal(
        <div 
          className="screenshot-lightbox-overlay"
          onClick={() => setPreviewImage(null)}
        >
          <div className="lightbox-content">
            <img src={previewImage} alt="Fullscreen preview" />
            <button 
              className="lightbox-close-btn"
              onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
