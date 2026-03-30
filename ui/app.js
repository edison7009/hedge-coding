// Budget Coder — Desktop App (Tauri v2)

// Detect Tauri environment
const isTauri = !!window.__TAURI__;
const invoke = isTauri ? window.__TAURI__.core.invoke : null;

let scanData = null;
let selectedFiles = new Set();
let superPromptContent = '';
let currentTheme = localStorage.getItem('bc-theme') || 'dark';

// ─── Init ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initI18n();
    applyTheme(currentTheme);
    initEvents();
    loadScan();
    loadModel();
    autoGrow(document.getElementById('goal-input'));
});

function initEvents() {
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-select-all').addEventListener('click', selectAll);
    document.getElementById('btn-deselect-all').addEventListener('click', deselectAll);

    const goalInput = document.getElementById('goal-input');
    goalInput.addEventListener('input', () => {
        updateCompileBtn();
        autoGrow(goalInput);
    });
}

// ─── Theme ───────────────────────────────────────────

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    localStorage.setItem('bc-theme', currentTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ─── View Navigation ─────────────────────────────────

function switchView(name) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.getElementById('nav-' + name);
    if (navBtn) navBtn.classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + name);
    if (view) view.classList.add('active');

    // Show/hide file panel in sidebar
    const filePanel = document.getElementById('panel-files');
    filePanel.classList.toggle('active', name === 'files');
}

// ─── Model (loaded from models.json) ─────────────────

async function loadModel() {
    try {
        const model = isTauri
            ? await invoke('get_model')
            : await fetch('/api/model').then(r => r.json());

        document.getElementById('model-name').textContent = model.name;
        document.getElementById('model-name').removeAttribute('data-i18n');
        document.getElementById('model-url').textContent = model.base_url;

        const statusEl = document.getElementById('model-status');
        if (model.configured) {
            statusEl.textContent = '●';
            statusEl.className = 'model-badge-dot configured';
        } else {
            statusEl.textContent = '○';
            statusEl.className = 'model-badge-dot unconfigured';
        }
    } catch {
        document.getElementById('model-name').textContent = t('model.not.found');
        document.getElementById('model-url').textContent = 'models.json';
    }
}

// ─── Data Loading ────────────────────────────────────

async function loadScan() {
    try {
        scanData = isTauri
            ? await invoke('scan_project')
            : await fetch('/api/scan').then(r => r.json());

        setStatus(true, `${scanData.files.length} files`);
        document.getElementById('file-count-badge').textContent = scanData.files.length;
        renderFileTree(scanData.files);
        renderRepoMap(scanData.files);

        // Auto-select source files
        const srcExts = ['rs','js','jsx','ts','tsx','py','go','java','c','cpp','h','hpp','cs','rb','swift','kt'];
        scanData.files.forEach(f => {
            if (srcExts.includes(f.extension.toLowerCase())) {
                selectedFiles.add(f.relative_path);
            }
        });
        refreshTreeSelection();
        updateSelectedCount();
        updateCompileBtn();
    } catch (err) {
        setStatus(false, t('status.failed'));
        console.error(err);
    }
}

async function compilePrompt() {
    const goal = document.getElementById('goal-input').value.trim();
    if (!goal || selectedFiles.size === 0) return;

    const btn = document.getElementById('btn-compile');
    btn.disabled = true;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="spin"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="8"/></svg> ${t('compiling')}`;

    try {
        const data = isTauri
            ? await invoke('compile_prompt', {
                goal,
                selectedFiles: Array.from(selectedFiles),
                checklist: null,
              })
            : await fetch('/api/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal, selected_files: Array.from(selectedFiles) }),
              }).then(r => r.json());

        superPromptContent = data.super_prompt;
        renderCost(data.estimate);
        renderOutput(data.super_prompt);

        // Switch to output view
        switchView('output');
        document.getElementById('output-dot').classList.add('active');
        document.getElementById('btn-copy').disabled = false;
        document.getElementById('btn-download').disabled = false;

        toast(t('toast.compiled'), 'success');
    } catch (err) {
        toast(t('toast.compile.failed') + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09z"/></svg> ${t('compile')}`;
        updateCompileBtn();
    }
}

// ─── File Tree ───────────────────────────────────────

function renderFileTree(files) {
    const el = document.getElementById('file-tree');
    const tree = buildTree(files);
    el.innerHTML = renderTreeNode(tree);
}

function buildTree(files) {
    const root = {};
    files.forEach(f => {
        const parts = f.relative_path.split('/');
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node[parts[i]]) node[parts[i]] = {};
            node = node[parts[i]];
        }
        node[parts[parts.length - 1]] = f;
    });
    return root;
}

function renderTreeNode(node) {
    let html = '';
    const entries = Object.entries(node).sort(([a, av], [b, bv]) => {
        const aDir = isDir(av), bDir = isDir(bv);
        if (aDir !== bDir) return aDir ? -1 : 1;
        return a.localeCompare(b);
    });

    for (const [name, val] of entries) {
        if (isDir(val)) {
            const id = `d-${name}-${Math.random().toString(36).slice(2,7)}`;
            html += `<div class="tree-dir">
                <div class="tree-dir-header" onclick="togDir('${id}')">
                    <span class="tree-arrow" id="a-${id}">▾</span>
                    <span class="tree-icon">📁</span>
                    <span>${esc(name)}</span>
                </div>
                <div class="tree-children" id="${id}">${renderTreeNode(val)}</div>
            </div>`;
        } else {
            const f = val;
            const icon = fIcon(f.extension);
            const badge = f.symbols.length > 0 ? `${f.symbols.length} sym` : fmtSize(f.size);
            html += `<div class="tree-file" id="f-${cid(f.relative_path)}" onclick="togFile('${esc(f.relative_path)}')">
                <div class="tree-cb">✓</div>
                <span class="tree-icon">${icon}</span>
                <span class="tree-name">${esc(name)}</span>
                <span class="tree-badge">${badge}</span>
            </div>`;
        }
    }
    return html;
}

