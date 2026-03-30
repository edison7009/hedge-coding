// Budget Coder — Internationalization (i18n)
// Supported: English (en), Simplified Chinese (zh-CN)

const I18N = {
    en: {
        // Title bar
        'app.title': 'Budget Coder — Context Builder',

        // Navigation
        'nav.workspace': 'Workspace',
        'nav.files': 'Files',
        'nav.output': 'Output',
        'greeting.title': 'Let\'s build',
        'greeting.sub': 'Let cheap models read, let expensive models write.',
        'output.empty': 'Compile a Super Prompt to see the output here.',

        // Explorer
        'explorer': 'EXPLORER',
        'repomap': 'Repo Map',
        'select.all': 'Select All',
        'deselect.all': 'Deselect All',
        'files.selected': '{n} file{s} selected',
        'files.selected.zero': '0 files selected',

        // Editor tabs
        'tab.repomap': 'Repo Map',
        'tab.superprompt': 'Super Prompt',

        // Empty state
        'empty.prompt': 'Enter a goal and click <strong>Compile</strong> to generate your Super Prompt',

        // Status bar
        'status.connecting': 'Connecting...',
        'status.failed': 'Connection failed',
        'stat.files.indexed': '{n} files indexed',
        'stat.symbols': '{n} symbols',

        // Prompt Builder
        'builder': 'PROMPT BUILDER',
        'budget.model': 'Budget Model',
        'payload.estimation': 'Payload Estimation',
        'tokens': 'tokens',
        'copy.xml': 'Copy XML',
        'download': 'Download',
        'goal.label': 'Implementation Goal',
        'goal.placeholder': 'Describe what you want to build or change...',
        'goal.hint': 'Be specific for better file selection',
        'compile': 'Compile',
        'compiling': 'Compiling...',

        // Model
        'model.loading': 'Loading...',
        'model.configured': 'API key configured',
        'model.not.configured': 'API key not configured',
        'model.not.found': 'Not configured',
        'model.fastest': 'Fastest, cheapest',
        'model.balanced': 'Fast, balanced',
        'model.openai': 'OpenAI compatible',
        'model.local': 'Free, runs locally',

        // Toasts
        'toast.compiled': 'Super Prompt compiled!',
        'toast.compile.failed': 'Compile failed: ',
        'toast.copied': 'Copied to clipboard!',
        'toast.downloaded': 'Downloaded super-prompt.xml',

        // Repo Map
        'no.symbols': 'No symbols extracted',
    },

    'zh-CN': {
        // Title bar
        'app.title': 'Budget Coder — 上下文构建器',

        // Navigation
        'nav.workspace': '工作区',
        'nav.files': '文件',
        'nav.output': '输出',
        'greeting.title': '开始构建',
        'greeting.sub': '让廉价模型读代码，让昂贵模型写代码。',
        'output.empty': '编译超级提示词后结果将显示在此处。',

        // Explorer
        'explorer': '资源管理器',
        'repomap': '代码地图',
        'select.all': '全选',
        'deselect.all': '取消全选',
        'files.selected': '已选择 {n} 个文件',
        'files.selected.zero': '未选择文件',

        // Editor tabs
        'tab.repomap': '代码地图',
        'tab.superprompt': '超级提示词',

        // Empty state
        'empty.prompt': '输入目标并点击 <strong>编译</strong> 来生成超级提示词',

        // Status bar
        'status.connecting': '连接中...',
        'status.failed': '连接失败',
        'stat.files.indexed': '已索引 {n} 个文件',
        'stat.symbols': '{n} 个符号',

        // Prompt Builder
        'builder': '提示词构建器',
        'budget.model': '廉价模型',
        'payload.estimation': '负载估算',
        'tokens': '个 Token',
        'copy.xml': '复制 XML',
        'download': '下载',
        'goal.label': '实现目标',
        'goal.placeholder': '描述你想要构建或修改的内容...',
        'goal.hint': '描述越具体，文件选择越精准',
        'compile': '编译',
        'compiling': '编译中...',

        // Model
        'model.loading': '加载中...',
        'model.configured': 'API 密钥已配置',
        'model.not.configured': 'API 密钥未配置',
        'model.not.found': '未配置',
        'model.fastest': '最快最便宜',
        'model.balanced': '快速均衡',
        'model.openai': 'OpenAI 兼容',
        'model.local': '免费，本地运行',

        // Toasts
        'toast.compiled': '超级提示词编译完成！',
        'toast.compile.failed': '编译失败：',
        'toast.copied': '已复制到剪贴板！',
        'toast.downloaded': '已下载 super-prompt.xml',

        // Repo Map
        'no.symbols': '未提取到符号',
    }
};

// ─── i18n Engine ─────────────────────────────────────

let currentLang = 'en';

/**
 * Initialize i18n: detect browser language, apply saved preference
 */
function initI18n() {
    const saved = localStorage.getItem('bc-lang');
    if (saved && I18N[saved]) {
        currentLang = saved;
    } else {
        // Auto-detect from browser
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang.startsWith('zh')) {
            currentLang = 'zh-CN';
        } else {
            currentLang = 'en';
        }
    }
    applyI18n();
    updateLangButton();
}

/**
 * Get a translated string by key, with optional interpolation
 * @param {string} key - Translation key
 * @param {object} params - Parameters for interpolation, e.g. { n: 5 }
 * @returns {string}
 */
function t(key, params) {
    const dict = I18N[currentLang] || I18N['en'];
    let str = dict[key] || I18N['en'][key] || key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
        // Handle plural {s} — empty if n=1, 's' otherwise
        if (params.n !== undefined) {
            str = str.replace(/\{s\}/g, params.n === 1 ? '' : 's');
        }
    }
    return str;
}

/**
 * Switch language and re-apply all translations
 */
function switchLang(lang) {
    if (!I18N[lang]) return;
    currentLang = lang;
    localStorage.setItem('bc-lang', lang);
    applyI18n();
    updateLangButton();
}

/**
 * Toggle between supported languages
 */
function toggleLang() {
    switchLang(currentLang === 'en' ? 'zh-CN' : 'en');
}

/**
 * Apply translations to all elements with data-i18n attributes
 */
function applyI18n() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // innerHTML (for strings with markup)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key);
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Titles (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    // Update html lang attribute
    document.documentElement.lang = currentLang === 'zh-CN' ? 'zh-CN' : 'en';
}

/**
 * Update the language toggle button text
 */
function updateLangButton() {
    const label = document.getElementById('lang-label');
    const btn = document.getElementById('btn-lang');
    if (label) {
        label.textContent = currentLang === 'en' ? '中文' : 'EN';
    }
    if (btn) {
        btn.title = currentLang === 'en' ? 'Switch to Chinese' : 'Switch to English';
    }
}
