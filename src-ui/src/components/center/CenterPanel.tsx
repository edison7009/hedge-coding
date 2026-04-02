// CenterPanel — Tab bar + active view

import { useAppState } from '../../store/app-state';
import { useT } from '../../i18n/useT';
import { HedgePrinciples } from './HedgePrinciples';
import { RepoMap } from './RepoMap';
import { Skills } from './Skills';
import { ModelPricing } from './ModelPricing';
import { SuperPrompt } from './SuperPrompt';
import { CodeReview } from './CodeReview';
import { DocGen } from './DocGen';
import { ErrorBoundary } from '../common/ErrorBoundary';
import './CenterPanel.css';

type Tab = 'hedge' | 'repomap' | 'skills' | 'costintel' | 'superprompt' | 'codereview' | 'docgen';

const TABS: { id: Tab; icon: string; labelKey: string }[] = [
  { id: 'hedge',       icon: 'memory',      labelKey: 'tab.hedge' },
  { id: 'repomap',     icon: 'grid',        labelKey: 'tab.repomap' },
  { id: 'skills',      icon: 'star',        labelKey: 'tab.skills' },
  { id: 'costintel',   icon: 'box',         labelKey: 'tab.costintel' },
  { id: 'superprompt', icon: 'file',        labelKey: 'tab.superprompt' },
  // { id: 'codereview',  icon: 'shieldcheck', labelKey: 'tab.codereview' },
  // { id: 'docgen',      icon: 'docs',        labelKey: 'tab.docgen' },
];

function TabIcon({ name }: { name: string }) {
  switch (name) {
    case 'memory': return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12h6M12 9v6"/></svg>;
    case 'grid':   return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case 'star':   return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'box':    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
    case 'file':   return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
    case 'shieldcheck': return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>;
    case 'docs': return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    default: return null;
  }
}

export function CenterPanel() {
  const { state, dispatch } = useAppState();
  const t = useT();

  const setTab = (tab: Tab) => dispatch({ type: 'SET_TAB', tab });

  return (
    <>
      {/* Tab bar */}
      <div className="panel-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`tab-btn ${state.activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            <TabIcon name={tab.icon} />
            <span>{t(tab.labelKey as never)}</span>
          </button>
        ))}
        <div id="prompt-actions" className="tab-actions" style={{ display: state.activeTab === 'superprompt' ? 'flex' : 'none' }}>
          {/* Copy / Download buttons rendered by SuperPrompt */}
        </div>
      </div>

      {/* Content views */}
      <div className="main-content">
        <ErrorBoundary fallbackLabel="Hedge Principles Error">
          {state.activeTab === 'hedge'       && <HedgePrinciples />}
        </ErrorBoundary>
        <ErrorBoundary fallbackLabel="Repo Map Error">
          {state.activeTab === 'repomap'     && <RepoMap />}
        </ErrorBoundary>
        <ErrorBoundary fallbackLabel="Skills Error">
          {state.activeTab === 'skills'      && <Skills />}
        </ErrorBoundary>
        <ErrorBoundary fallbackLabel="Cost Intel Error">
          {state.activeTab === 'costintel'   && <ModelPricing />}
        </ErrorBoundary>
        <ErrorBoundary fallbackLabel="Super Prompt Error">
          {state.activeTab === 'superprompt' && <SuperPrompt />}
        </ErrorBoundary>
        <ErrorBoundary fallbackLabel="Code Review Error">
          {state.activeTab === 'codereview'  && <CodeReview />}
        </ErrorBoundary>
        <ErrorBoundary fallbackLabel="Doc Gen Error">
          {state.activeTab === 'docgen'      && <DocGen />}
        </ErrorBoundary>
      </div>
    </>
  );
}
