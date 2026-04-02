// RepoMap.tsx — Center tab: code structure map

import { useEffect, useState } from 'react';
import { useAppState } from '../../store/app-state';
import { useT } from '../../i18n/useT';
import { commands, isTauri } from '../../tauri';
import { ScrollPanel } from '../common/ScrollPanel';
import type { FileEntry, Symbol, GrepMatch } from '../../tauri';
import './RepoMap.css';

function kindClass(kind: string) {
  switch (kind.toLowerCase()) {
    case 'function': case 'method': case 'fn': return 'sym-fn';
    case 'class': case 'struct': return 'sym-cls';
    case 'const': case 'let': case 'var': return 'sym-var';
    case 'interface': case 'type': case 'enum': case 'typealias': return 'sym-type';
    case 'trait': case 'impl': return 'sym-cls';
    case 'macro': return 'sym-macro';
    case 'import': case 'export': case 'mod': case 'module': return 'sym-import';
    default: return 'sym-other';
  }
}

export function RepoMap() {
  const { state, dispatch } = useAppState();
  const t = useT();
  const [errorMsg, setErrorMsg] = useState('');
  const [etaText, setEtaText] = useState('');
  // ─── Grep full-text search state
  const [grepPattern, setGrepPattern] = useState('');
  const [grepMatches, setGrepMatches] = useState<GrepMatch[]>([]);
  const [grepping, setGrepping] = useState(false);
  const [grepError, setGrepError] = useState('');
  const [showGrep, setShowGrep] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const files = state.scanData?.files ?? [];
  const tokenEst = state.scanData?.token_estimate ?? 
    (files).reduce((acc, f) => acc + Math.ceil(f.size / 4), 0);
  const withSym = files.filter(f => f.symbols.length > 0);
  const totalSym = files.reduce((s, f) => s + f.symbols.length, 0);

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | null = null;
    commands.listenAnalysisProgress((payload) => {
        if (payload.summary === '__ANALYZING__') {
          dispatch({ type: 'SET_ANALYZING_FILE', path: payload.file });
        } else {
          // Accumulate cost tracker
          if (payload.input_tokens > 0 || payload.output_tokens > 0) {
            dispatch({
              type: 'ACCUMULATE_ANALYSIS_TOKENS',
              input: payload.input_tokens,
              output: payload.output_tokens,
            });
          }
          // Progress percentage
          const done = payload.index + 1;
          const pct = Math.round((done / payload.total) * 100);
          if (pct < 100) {
            setEtaText(`${pct}%`);
          } else {
            setEtaText('');
          }
          if (payload.summary) {
            dispatch({ type: 'SET_AI_SUMMARY', path: payload.file, summary: payload.summary });
          }
          if (payload.error) {
            console.error('[HC DeepAnalyze Error]', payload.file, payload.error);
          }
        }
    }).then(un => unlisten = un);

    return () => {
      if (unlisten) unlisten();
    };
  }, [dispatch]);

  const handleToggleAnalyze = async () => {
    if (state.deepAnalysisRunning) {
      setEtaText('');
      dispatch({ type: 'SET_DEEP_ANALYSIS_RUNNING', running: false });
      dispatch({ type: 'SET_ANALYZING_FILE', path: null });
      await commands.cancelDeepAnalysis();
      return;
    }

    setErrorMsg('');
    dispatch({ type: 'RESET_ANALYSIS_COST' });
    const unanalyzed = withSym.filter(f => !(state.aiSummaries || {})[f.relative_path]);
    const filesToAnalyze = unanalyzed.map(f => f.relative_path);
    if (filesToAnalyze.length === 0) return;

    try {
      await commands.checkModelConfig();
    } catch (e) {
      setErrorMsg(String(e));
      return;
    }

    setEtaText('');
    dispatch({ type: 'SET_DEEP_ANALYSIS_RUNNING', running: true });

    try {
      await commands.startDeepAnalysis(filesToAnalyze);
    } catch (e) {
      console.error(e);
      setErrorMsg(String(e));
    } finally {
      dispatch({ type: 'SET_DEEP_ANALYSIS_RUNNING', running: false });
      dispatch({ type: 'SET_ANALYZING_FILE', path: null });
      setEtaText('');
    }
  };

  // ─── Grep: full-text search via backend ────────────────────────────────────
  const handleGrep = async () => {
    const pattern = grepPattern.trim();
    if (!pattern || !isTauri) return;
    setGrepping(true);
    setGrepError('');
    setGrepMatches([]);
    try {
      const matches = await commands.grepProject(pattern);
      setGrepMatches(matches);
      dispatch({ type: 'SET_GREP_RESULTS', results: matches, query: pattern });
    } catch (e) {
      setGrepError(String(e));
    } finally {
      setGrepping(false);
    }
  };

  const handleGrepKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGrep();
    if (e.key === 'Escape') { setShowGrep(false); setGrepMatches([]); setGrepPattern(''); }
  };

  if (!state.folderPath) {
    return (
      <ScrollPanel>
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <p className="empty-title">Repo Map</p>
          <p className="empty-sub">{t('empty.repomap' as never)}</p>
        </div>
      </ScrollPanel>
    );
  }

  return (
    <div className="repomap-view">
      {/* Stats Header */}
      <div className="view-stats">
        <span id="stat-indexed">{t('stat.files.indexed', { n: files.length })}</span>
        <span className="sep">·</span>
        <span id="stat-symbols">{t('stat.symbols', { n: totalSym })}</span>
        <span className="sep">·</span>
        <span>{tokenEst.toLocaleString()} tokens</span>

        <div className="view-actions">
          {errorMsg && <span className="error-text" style={{marginRight: '8px', color: 'var(--accent-red)', fontSize: '12px'}}>{errorMsg}</span>}
          {etaText && <span style={{ marginRight: 12, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{etaText}</span>}
          
          {/* Grep toggle */}
          <button
            className={`grep-toggle-btn ${showGrep ? 'active' : ''}`}
            onClick={() => setShowGrep(v => !v)}
            id="btn-grep-toggle"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            {t('repomap.grep' as any)}
          </button>
          
          <button 
            className={`deep-analyze-btn ${state.deepAnalysisRunning ? 'btn-danger' : ''}`} 
            onClick={handleToggleAnalyze}
            disabled={withSym.length === Object.keys(state.aiSummaries || {}).length && !state.deepAnalysisRunning}
          >
            {state.deepAnalysisRunning ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
                {t('repomap.analyze.pause' as any)}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                {t('repomap.analyze.btn' as any)}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grep Search Bar */}
      {showGrep && (
        <div className="grep-bar">
          <div className="grep-input-wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="grep-icon">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="grep-input"
              id="grep-input"
              placeholder={t('repomap.search.placeholder' as any)}
              value={grepPattern}
              onChange={e => setGrepPattern(e.target.value)}
              onKeyDown={handleGrepKeyDown}
              autoFocus
            />
            {grepPattern && (
              <button className="grep-clear" onClick={() => { setGrepPattern(''); setGrepMatches([]); }}>✕</button>
            )}
          </div>
          <button
            className="grep-search-btn"
            id="btn-grep-search"
            onClick={handleGrep}
            disabled={grepping || !grepPattern.trim()}
          >
            {grepping ? (
              <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
              </svg>
            ) : t('repomap.search.btn' as any)}
          </button>
        </div>
      )}

      {/* Grep Results */}
      {grepMatches.length > 0 && (
        <div className="grep-results">
          <div className="grep-results-header">
            <span className="grep-match-count">{t('repomap.search.matches' as any, { n: grepMatches.length })} "{grepPattern}"</span>
            <button className="grep-results-clear" onClick={() => { setGrepMatches([]); }}>{t('repomap.clear' as any)}</button>
          </div>
          <div className="grep-results-list">
            {grepMatches.map((m, i) => (
              <div key={i} className="grep-result-item" id={`grep-match-${i}`}>
                <span className="grep-result-path">{m.relative_path}</span>
                <span className="grep-result-line">:{m.line_number}</span>
                <span className="grep-result-content">{m.line_content}</span>
              </div>
            ))}
          </div>
          {grepMatches.length >= 200 && (
            <div className="grep-limit-warn">{t('repomap.search.limit' as any)}</div>
          )}
        </div>
      )}
      {grepError && <div className="grep-error">{grepError}</div>}


      <ScrollPanel>
        {!state.scanData ? (
          <div className="skeleton-repomap" style={{ padding: '8px 16px', pointerEvents: 'none' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ marginBottom: '16px', opacity: Math.max(0.1, 1 - i * 0.1) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div className="shimmer-box" style={{ width: 14, height: 14, borderRadius: 2, flexShrink: 0 }}></div>
                  <div className="shimmer-box" style={{ width: `${30 + (i * 7) % 30}%`, height: 14, borderRadius: 3 }}></div>
                </div>
                <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="shimmer-box" style={{ width: `${60 - (i * 5) % 20}%`, height: 12, borderRadius: 2 }}></div>
                  <div className="shimmer-box" style={{ width: `${40 + (i * 3) % 40}%`, height: 12, borderRadius: 2 }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : withSym.length === 0 ? (
          <div className="empty-state"></div>
        ) : (
          withSym.map((f: FileEntry) => {
            const hasSummary = !!(state.aiSummaries || {})[f.relative_path];
            const isAnalyzing = state.analyzingFile === f.relative_path;
            const summaryText = (state.aiSummaries || {})[f.relative_path] || '';
            const isExpanded = expandedFiles.has(f.relative_path);

            return (
              <div key={f.relative_path} className={`rm-file-row ${isExpanded ? 'expanded' : ''}`} id={`rmf-${f.relative_path.replace(/[^a-z0-9]/gi, '_')}`}>
                {/* Compact Row Header */}
                <div className="rm-file-compact-header" onClick={() => toggleFile(f.relative_path)}>
                  <div className={`chevron ${isExpanded ? 'open' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                  
                  <span className="rm-fname">{f.relative_path}</span>
                  
                  {/* Truncated Summary / Analyzing Animation inside the row */}
                  {isAnalyzing && (
                    <div className="rm-row-summary analyzing">
                      <div className="shimmer-box" style={{width: 80, height: 10}}></div>
                      <span className="rm-status-text blink">{t('repomap.analyze.parsing' as any)}</span>
                    </div>
                  )}
                  {hasSummary && !isAnalyzing && (
                    <div className="rm-row-summary text-truncate">
                      {summaryText}
                    </div>
                  )}
                  
                  <span className="rm-meta">({f.line_count} lines)</span>
                </div>

                {/* Expanded Details Sub-panel */}
                {isExpanded && (
                  <div className="rm-file-details">
                    {hasSummary && (
                      <div className="rm-ai-summary">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        <span>{summaryText}</span>
                      </div>
                    )}
                    
                    {f.symbols.map((s: Symbol, i: number) => (
                      <div key={i} className="rm-sym">
                        <span className={kindClass(s.kind)}>[{s.kind.toLowerCase()}]</span>{' '}
                        {s.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </ScrollPanel>
    </div>
  );
}
