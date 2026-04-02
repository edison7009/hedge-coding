// Skills.tsx — Dynamic skill loader inspired by Claude Code's skills/loadSkillsDir.ts
// Scans .hedgecoding/skills/*.md, parses frontmatter, allows inject into Super Prompt

import { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../../store/app-state';
import { commands, isTauri } from '../../tauri';
import type { SkillMeta } from '../../tauri';
import { useT } from '../../i18n/useT';
import { ScrollPanel } from '../common/ScrollPanel';
import './Skills.css';

// ─── Skill Card ───────────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: SkillMeta;
  injected: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
}

function SkillCard({ skill, injected, onToggle, onEdit }: SkillCardProps) {
  return (
    <div 
      className={`skill-card ${injected ? 'injected' : ''}`} 
      id={`skill-${skill.id}`}
      onClick={() => onToggle(skill.id)}
    >
      <div className="skill-card-checkbox">
        {injected ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <div className="skill-card-checkbox-empty" />
        )}
      </div>

      <div className="skill-card-content">
        <div className="skill-card-name">{skill.name}</div>
        <div className="skill-card-meta-row">
          <span className="skill-size">{Math.ceil(skill.char_count / 4)} tk</span>
          {skill.auto_inject && <span className="skill-auto-badge">auto</span>}
        </div>
      </div>

      <button
        className="skill-edit-btn"
        onClick={(e) => { e.stopPropagation(); onEdit(skill.id); }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Main Skills Component ────────────────────────────────────────────────────

export function Skills() {
  const { state, dispatch } = useAppState();
  const t = useT();
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [injectedIds, setInjectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true); // default true to prevent empty-state flash on mount
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const hasFolder = !!state.folderPath;

  // ─── Load skills on folder open ───────────────────────────────────────────

  const loadSkills = useCallback(async () => {
    if (!hasFolder || !isTauri) return;
    setLoading(true);
    setError('');
    try {
      const list = await commands.listSkills();
      setSkills(list);
      // Auto-inject skills marked with auto_inject: true
      const autoIds = new Set(list.filter(s => s.auto_inject).map(s => s.id));
      setInjectedIds(prev => {
        const merged = new Set([...prev]);
        autoIds.forEach(id => merged.add(id));
        return merged;
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [hasFolder]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // ─── Sync injected skills into app state (for Compiler) ──────────────────

  useEffect(() => {
    dispatch({ type: 'SET_SKILLS_CONTEXT', context: Array.from(injectedIds) });
  }, [injectedIds, dispatch]);

  // ─── Toggle inject ────────────────────────────────────────────────────────

  const handleToggle = (id: string) => {
    setInjectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Direct Folder Management ───────────────────────────────────────────────

  const handleOpenFolder = async () => {
    try {
      await commands.openSkillsDir();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreateExample = async () => {
    try {
      await commands.createExampleSkill();
      await loadSkills();
    } catch (e) {
      setError(String(e));
    }
  };

  // ─── Filter ───────────────────────────────────────────────────────────────

  const filtered = skills.filter(s =>
    !filter ||
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.category.toLowerCase().includes(filter.toLowerCase()) ||
    s.description.toLowerCase().includes(filter.toLowerCase())
  );

  // Group by category
  const grouped = filtered.reduce<Record<string, SkillMeta[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (!hasFolder) {
    return (
      <ScrollPanel>
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <p className="empty-title">Skills</p>
          <p className="empty-sub">{t('empty.skills' as never)}</p>
        </div>
      </ScrollPanel>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="skills-container">
      {/* Philosophy Banner */}
      <div className="skills-philosophy-banner">
        {t('skills.banner.desc' as never)}
      </div>

      {/* Toolbar */}
      <div className="skills-toolbar">
        <div className="skills-search-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="skills-search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="skills-search"
            placeholder={t('skills.search.placeholder' as any)}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            id="skills-search"
          />
        </div>
        <button className="skills-new-btn" onClick={handleOpenFolder} id="btn-open-skills-folder">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          {t('open.folder' as any)}
        </button>
      </div>



      {error && <div className="skills-error">{error}</div>}

      <ScrollPanel>
        {loading ? (
          <div className="skills-loading">
            <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            {t('skills.loading' as any)}
          </div>
        ) : skills.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <p className="empty-title">{t('skills.empty.title' as any)}</p>
            <p className="empty-sub">{t('skills.empty.sub' as any)}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="action-btn outline" onClick={handleCreateExample} id="btn-create-example">
                {t('skills.btn.create_example' as any)}
              </button>
              <button className="action-btn" onClick={handleOpenFolder} id="btn-open-folder-welcome">
                {t('open.folder' as any)}
              </button>
            </div>
          </div>
        ) : (
          <div className="skills-list">
            {Object.entries(grouped).map(([category, catSkills]) => (
              <div key={category} className="skills-group">
                <div className="skills-group-label">{category}</div>
                <div className="skills-group-grid">
                  {catSkills.map(skill => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      injected={injectedIds.has(skill.id)}
                      onToggle={handleToggle}
                      onEdit={handleOpenFolder}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollPanel>



      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.9s linear infinite; }`}</style>
    </div>
  );
}