function isDir(v) { return typeof v === 'object' && !v.relative_path; }

function togDir(id) {
    const ch = document.getElementById(id);
    const ar = document.getElementById('a-' + id);
    ch.classList.toggle('collapsed');
    ar.classList.toggle('closed');
}

function togFile(path) {
    if (selectedFiles.has(path)) selectedFiles.delete(path);
    else selectedFiles.add(path);
    refreshTreeSelection();
    updateSelectedCount();
    updateCompileBtn();
}

function refreshTreeSelection() {
    if (!scanData) return;
    scanData.files.forEach(f => {
        const el = document.getElementById('f-' + cid(f.relative_path));
        if (el) el.classList.toggle('checked', selectedFiles.has(f.relative_path));
    });
}

function selectAll() {
    if (!scanData) return;
    scanData.files.forEach(f => selectedFiles.add(f.relative_path));
    refreshTreeSelection(); updateSelectedCount(); updateCompileBtn();
}

function deselectAll() {
    selectedFiles.clear();
    refreshTreeSelection(); updateSelectedCount(); updateCompileBtn();
}

// ─── Repo Map ────────────────────────────────────────

function renderRepoMap(files) {
    const el = document.getElementById('repo-map');
    const withSym = files.filter(f => f.symbols.length > 0);
    const totalSym = files.reduce((s, f) => s + f.symbols.length, 0);

    document.getElementById('stat-indexed').textContent = t('stat.files.indexed', { n: files.length });
    document.getElementById('stat-symbols').textContent = t('stat.symbols', { n: totalSym });

    if (withSym.length === 0) {
        el.innerHTML = `<div class="empty-state"><p>${t('no.symbols')}</p></div>`;
        return;
    }

    let html = '';
    for (const f of withSym) {
        html += `<div class="rm-file">`;
        html += `<span class="rm-fname">${esc(f.relative_path)}</span> <span class="rm-meta">(${f.line_count} lines)</span>\n`;
        for (const s of f.symbols) {
            const kc = kindClass(s.kind);
            html += `<div class="rm-sym">├─ <span class="${kc}">${s.kind.toLowerCase()}</span> ${esc(s.name)}</div>`;
        }
        html += `</div>`;
    }
    el.innerHTML = html;
}

// ─── Output ──────────────────────────────────────────

function renderCost(est) {
    document.getElementById('token-count').textContent = est.tokens.toLocaleString();
    const costs = est.costs;
    if (costs.length >= 3) {
        setPrice('cost-opus', costs[0].input_cost_usd);
        setPrice('cost-sonnet', costs[1].input_cost_usd);
        setPrice('cost-gpt4o', costs[2].input_cost_usd);
    }
}

function setPrice(id, usd) {
    const el = document.getElementById(id);
    el.textContent = '$' + usd.toFixed(4);
}

function renderOutput(content) {
    const el = document.getElementById('prompt-output');
    const truncated = content.length > 60000
        ? content.substring(0, 60000) + '\n\n... (truncated for display)'
        : content;
    el.innerHTML = `<pre class="prompt-pre">${esc(truncated)}</pre>`;
}

// ─── Actions ─────────────────────────────────────────

async function copyToClipboard() {
    if (!superPromptContent) return;
    try {
        await navigator.clipboard.writeText(superPromptContent);
        toast(t('toast.copied'), 'success');
    } catch { fallbackCopy(superPromptContent); }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(t('toast.copied'), 'success');
}

function downloadXml() {
    if (!superPromptContent) return;
    const blob = new Blob([superPromptContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'super-prompt.xml'; a.click();
    URL.revokeObjectURL(url);
    toast(t('toast.downloaded'), 'success');
}

// ─── UI Helpers ──────────────────────────────────────

function updateSelectedCount() {
    const n = selectedFiles.size;
    document.getElementById('selected-count').textContent =
        n === 0 ? t('files.selected.zero') : t('files.selected', { n, s: n !== 1 ? 's' : '' });
}

function updateCompileBtn() {
    const goal = document.getElementById('goal-input').value.trim();
    document.getElementById('btn-compile').disabled = !goal || selectedFiles.size === 0;
}

function setStatus(ok, text) {
    document.getElementById('status-dot').classList.toggle('ok', ok);
    document.getElementById('status-text').textContent = text;
}

function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(12px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, 2200);
}

// ─── Utils ───────────────────────────────────────────

function fIcon(ext) {
    const m = { rs:'🦀', js:'🟨', jsx:'⚛️', ts:'🔷', tsx:'⚛️', py:'🐍', go:'🔵', java:'☕',
                c:'⚙️', cpp:'⚙️', h:'⚙️', html:'🌐', css:'🎨', json:'📋', yaml:'📋', yml:'📋',
                md:'📝', toml:'⚙️', sh:'🖥️', sql:'🗄️', lock:'🔒', xml:'📋' };
    return m[ext] || '📄';
}

function kindClass(kind) {
    const m = { Function:'k-fn', Class:'k-class', Struct:'k-struct', Interface:'k-iface',
                TypeAlias:'k-type', Enum:'k-enum', Trait:'k-trait', Impl:'k-impl',
                Constant:'k-const', Export:'k-fn', Module:'k-mod' };
    return m[kind] || 'k-fn';
}

function fmtSize(b) { return b < 1024 ? b + ' B' : (b/1024).toFixed(1) + ' KB'; }
function cid(p) { return p.replace(/[^a-zA-Z0-9]/g, '-'); }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
