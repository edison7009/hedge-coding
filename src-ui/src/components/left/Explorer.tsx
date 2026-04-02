// Explorer.tsx — Left panel: brand, folder open, file tree

import { useState, useMemo } from 'react';
import { useAppState } from '../../store/app-state';
import { useT } from '../../i18n/useT';
import { commands, isTauri } from '../../tauri';
import { ScrollPanel } from '../common/ScrollPanel';
import type { FileEntry, PromptHistoryRaw } from '../../tauri';
import './Explorer.css';

function formatBytes(b: number) {
  return b < 1024 ? b + ' B' : (b / 1024).toFixed(1) + ' KB';
}

function getFileIcon(ext: string): string {
  const m: Record<string, string> = {
    rs: 'rs.svg', js: 'js.svg', jsx: 'jsx.svg', ts: 'ts.svg', tsx: 'tsx.svg',
    py: 'py.svg', go: 'go.svg', java: 'java.svg', c: 'c.svg', cpp: 'cpp.svg',
    h: 'cpp.svg', html: 'html.svg', css: 'css.svg', json: 'json.svg',
    md: 'md.svg', toml: 'toml.svg', sh: 'sh.svg', pyw: 'py.svg',
  };
  return m[ext.toLowerCase()] || 'file.svg';
}

// ─── Recursive File Tree ───────────────────────────────────────────────────────

type TreeLeaf = { type: 'file'; data: FileEntry };
type TreeNode = { type: 'dir'; name: string; children: Record<string, TreeNode | TreeLeaf> };

function buildTree(files: FileEntry[]) {
  const root: TreeNode = { type: 'dir', name: '', children: {} };
  
  files.forEach(f => {
    const parts = f.relative_path.split('/');
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!current.children[p]) {
        current.children[p] = { type: 'dir', name: p, children: {} };
      }
      current = current.children[p] as TreeNode;
    }
    const fileName = parts[parts.length - 1];
    current.children[fileName] = { type: 'file', data: f };
  });

  return root;
}

