// DocGen.tsx — Super Docs: AI-powered semantic documentation generator
// Compiles a Super Prompt that instructs any AI to write documentation
// orders of magnitude better than auto-doc tools like JSDoc or TypeDoc.

import { useState } from 'react';
import { useAppState } from '../../store/app-state';
import { commands, isTauri, type DocFormat, type DocsCompileResult } from '../../tauri';
import { useT } from '../../i18n/useT';
import { ScrollPanel } from '../common/ScrollPanel';
import './DocGen.css';

// ─── Format Options ───────────────────────────────────────────────────────────

interface DocFormatOption {
  id: DocFormat;
  label: string;
  badge: string;
  description: string;
  color: string;
}

const DOC_FORMATS: DocFormatOption[] = [
  {
    id: 'docusaurus',
    label: 'Docusaurus',
    badge: 'v3',
    description: 'MDX + sidebar_position, most popular React-based doc site',
    color: '#3EAF7C',
  },
  {
    id: 'vitepress',
    label: 'VitePress',
    badge: 'Vue',
    description: 'Lightning-fast, Vue-powered, great for component libraries',
    color: '#646CFF',
  },
  {
    id: 'gitbook',
    label: 'GitBook',
    badge: 'MD',
    description: 'SUMMARY.md-based, clean and minimal',
    color: '#4285F4',
  },
  {
    id: 'mkdocs',
    label: 'MkDocs',
    badge: 'Material',
    description: 'YAML nav, Material theme, Python project standard',
    color: '#526CFE',
  },
  {
    id: 'markdown',
    label: 'Plain Markdown',
    badge: 'Universal',
    description: 'Works with any documentation platform',
    color: '#888',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DocGen() {
  const { state } = useAppState();
  const t = useT();
  const [format, setFormat] = useState<DocFormat>('docusaurus');
  const [goal, setGoal] = useState('');
  const [result, setResult] = useState<DocsCompileResult | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const hasFolder = !!state.folderPath;

  const handleCompile = async () => {
    if (!hasFolder || compiling) return;
    setCompiling(true);
    setError('');
    setResult(null);
    setCopied(false);

    try {
      if (!isTauri) {
        // Dev-mode stub
        await new Promise(r => setTimeout(r, 600));
        const fileCount = state.scanData?.files.length || 0;
        setResult({
          super_prompt: `<documentation_goal>\n${goal || 'Generate comprehensive documentation.'}\n</documentation_goal>\n\n[Super Docs prompt compiled — paste into your AI model]`,
          file_count: fileCount,
          source_chars: 8000,
          format_label: DOC_FORMATS.find(f => f.id === format)?.label || '',
          estimate: { tokens: 8200, costs: [] },
        });
        return;
      }

      const allFiles = state.scanData?.files.map(f => f.relative_path) || [];
      const res = await commands.compileDocs(
        goal.trim(),
        allFiles,
        format,
      );
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setCompiling(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.super_prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─── No folder ──────────────────────────────────────────────────────────────
  if (!hasFolder) {
    return (
      <ScrollPanel>
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <p className="empty-title">Super Docs</p>
          <p className="empty-sub">{t('empty.docgen' as never)}</p>
        </div>
      </ScrollPanel>
    );
  }

  // ─── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="docgen-root">
      <ScrollPanel>
        <div className="docgen-content">

          {/* Header */}
          <div className="docgen-header">
            <div className="docgen-header-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Super Docs</span>
            </div>
            <span className="docgen-header-sub">
              {state.scanData?.files.length
              ? `${state.scanData.files.length} files in project`
              : 'All project files'}
            </span>
          </div>

          {/* Format Selector */}
          <div className="docgen-section-label">Documentation Format</div>
          <div className="docgen-formats">
            {DOC_FORMATS.map(opt => (
              <button
                key={opt.id}
                className={`docgen-format-card ${format === opt.id ? 'selected' : ''}`}
                onClick={() => setFormat(opt.id)}
                id={`btn-format-${opt.id}`}
                style={{ '--fmt-color': opt.color } as React.CSSProperties}
              >
                <div className="docgen-format-top">
                  <span className="docgen-format-name">{opt.label}</span>
                  <span className="docgen-format-badge">{opt.badge}</span>
                </div>
                <span className="docgen-format-desc">{opt.description}</span>
              </button>
            ))}
          </div>

          {/* Goal Input */}
          <div className="docgen-section-label" style={{ marginTop: 16 }}>
            Documentation Goal <span className="docgen-optional">(optional)</span>
          </div>
          <textarea
            className="docgen-goal-input"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder={`e.g. "Full API reference for the auth module"\n"Getting started guide + architecture overview"\nLeave empty for comprehensive full-project docs`}
            rows={3}
            id="docgen-goal"
          />

          {/* Compile button */}
          <button
            className={`docgen-compile-btn ${compiling ? 'loading' : ''}`}
            onClick={handleCompile}
            disabled={compiling}
            id="btn-compile-super-docs"
          >
            {compiling ? (
              <>
                <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Compiling Super Docs...
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Compile Super Docs
              </>
            )}
          </button>

          {error && <div className="docgen-error">{error}</div>}

          {/* Result */}
          {result && (
            <div className="docgen-result">
              {/* Stats bar */}
              <div className="docgen-result-bar">
                <div className="docgen-result-stats">
                  <span>{result.file_count} files</span>
                  <span>·</span>
                  <span>{result.estimate.tokens.toLocaleString()} tokens</span>
                  <span>·</span>
                  <span>~${(result.estimate.costs[0]?.input_cost_usd ?? 0).toFixed(4)}</span>
                  <span className="docgen-format-pill">{result.format_label}</span>
                </div>
                <button
                  className={`docgen-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  id="btn-copy-super-docs"
                >
                  {copied ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy Super Docs
                    </>
                  )}
                </button>
              </div>

              {/* Instruction banner */}
              <div className="docgen-instruction">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Copy this Super Docs prompt and paste it into Claude, GPT-4o, or any AI model. It will generate ready-to-deploy <strong>{result.format_label}</strong> documentation files.
              </div>

              {/* Prompt preview */}
              <pre className="docgen-prompt-preview">{result.super_prompt}</pre>
            </div>
          )}
        </div>
      </ScrollPanel>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.9s linear infinite; display: inline-block; }`}</style>
    </div>
  );
}
