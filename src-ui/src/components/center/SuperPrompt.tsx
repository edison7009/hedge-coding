import { useState, useRef, useEffect } from "react";
import { useAppState, type PromptHistoryItem } from "../../store/app-state";
import { useT } from "../../i18n/useT";
import { ScrollPanel } from "../common/ScrollPanel";

export function SuperPrompt() {
  const { state, dispatch } = useAppState();
  const t = useT();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPathId, setCopiedPathId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new bubbles arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.superPromptHistory]);

  const handleCopy = async (item: PromptHistoryItem) => {
    try {
      await navigator.clipboard.writeText(item.fullContent ?? '');
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = item.fullContent ?? '';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyPath = async (item: PromptHistoryItem) => {
    if (!item.promptPath) return;
    try {
      await navigator.clipboard.writeText(item.promptPath);
      setCopiedPathId(item.id);
      setTimeout(() => setCopiedPathId(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = item.promptPath;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedPathId(item.id);
      setTimeout(() => setCopiedPathId(null), 2000);
    }
  };

  if (!state.superPromptHistory || state.superPromptHistory.length === 0) {
    // Show build animation when compiling, empty-state otherwise
    if (state.compilingPrompt) {
      return (
        <ScrollPanel>
          <div className="sp-compiling-screen">
            <div className="sp-compiling-orbs">
              <span className="sp-orb sp-orb-1" />
              <span className="sp-orb sp-orb-2" />
              <span className="sp-orb sp-orb-3" />
            </div>
            <p className="sp-compiling-title">Building Super Prompt</p>
            <p className="sp-compiling-sub">Scout model is analyzing your task&hellip;</p>
          </div>
        </ScrollPanel>
      );
    }
    return (
      <ScrollPanel>
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <p className="empty-title">Super Prompt</p>
          <p className="empty-sub">{t('empty.prompt' as never)}</p>
        </div>
      </ScrollPanel>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ScrollPanel>
        <div className="sp-history-container">
          {state.superPromptHistory.map((item) => {
            // Defensive fallback: meta may be undefined/malformed in legacy history entries
            const meta = item.meta ?? { taskSize: '', daCoverage: 'none', daFiles: 0, charCount: 0, tokenEst: 0 };
            const itemId = item.id ?? String(item.timestamp ?? Math.random());

            return (
              <div key={itemId} className="sp-bubble slide-up">

                {/* Bubble Header Toolbar */}
                <div className="sp-bubble-header">
                  <div className="sp-toolbar-left">
                    {meta.taskSize && (
                      <span className={`sp-task-badge sp-task-${(meta.taskSize ?? '').toLowerCase()}`}>
                        {t(`task.${(meta.taskSize ?? '').toLowerCase()}` as any) || meta.taskSize}
                      </span>
                    )}
                    <span className="sp-stats">
                      {t('superprompt.chars' as any, { n: (meta.charCount ?? 0).toLocaleString() })} · ~{(meta.tokenEst ?? 0).toLocaleString()} {t('tokens' as any)}
                    </span>

                    {meta.daCoverage === 'none' && (
                      <span className="sp-hint sp-hint-link" onClick={() => dispatch({ type: 'SET_TAB', tab: 'repomap' })}>{t('superprompt.no_da' as any)}</span>
                    )}
                    {meta.daCoverage === 'partial' && (
                      <span className="sp-hint">{t('superprompt.da_partial' as any, { n: meta.daFiles ?? 0 })}</span>
                    )}
                    {meta.daCoverage === 'full' && (
                      <span className="sp-hint sp-hint-ok">{t('deep.analysis' as any)}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {item.promptPath && (
                      <button
                        className={`sp-copy-btn ${copiedPathId === itemId ? 'copied' : ''}`}
                        onClick={() => handleCopyPath(item)}
                      >
                        {copiedPathId === itemId ? t('superprompt.copied' as any) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                              <polyline points="13 2 13 9 20 9"/>
                            </svg>
                            {t('superprompt.copy_path' as any)}
                          </>
                        )}
                      </button>
                    )}
                    <button
                      className={`sp-copy-btn ${copiedId === itemId ? 'copied' : ''}`}
                      onClick={() => handleCopy(item)}
                    >
                      {copiedId === itemId ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {t('superprompt.copied' as any)}
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          {t('copy.xml' as any)}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Bubble Content: Extracted core context */}
                <div className="sp-bubble-content">
                  <div className="sp-fragment">
                    <div className="sp-fragment-title">{t('superprompt.goal' as any)}</div>
                    <pre className="sp-fragment-pre">{item.goalSnippet ?? ''}</pre>
                  </div>

                  {item.instructionsSnippet && (
                    <div className="sp-fragment">
                      <div className="sp-fragment-title">{t('superprompt.instructions' as any)}</div>
                      <pre className="sp-fragment-pre">{item.instructionsSnippet}</pre>
                    </div>
                  )}

                  <div className="sp-fragment-muted">
                    {t('superprompt.context_hint' as any)}
                  </div>
                </div>

              </div>
            );
          })}
          {/* Loading bubble — shown while a new prompt is being built */}
          {state.compilingPrompt && (
            <div className="sp-bubble sp-bubble-loading slide-up">
              <div className="sp-compiling-orbs" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
                <span className="sp-orb sp-orb-1" />
                <span className="sp-orb sp-orb-2" />
                <span className="sp-orb sp-orb-3" />
              </div>
              <p className="sp-compiling-sub" style={{ margin: 0 }}>Scout model is analyzing your task&hellip;</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollPanel>
    </div>
  );
}
