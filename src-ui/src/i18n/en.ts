// i18n — English strings

export const en = {
  // App
  'app.title': 'Hedge Coding — Context Builder',

  // Explorer
  'explorer': 'EXPLORER',
  'open.folder': 'Open Folder',

  // Tabs
  'tab.hedge': 'Hedge Principles',
  'tab.repomap': 'Repo Map',
  'tab.superprompt': 'Super Prompt',
  'tab.skills': 'Mount Skills',
  'tab.costintel': 'Cost Intelligence',
  'tab.codereview': 'Code Review',
  'tab.docgen': 'Super Docs',

  // Empty states
  'empty.prompt': 'Open a project folder to compile your Super Prompt.',
  'empty.docgen': 'Open a project folder to generate Super Docs.',
  'empty.skills': 'Open a project folder to mount skills and rules.',
  'skills.banner.title': 'Mounting Skills',
  'skills.banner.desc': "You can mount lightweight development constraints and skills directly into the Super Prompt. By completely abandoning the uncontrollable filtering mechanisms of intermediary LLMs and AI coding assistants, we achieve true 'Zero-Distortion Full Injection': ensuring that your expensive development models see every single one of your 'iron rules' without compromise, fundamentally eliminating hallucinations and unauthorized coding decisions.",
  'empty.codereview': 'Open a project folder to enable code review.',
  'empty.repomap': 'Open a project folder to view the source architecture.',
  'empty.costintel': 'Loading model pricing from OpenRouter...',

  // RepoMap stats
  'stat.files.indexed': '{n} files indexed',
  'stat.symbols': '{n} symbols',

  // Builder (right panel)
  'builder': 'PROMPT BUILDER',
  'goal.placeholder': 'Describe what you want to build or change...',

  // Toast
  'compiler.scan_required': 'Scan Required',
  'compiler.waiting': 'Ready',
  'compiler.building': 'Building...',
  'compiler.compile_btn': 'Compile Super Prompt',
  'compiler.yield_est': 'Development Models',
  'compiler.est_cost': 'Est. Cost',
  'toast.compiled': 'Super Prompt compiled!',
  'toast.compile.failed': 'Compile failed: ',
  'toast.copied': 'Copied to clipboard!',
  'toast.review.compiled': 'Review Prompt compiled!',

  // Model Pricing
  'costintel.search': 'Search models...',
  'costintel.input': 'Input/$M',
  'costintel.output': 'Output/$M',
  'costintel.updated': 'Updated',

  // Deep analysis
  'deep.analysis': 'Deep Analysis',
  'deep.analysis.cached': 'Cached',

  // Repo status bar
  'status.scouting': 'Scouting repository...',
  'status.files': 'files',

  // Explorer footer
  'explorer.watching': 'Watching - {n} files',
  'explorer.no_folder': 'No folder open',

  // RepoMap grep & analyze
  'repomap.search.placeholder': 'Full-text search... e.g. "useState" or "TODO" or "unsafe"',
  'repomap.search.btn': 'Search',
  'repomap.search.matches': '{n} match(es) for',
  'repomap.search.limit': 'Showing first 200 matches — refine your pattern for more precise results.',
  'repomap.analyze.pause': 'Pause',
  'repomap.analyze.btn': 'Deep Analyze',
  'repomap.analyze.parsing': '◎ Parsing semantics...',

  // Skills
  'skills.search.placeholder': 'Search skills...',
  'skills.btn.search': 'Search',
  'skills.empty.title': 'Zero Skills Mounted',
  'skills.empty.sub': 'Create `.hedgecoding/skills/*.md` files to define reusable guidelines.',
  // RepoMap
  'repomap.grep': 'Grep',
  'repomap.clear': 'Clear',
  // SuperPrompt texts
  'task.small': 'Small',
  'task.medium': 'Medium',
  'task.large': 'Large',
  'superprompt.chars': '{n} chars',
  'superprompt.no_da': 'No Deep Analysis',
  'superprompt.da_partial': 'Deep Analysis ({n} files)',
  'superprompt.copy_path': 'Copy Path',
  'superprompt.goal': 'Goal',
  'superprompt.instructions': 'Instructions',
  'superprompt.context_hint': '+ Repo Map and File Context attached. Copy to view full output.',
  'superprompt.copied': 'Copied',
} as const;

export type I18nKey = keyof typeof en;
