
GitHub 上确实存在类似项目，但没有一个完全匹配你的「Budget Coder」规格。以下是最接近的现有项目：

现有相关项目
项目	GitHub链接	相似度	区别
Aider	github.com/paul-gauthier/aider	⭐⭐⭐⭐	终端式AI编码助手，有repo map功能，但直接编辑文件而非输出Super Prompt
Continue	github.com/continuedev/continue	⭐⭐⭐⭐	VSCode/JetBrains IDE扩展，上下文感知代码补全，开源
Repopack	被提及但未找到确切repo	⭐⭐⭐	将整个codebase打包成AI友好的XML/Markdown，正是你需要的思路
Repopilot	github.com/99x/repopilot	⭐⭐⭐	GPT驱动的repo导航工具
smol-ai/developer	github.com/smol-ai/developer	⭐⭐	AI代理解释和编辑codebase
最接近的项目：Aider
Aider 已有 repo map 功能（正如你的规格引用），但工作流略有不同：

✅ 读取目录树并理解项目结构
✅ 支持便宜模型（如Claude 3 Haiku）
❌ 但它是直接编辑文件，不输出「Super Prompt」
❌ 主要是交互式CLI工具，不是GUI应用
建议
你的「Budget Coder」项目在以下方面是原创的：

明确的廉价模型→贵模型的分工：cheap model生成结构化prompt → expensive model执行
GUI + Echobird 集成：比纯CLI工具更易用
XML Super Prompt 格式：为Anthropic prompt caching优化
Token预估 + 成本透明化
下一步建议
可以在GitHub上搜索或创建这个项目时：

参考 Aider 的 repo map 实现
借鉴 Repopack 的打包思路
参考 Continue 的 Tauri/Rust 整合方式
作为全新项目发布，填补这个空白
你想在 GitHub 创建这个项目的仓库吗？🚀