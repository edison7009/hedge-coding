// CodeReview.tsx — Code Review tab: diff → Super Prompt → structured findings

import { useState, useRef } from 'react';
import { useAppState } from '../../store/app-state';
import { commands, isTauri } from '../../tauri';
import type { ReviewFinding, ReviewFindingsResult, ReviewAdversarialCheck } from '../../tauri';
import { useT } from '../../i18n/useT';
import { ScrollPanel } from '../common/ScrollPanel';
import './CodeReview.css';

// ─── Severity Badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: ReviewFinding['severity'] }) {
  return (
    <span className={`severity-badge severity-${severity.toLowerCase()}`}>
      {severity}
    </span>
  );
}

// ─── Confidence Bar ──────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="confidence-bar-wrap">
      <div className="confidence-bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Finding Card ─────────────────────────────────────────────────────────────

function FindingCard({ finding, index }: { finding: ReviewFinding; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`finding-card finding-${finding.severity.toLowerCase()}`}
         id={`finding-${index}`}>
      <div className="finding-header" onClick={() => setExpanded(e => !e)}>
        <SeverityBadge severity={finding.severity} />
        <span className="finding-category">{finding.category.replace(/_/g, ' ')}</span>
        <span className="finding-file">{finding.file}:{finding.line}</span>
        <ConfidenceBar value={finding.confidence} />
        <svg
          className={`finding-chevron ${expanded ? 'open' : ''}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      <p className="finding-description">{finding.description}</p>

      {expanded && (
        <div className="finding-details">
          {finding.exploit_scenario && (
            <div className="finding-section">
              <div className="finding-section-label">Exploit Scenario</div>
              <p>{finding.exploit_scenario}</p>
            </div>
          )}
          <div className="finding-section">
            <div className="finding-section-label">Recommendation</div>
            <p>{finding.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Verdict Banner ───────────────────────────────────────────────────────────

function VerdictBanner({ verdict }: { verdict: 'PASS' | 'FAIL' | 'PARTIAL' | undefined }) {
  if (!verdict) return null;
  const config = {
    PASS: { label: 'PASS', icon: '✓', cls: 'verdict-pass', desc: 'No high or medium severity findings detected.' },
    FAIL: { label: 'FAIL', icon: '✗', cls: 'verdict-fail', desc: 'One or more HIGH or MEDIUM severity findings require attention.' },
    PARTIAL: { label: 'PARTIAL', icon: '◑', cls: 'verdict-partial', desc: 'Review could not be fully completed due to environmental limitations.' },
  }[verdict];
  return (
    <div className={`verdict-banner ${config.cls}`} id="review-verdict">
      <span className="verdict-icon">{config.icon}</span>
      <div className="verdict-text">
        <span className="verdict-label">VERDICT: {config.label}</span>
        <span className="verdict-desc">{config.desc}</span>
      </div>
    </div>
  );
}

// ─── Adversarial Checks Panel ─────────────────────────────────────────────────

function AdversarialChecks({ checks }: { checks: ReviewAdversarialCheck[] }) {
  if (!checks || checks.length === 0) return null;
  return (
    <div className="adversarial-panel">
      <div className="adversarial-label">Adversarial Probes</div>
      {checks.map((c, i) => (
        <div key={i} className={`adversarial-item adversarial-${c.result.toLowerCase()}`}>
          <span className={`adversarial-result adversarial-result-${c.result.toLowerCase()}`}>{c.result}</span>
          <span className="adversarial-check">{c.check}</span>
          {c.notes && <span className="adversarial-notes">{c.notes}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Findings Summary ─────────────────────────────────────────────────────────

function FindingsSummary({ findings }: { findings: ReviewFinding[] }) {
  const high = findings.filter(f => f.severity === 'HIGH').length;
  const medium = findings.filter(f => f.severity === 'MEDIUM').length;
  const low = findings.filter(f => f.severity === 'LOW').length;

  return (
    <div className="findings-summary">
      <div className="summary-stat">
        <span className="summary-count severity-high-text">{high}</span>
        <span className="summary-label">HIGH</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-stat">
        <span className="summary-count severity-medium-text">{medium}</span>
        <span className="summary-label">MEDIUM</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-stat">
        <span className="summary-count severity-low-text">{low}</span>
        <span className="summary-label">LOW</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ReviewPhase = 'input' | 'compiled' | 'findings';

export function CodeReview() {
  const { state, dispatch } = useAppState();
  const t = useT();
  const [phase, setPhase] = useState<ReviewPhase>('input');
  const [diffText, setDiffText] = useState('');
  const [findingsJson, setFindingsJson] = useState('');
  const [verdict, setVerdict] = useState<'PASS' | 'FAIL' | 'PARTIAL' | undefined>(undefined);
  const [adversarialChecks, setAdversarialChecks] = useState<ReviewAdversarialCheck[]>([]);
  const [compiling, setCompiling] = useState(false);
  const [parseError, setParseError] = useState('');
  const [compileError, setCompileError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [rulesText, setRulesText] = useState(state.reviewRules);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canCompile = !!state.folderPath && diffText.trim().length > 0;

  // ─── Compile Review ───────────────────────────────────────────────────────

  const handleCompile = async () => {
    if (!canCompile) return;
    setCompiling(true);
    setCompileError('');

    try {
      const result = await commands.compileReview(diffText);
      dispatch({ type: 'SET_REVIEW_SUPER_PROMPT', content: result.super_prompt });
      setPhase('compiled');
    } catch (e) {
      setCompileError(String(e));
    } finally {
      setCompiling(false);
    }
  };

  // ─── Copy / Download ──────────────────────────────────────────────────────

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.reviewSuperPrompt);
      setCopied(true);
      if (toastRef.current) clearTimeout(toastRef.current);
      toastRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownload = () => {
    const blob = new Blob([state.reviewSuperPrompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'review-prompt.xml';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Parse Findings JSON ─────────────────────────────────────────────────

  const handleParseFindings = () => {
    setParseError('');
    try {
      const parsed: ReviewFindingsResult = JSON.parse(findingsJson);
      if (!Array.isArray(parsed.findings)) throw new Error('Missing findings array');
      dispatch({ type: 'SET_REVIEW_FINDINGS', findings: parsed.findings });
      setVerdict(parsed.verdict);
      setAdversarialChecks(parsed.adversarial_checks ?? []);
      setPhase('findings');
    } catch (e) {
      setParseError(`Invalid JSON: ${String(e)}`);
    }
  };

  // ─── Save Rules ───────────────────────────────────────────────────────────

  const handleSaveRules = async () => {
    try {
      if (isTauri) await commands.saveReviewRules(rulesText);
      dispatch({ type: 'SET_REVIEW_RULES', rules: rulesText });
      setShowRulesEditor(false);
    } catch (e) {
      console.error('[HC] save review rules failed:', e);
    }
  };

  // ─── No folder state ──────────────────────────────────────────────────────

  if (!state.folderPath) {
    return (
      <ScrollPanel>
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <p className="empty-title">Code Review</p>
          <p className="empty-sub">{t('empty.codereview' as never)}</p>
        </div>
      </ScrollPanel>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="review-container">
      {/* Phase Navigation */}
      <div className="review-phase-nav">
        <button
          className={`review-phase-btn ${phase === 'input' ? 'active' : ''}`}
          onClick={() => setPhase('input')}
          id="review-tab-input"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          Diff Input
        </button>
        <button
          className={`review-phase-btn ${phase === 'compiled' ? 'active' : ''}`}
          onClick={() => { if (state.reviewSuperPrompt) setPhase('compiled'); }}
          disabled={!state.reviewSuperPrompt}
          id="review-tab-compiled"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Review Prompt
        </button>
        <button
          className={`review-phase-btn ${phase === 'findings' ? 'active' : ''}`}
          onClick={() => { if (state.reviewFindings.length > 0) setPhase('findings'); }}
          disabled={state.reviewFindings.length === 0}
          id="review-tab-findings"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Findings
          {state.reviewFindings.length > 0 && (
            <span className="findings-count">{state.reviewFindings.length}</span>
          )}
        </button>
      </div>

      <ScrollPanel>
        {/* ── Phase: Diff Input ─────────────────────────────── */}
        {phase === 'input' && (
          <div className="review-phase-content" id="review-input-phase">

            {/* Diff Textarea */}
            <div className="review-section">
              <div className="review-section-header">
                <span className="review-section-label">GIT DIFF</span>
                <span className="review-section-hint">Paste the output of `git diff` or `git diff HEAD~1`</span>
              </div>
              <textarea
                id="diff-input"
                className="review-diff-textarea"
                placeholder={'Paste your git diff here...\n\ndiff --git a/src/auth.ts b/src/auth.ts\n--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -40,6 +40,8 @@\n ...'}
                value={diffText}
                onChange={e => setDiffText(e.target.value)}
                spellCheck={false}
              />
              {diffText && (
                <div className="diff-stats">
                  {diffText.split('\n').filter(l => l.startsWith('diff --git')).length} file(s) changed
                  <span className="sep">·</span>
                  {diffText.split('\n').filter(l => l.startsWith('+')).length} additions
                  <span className="sep">·</span>
                  {diffText.split('\n').filter(l => l.startsWith('-')).length} deletions
                </div>
              )}
            </div>

            {/* Review Rules */}
            <div className="review-section">
              <div className="review-section-header">
                <span className="review-section-label">REVIEW RULES</span>
                <span className="review-section-hint">.hedgecoding/REVIEW.md — project-specific rules</span>
                <button
                  className="review-rules-toggle"
                  onClick={() => setShowRulesEditor(e => !e)}
                  id="btn-toggle-rules"
                >
                  {showRulesEditor ? 'Hide' : 'Edit Rules'}
                </button>
              </div>
              {showRulesEditor && (
                <div className="review-rules-editor">
                  <textarea
                    id="rules-input"
                    className="review-rules-textarea"
                    placeholder={'# Review Rules\n\n## Always Check\n- New API endpoints have integration tests\n- Error messages don\'t leak internals\n\n## Skip\n- Generated files under src/gen/\n- Formatting-only changes'}
                    value={rulesText}
                    onChange={e => setRulesText(e.target.value)}
                    spellCheck={false}
                  />
                  <div className="review-rules-actions">
                    <button className="review-save-btn" onClick={handleSaveRules} id="btn-save-rules">
                      Save to .hedgecoding/REVIEW.md
                    </button>
                  </div>
                </div>
              )}
              {!showRulesEditor && (
                <div className="review-rules-preview">
                  {rulesText
                    ? <span className="rules-preview-text">{rulesText.split('\n').slice(0, 2).join(' · ')}</span>
                    : <span className="rules-empty">No rules configured — using default exclusions from Anthropic's security review methodology.</span>
                  }
                </div>
              )}
            </div>

            {/* Scout Report status */}
            {Object.keys(state.aiSummaries || {}).length > 0 && (
              <div className="review-scout-notice">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Scout report available: {Object.keys(state.aiSummaries || {}).length} file summaries will enrich the review prompt.
              </div>
            )}

            {/* Error */}
            {compileError && (
              <div className="review-error">{compileError}</div>
            )}

            {/* Compile Button */}
            <div className="review-compile-row">
              <button
                className="review-compile-btn"
                disabled={!canCompile || compiling}
                onClick={handleCompile}
                id="btn-compile-review"
              >
                {compiling ? (
                  <>
                    <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Compiling Review Prompt...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    Compile Review Prompt
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Compiled Prompt ────────────────────────── */}
        {phase === 'compiled' && (
          <div className="review-phase-content" id="review-compiled-phase">
            <div className="review-section">
              <div className="review-section-header">
                <span className="review-section-label">REVIEW SUPER PROMPT</span>
                <div className="review-prompt-actions">
                  <button className="review-action-btn" onClick={handleCopy} id="btn-copy-review">
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <button className="review-action-btn outline" onClick={handleDownload} id="btn-download-review">
                    Download
                  </button>
                </div>
              </div>
              <div className="review-prompt-hint">
                Paste this into your premium model (Claude Opus, GPT-4o, etc.) and ask it to respond with the JSON findings.
              </div>
              <pre className="review-prompt-preview">{state.reviewSuperPrompt}</pre>
            </div>

            {/* Findings Input */}
            <div className="review-section">
              <div className="review-section-header">
                <span className="review-section-label">PASTE FINDINGS</span>
                <span className="review-section-hint">Paste the JSON response from your model</span>
              </div>
              <textarea
                id="findings-input"
                className="review-findings-textarea"
                placeholder={'{\n  "findings": [...],\n  "analysis_summary": {...}\n}'}
                value={findingsJson}
                onChange={e => setFindingsJson(e.target.value)}
                spellCheck={false}
              />
              {parseError && <div className="review-error">{parseError}</div>}
              <button
                className="review-parse-btn"
                disabled={!findingsJson.trim()}
                onClick={handleParseFindings}
                id="btn-parse-findings"
              >
                Visualize Findings
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Findings Visualization ────────────────── */}
        {phase === 'findings' && state.reviewFindings.length > 0 && (
          <div className="review-phase-content" id="review-findings-phase">
            <VerdictBanner verdict={verdict} />
            <FindingsSummary findings={state.reviewFindings} />
            <AdversarialChecks checks={adversarialChecks} />

            {/* HIGH findings */}
            {state.reviewFindings.filter(f => f.severity === 'HIGH').length > 0 && (
              <div className="review-findings-group">
                <div className="findings-group-label">HIGH SEVERITY</div>
                {state.reviewFindings
                  .filter(f => f.severity === 'HIGH')
                  .map((f, i) => <FindingCard key={`high-${i}`} finding={f} index={i} />)}
              </div>
            )}

            {/* MEDIUM findings */}
            {state.reviewFindings.filter(f => f.severity === 'MEDIUM').length > 0 && (
              <div className="review-findings-group">
                <div className="findings-group-label">MEDIUM SEVERITY</div>
                {state.reviewFindings
                  .filter(f => f.severity === 'MEDIUM')
                  .map((f, i) => <FindingCard key={`med-${i}`} finding={f} index={i + 100} />)}
              </div>
            )}

            {/* LOW findings */}
            {state.reviewFindings.filter(f => f.severity === 'LOW').length > 0 && (
              <div className="review-findings-group">
                <div className="findings-group-label">LOW SEVERITY</div>
                {state.reviewFindings
                  .filter(f => f.severity === 'LOW')
                  .map((f, i) => <FindingCard key={`low-${i}`} finding={f} index={i + 200} />)}
              </div>
            )}
          </div>
        )}
      </ScrollPanel>
    </div>
  );
}