function DirNode({ name, node }: { name: string, node: TreeNode }) {
  const [open, setOpen] = useState(false);

  const children = Object.entries(node.children).sort(([aK, aV], [bK, bV]) => {
    const aIsDir = aV.type === 'dir';
    const bIsDir = bV.type === 'dir';
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return aK.localeCompare(bK);
  });

  return (
    <div className="tree-dir">
      <div className={`tree-dir-header ${open ? '' : 'collapsed'}`} onClick={() => setOpen(!open)}>
        <span className={`tree-arrow ${open ? '' : 'closed'}`}>▾</span>
        <span className="tree-icon">
          <img src={open ? '/icons/folder-open.svg' : '/icons/folder-closed.svg'} alt="dir" className="icon-svg" />
        </span>
        <span className="tree-name">{name}</span>
      </div>
      {open && (
        <div className="tree-children">
          {children.map(([childName, childNode]) => (
            childNode.type === 'dir'
              ? <DirNode key={childName} name={childName} node={childNode} />
              : <FileNode key={childName} name={childName} file={childNode.data} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileNode({ name, file }: { name: string, file: FileEntry }) {
  const icon = getFileIcon(file.extension);
  const badge = file.symbols.length > 0 ? `${file.symbols.length} sym` : formatBytes(file.size);

  return (
    <div className="tree-file">
      <span className="tree-icon">
        <img src={`/icons/${icon}`} alt="err" className="icon-svg" onError={(e) => (e.currentTarget.src = '/icons/file.svg')} />
      </span>
      <span className="tree-fname">{name}</span>
      <span className="tree-badge">{badge}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function Explorer() {
  const { state, dispatch } = useAppState();
  const t = useT();

  const files = state.scanData?.files || [];
  const isWatching = !!state.folderPath;

  const toggleTheme = () => {
    dispatch({ type: 'SET_THEME', theme: state.currentTheme === 'dark' ? 'light' : 'dark' });
  };
  const toggleLang = () => {
    const next = state.currentLang === 'en' ? 'zh-CN' : 'en';
    dispatch({ type: 'SET_LANG', lang: next });
    try { localStorage.setItem('hc-lang', next); } catch {}
  };

  const [recentFolders, setRecentFolders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hc-recent-folders') || '[]');
    } catch {
      return [];
    }
  });

  const doOpenFolder = async (folderPath: string) => {
    try {
      dispatch({ type: 'SET_FOLDER', path: folderPath });
      dispatch({ type: 'SET_TAB', tab: 'repomap' });

      try {
        localStorage.setItem('hc-folder', folderPath);
        const recents = [folderPath, ...recentFolders.filter(p => p !== folderPath)].slice(0, 3);
        localStorage.setItem('hc-recent-folders', JSON.stringify(recents));
        setRecentFolders(recents);
      } catch {}

      // Load initial model state
      await commands.loadModel().then(
        m => dispatch({ type: 'SET_MODEL', model: m }),
        () => {} // Safe to ignore
      );

      // Scan initial
      const data = await commands.scanFolder(folderPath);
      dispatch({ type: 'SET_SCAN', data });

      try {
        const cached = await commands.loadCachedAnalysis();
        if (cached && typeof cached === 'object') {
          dispatch({ type: 'SET_AI_SUMMARIES', summaries: cached });
        }
      } catch {}

      try {
        const raw = await commands.loadPromptHistory(folderPath);
        const history = raw.map((r: PromptHistoryRaw) => ({
          id: r.id ?? String(r.timestamp ?? Date.now()),
          promptPath: r.prompt_path ?? '',
          fullContent: r.full_content ?? '',
          goalSnippet: r.goal_snippet ?? '',
          instructionsSnippet: r.instructions_snippet ?? '',
          meta: {
            taskSize: r.task_size ?? '',
            daCoverage: r.da_coverage ?? 'none',
            daFiles: r.da_files ?? 0,
            charCount: r.char_count ?? 0,
            tokenEst: r.token_est ?? 0,
          },
          timestamp: r.timestamp ?? 0,
        }));
        dispatch({ type: 'SET_SUPER_PROMPT_HISTORY', history });
      } catch {}

    } catch (e) {
      console.error('[HC] error opening folder', e);
    }
  };

  const openFolder = async () => {
    try {
      let folderPath: string | null = null;
      if (isTauri) {
        folderPath = await commands.pickFolder();
      }
      if (!folderPath) return;
      await doOpenFolder(folderPath);
    } catch (e) {
      console.error('[HC] error picking folder', e);
    }
  };

  const closeFolder = () => {
    dispatch({ type: 'CLEAR_FOLDER' });
    try { localStorage.removeItem('hc-folder'); } catch {}
  };

  const treeRoot = useMemo(() => buildTree(files), [files]);

  return (
    <div className="panel panel-left explorer-panel">
      {/* Brand + theme/lang controls */}
      <div className="panel-header">
        <div className="brand">
          <svg
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" className="brand-icon"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M12 2L2 22h20L12 2z"/>
          </svg>
          <span>Hedge Coding</span>
        </div>
        
        <div className="window-controls">
          <button className="icon-btn xs" onClick={toggleTheme}>
            {state.currentTheme === 'dark' ? '🌙' : '☀️'}
          </button>
          <button className="icon-btn xs lang-btn" onClick={toggleLang}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 8 6 6" />
              <path d="m4 14 6-6 2-3" />
              <path d="M2 5h12" />
              <path d="M7 2h1" />
              <path d="m22 22-5-10-5 10" />
              <path d="M14 18h6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Explorer section header */}
      <div className="panel-header section-title" style={{ borderBottom: '1px solid var(--border)', padding: '8px 16px' }}>
        <span className="panel-label">{t('explorer')}</span>
        <div className="section-actions">
          {state.folderPath && (
            <button
              className="icon-btn xs"
              id="btn-close-folder"
              onClick={closeFolder}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <button onClick={openFolder} className="icon-btn xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
          </button>
        </div>
      </div>


      {/* File list Content */}
      <div className="panel-content explorer-content">
        {!state.folderPath ? (
          <div className="empty-state" style={{ justifyContent: 'center' }}>
            <button className="open-folder-btn" onClick={openFolder} id="btn-open-folder-welcome">
              {t('open.folder')}
            </button>
            {recentFolders.length > 0 && (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', width: '100%', padding: '0 20px' }}>
                {recentFolders.map((rf: string) => (
                  <div key={rf} className="recent-folder-item" onClick={() => doOpenFolder(rf)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', color: 'var(--accent)', background: 'var(--bg-2)', width: '100%', maxWidth: '220px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rf}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !state.scanData ? (
          <ScrollPanel>
            <div className="file-tree-container" style={{ pointerEvents: 'none' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', opacity: Math.max(0.1, 1 - i * 0.08) }}>
                  <div className="shimmer-box" style={{ width: 14, height: 14, borderRadius: 2, flexShrink: 0 }}></div>
                  <div className="shimmer-box" style={{ width: `${30 + (i * 7) % 40}%`, height: 12, borderRadius: 2 }}></div>
                </div>
              ))}
            </div>
          </ScrollPanel>
        ) : (
          <ScrollPanel>
            <div className="file-tree-container">
              {Object.entries(treeRoot.children).map(([name, node]) => (
                node.type === 'dir'
                  ? <DirNode key={name} name={name} node={node} />
                  : <FileNode key={name} name={name} file={node.data} />
              ))}
            </div>
          </ScrollPanel>
        )}
      </div>

      {/* Status Footer */}
      <div className="panel-footer status-bar" id="explorer-status">
        {isWatching ? t('explorer.watching' as any, { n: files.length }) : t('explorer.no_folder' as any)}
      </div>
    </div>
  );
}
