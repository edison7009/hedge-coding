// HedgePrinciples.tsx — The 9 Commandments manifesto viewer
// Tab: 对冲原理 · Bilingual EN/ZH toggle

import { useAppState } from '../../store/app-state';
import { ScrollPanel } from '../common/ScrollPanel';
import { getHedgePrinciplesEN, getHedgePrinciplesZH } from './hedge-content';
import './HedgePrinciples.css';

export function HedgePrinciples() {
  const { state } = useAppState();

  const html = state.currentLang === 'en' ? getHedgePrinciplesEN() : getHedgePrinciplesZH();

  return (
    <div className="principles-root">
      {/* Project memory injection status floating badge */}
      {state.claudeMd && (
        <span className="principles-memory-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Memory active
        </span>
      )}

      {/* Manifesto content */}
      <ScrollPanel>
        <div
          className="principles-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </ScrollPanel>
    </div>
  );
}
