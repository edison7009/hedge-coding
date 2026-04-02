// App.tsx — 3-panel IDE layout (frameless window)

import { useEffect } from 'react';
import { useAppState } from './store/app-state';
import { isTauri, retryInvoke, commands } from './tauri';
import { TitleBar } from './components/common/TitleBar';
import { Explorer } from './components/left/Explorer';
import { CenterPanel } from './components/center/CenterPanel';
import { Compiler } from './components/right/Compiler';
import './styles/global.css';

export function App() {
  const { state, dispatch } = useAppState();

  // Apply theme on mount and change — must sync with the inline script in index.html
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.currentTheme);
    try { localStorage.setItem('hc-theme', state.currentTheme); } catch {}
  }, [state.currentTheme]);

  // Startup: resolve IPC, load model config, auto-scan last folder
  useEffect(() => {
    const timer = setTimeout(async () => {
      retryInvoke();

      try {
        const model = await commands.loadModel();
        dispatch({ type: 'SET_MODEL', model });
      } catch (e) {
        console.warn('[HC] loadModel failed:', e);
      }

        if (state.folderPath && isTauri) {
          try {
            const data = await commands.scanFolder(state.folderPath);
            dispatch({ type: 'SET_SCAN', data });
          } catch (e) {
            console.warn('[HC] Auto-scan failed:', e);
          }

          try {
            const rawHistory = await commands.loadPromptHistory(state.folderPath);
            const history = rawHistory.map((r) => ({
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
        }
      }, 100);
      return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Custom titlebar — drag region + minimize / maximize / close */}
      <TitleBar />

      {/* 3-panel workspace */}
      <div className="app-layout">
        {/* Left: File Explorer (contains brand + controls in its header) */}
        <aside className="panel panel-left">
          <Explorer />
        </aside>

        {/* Center: Tab content area */}
        <main className="panel panel-center">
          <CenterPanel />
        </main>

        {/* Right: Compiler / cost estimator */}
        <aside className="panel panel-right">
          <Compiler />
        </aside>
      </div>
    </>
  );
}
