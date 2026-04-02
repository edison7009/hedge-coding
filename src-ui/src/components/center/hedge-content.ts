// hedge-content.ts — The 9 Rules of Hedge Coding content (English + Chinese)
// VI / VII / VIII updated to reflect the real features shipped in this upgrade.

export function getHedgePrinciplesEN(): string {
  return `
<h1>The 9 Rules of Hedge Coding</h1>
<p class="subtitle">Coding like a hedge fund &mdash; precision, risk aversion, and asymmetric returns.</p>
<p class="subtitle">Let cheap models gather intelligence, scout the codebase, and compile a Super Prompt; then feed these meticulously prepared top-tier ingredients and recipes to any model &mdash; even a novice chef can serve a Michelin feast. Make every Token you invest yield returns beyond expectations.</p>

<h2>The Hedge Philosophy</h2>
<p>Across benchmarks, prompt quality &mdash; context precision, instruction grounding, and signal-to-noise ratio &mdash; governs ~50% of output quality; the model tier contributes ~35%, the toolchain ~15%. A frontier model starved of context degrades to below-baseline performance. A mid-tier model fed surgical, high-signal context routinely outperforms it. The ceiling is not the model&rsquo;s weights &mdash; it&rsquo;s what fills its context window. Hedge Coding is architected around this single constraint: <strong>maximize context precision before a single inference token is spent</strong>.</p>
<p>Standard AI coding assistants burn <strong>~70% of tokens on blind exploration</strong> &mdash; scanning directories, re-reading files, building context from scratch. That&rsquo;s not investing, that&rsquo;s gambling. Hedge Coding replaces the gamble with a precision pipeline:</p>
<ol>
    <li><strong>Tactical Intelligence (Real-time sync)</strong> &mdash; Tree-sitter AST extracts every function signature and export into a surgical Repo Map (~2K&ndash;5K tokens). This is your real-time market intelligence.</li>
    <li><strong>Scout (~$0.001)</strong> &mdash; A cheap model acts as your scout: it identifies the relevant files, drafts an execution checklist, and selects applicable Skills from your knowledge library. Intelligence gathered &mdash; at pennies.</li>
    <li><strong>Combat Commander (Combined Arms)</strong> &mdash; Selected files + checklist + Skills are assembled into a structured XML Super Prompt &mdash; the finest ingredients, ready to serve. Paste it into any model. Watch it outperform.</li>
</ol>

<h2>Return on Investment & Success Rate</h2>
<table>
    <thead><tr><th>Metric</th><th>Standard Coding</th><th>Hedge Coding</th><th>Hedge Yield</th></tr></thead>
    <tbody>
        <tr><td><strong>Token Cost</strong></td><td>$1.95 (290K tokens)</td><td><strong>$0.94</strong> (60K tokens)</td><td><strong>52% Savings</strong></td></tr>
        <tr><td><strong>Zero-Shot</strong></td><td>~40% Hallucinations</td><td><strong>~85%</strong> Surgical</td><td><strong>+45% Accuracy</strong></td></tr>
        <tr><td><strong>Context Waste</strong></td><td>Re-reading files</td><td><strong>Zero-waste</strong> caching</td><td><strong>Compute goes to logic</strong></td></tr>
        <tr><td><strong>Pro Quota</strong></td><td>Exhausted in <strong>3&ndash;7 days</strong></td><td><strong>2&times; longer</strong> output</td><td><strong>+10 days runway</strong></td></tr>
    </tbody>
</table>
<blockquote>The pipeline cost per task is ~$0.002. But the real alpha isn&rsquo;t the savings &mdash; it&rsquo;s the <strong>first-try success rate</strong>.</blockquote>

<h2>The 9 Rules of Hedge Coding</h2>

<h3>I. Master session hygiene &mdash; Hedge Coding handles the rest</h3>
<p>Every message in a long session re-pays for the entire conversation history. Old tasks bloat the context, and costs compound with every reply. Yet starting a fresh session feels equally painful &mdash; your premium model knows nothing about your project and has to be re-briefed from scratch.</p>
<p><strong>The technique:</strong> Keep each session focused on a single task. Aim for 3&ndash;4 exchanges per cycle, then open a new session.</p>
<p><strong>With Hedge Coding:</strong> A cheap model recompiles your full project context in seconds. Fresh session, full context, zero ramp-up.</p>

<h3>II. Route tasks to the right model tier</h3>
<p>Every task lands on your most expensive model by default &mdash; translation, boilerplate, JSON conversion, renaming. None of these need project context.</p>
<p><strong>The technique:</strong> Before delegating any task, ask: does this require real knowledge of my codebase? If not, route it to a cheap model.</p>
<p><strong>With Hedge Coding:</strong> The Hedge Ledger shows live cost projections on 7 top-tier models &mdash; Claude Opus 4.6 Thinking, Sonnet 4.6 Thinking, Gemini 3.1 Pro, GPT-5.4 and more &mdash; so you always know exactly what each token costs before you pull the trigger.</p>

<h3>III. Lead with location, not discovery</h3>
<p>Vague instructions force your premium model to explore before it can act. You&rsquo;re paying for the investigation, not the fix.</p>
<p><strong>The technique:</strong> Always lead with location. File path, line number, what needs to change, and why. No open-ended exploration.</p>
<p><strong>With Hedge Coding:</strong> The Repo Map gives you the complete picture of function signatures and file structure before you open a session. Use the built-in <strong>Grep search</strong> to instantly find any symbol, pattern, or TODO across the entire codebase &mdash; zero tokens spent.</p>

<h3>IV. Never pay twice to read the same file</h3>
<p>Every session, your model re-reads the same files it read yesterday. Nothing changed. You&rsquo;re paying the same tokens to re-learn the same structure, over and over again.</p>
<p><strong>The technique:</strong> Keep a running reference. If you already know a file&rsquo;s structure, state it directly.</p>
<p><strong>With Hedge Coding:</strong> The Super Prompt compiles file content once at build time. No live file reads, no repeat exploration. Every compile is a zero-waste snapshot.</p>

<h3>V. Filter your knowledge library before every session</h3>
<p>Knowledge bases grow over time. Feeding everything into a premium model every session is expensive &mdash; most of it isn&rsquo;t relevant to the task at hand.</p>
<p><strong>The technique:</strong> Pre-filter what&rsquo;s relevant. Pass in only the knowledge that directly applies to today&rsquo;s task.</p>
<p><strong>With Hedge Coding:</strong> Each Skill now carries a <strong>when_to_use</strong> field &mdash; a one-line signal that tells the model exactly when to apply it. Only the right Skills get injected. Every token earns its place.</p>

<h3>VI. Your Super Prompt is self-contained &mdash; carry your rules into any AI tool</h3>
<p>Every time you open Claude Code, Cursor, ChatGPT, or any other AI coding tool in a fresh session, it knows nothing about your project. You re-explain the same conventions, architecture constraints, and off-limits. You&rsquo;re paying for the briefing before the real work even starts.</p>
<p><strong>The technique:</strong> Encode your project conventions once in a persistent file. Embed it into every context package you hand to an AI &mdash; so the tool arrives fully briefed, regardless of which session or tool it is.</p>
<p><strong>With Hedge Coding:</strong> <strong>Project Memory</strong> (<code>.hedgecoding/MEMORY.md</code>) is compiled <em>inside</em> the Super Prompt itself. When you paste that Super Prompt into Claude Code, Cursor, or any AI tool, your project rules are already embedded in the payload. The Super Prompt is self-contained &mdash; no re-briefing, no wasted warm-up tokens. The tool arrives ready to execute.</p>

<h3>VII. Plan before you code</h3>
<p>Jumping straight to code generation on complex tasks leads to mid-session course corrections, wasted output, and expensive backtracking. The model writes code, you review it, realize it went the wrong direction, and pay again from scratch.</p>
<p><strong>The technique:</strong> For any non-trivial task, get the model to articulate a detailed implementation plan first. Validate the approach before a single line of production code is written.</p>
<p><strong>With Hedge Coding:</strong> The Super Prompt delivers surgical context so your premium model can reason about architecture confidently. Simply ask it to plan first &mdash; it has everything it needs to produce a structured implementation plan (approach, files affected, steps, risks) before any code is generated. Hedge Coding compiles the intelligence; you decide the mission.</p>

<h3>VIII. Engineer your goal description &mdash; it is the precision ceiling</h3>
<p>Perfect context means nothing if the goal is vague. Even a frontier model with a surgical Repo Map and fully injected Skills will hallucinate direction when the task instruction is ambiguous. <strong>Garbage in, garbage out &mdash; regardless of context quality.</strong> The model cannot compensate for an imprecise mandate.</p>
<p><strong>The technique:</strong> Write your goal like an engineering spec. State what success looks like, what must not change, and what has recently shifted in the codebase. The tighter the goal, the tighter the output.</p>
<p><strong>With Hedge Coding:</strong> The Scout model takes your raw goal and performs <strong>goal refinement</strong> &mdash; distilling it into a structured <code>refined_goal</code> and a step-by-step <code>execution_instructions</code> checklist before the Super Prompt is assembled. The more precise your input, the more surgical the checklist. Your goal description is not just a request &mdash; it is the <strong>inference quality ceiling</strong> for everything that follows.</p>

<h3>IX. Read everything. Write nothing.</h3>
<p>Most AI coding tools write directly to your files. Errors compound, files get overwritten, and you end up spending as much time auditing AI output as you would have writing code yourself.</p>
<p><strong>The technique:</strong> Treat your AI model as a highly capable advisor, not an autonomous executor. Review every suggestion before applying it.</p>
<p><strong>With Hedge Coding:</strong> Zero write capability &mdash; by design. Hedge Coding reads, indexes, and compiles. It is a read-only Super Prompt compiler. Code generation belongs entirely to your chosen model. You stay in control.</p>
`;
}

export function getHedgePrinciplesZH(): string {
  return `
<h1>对冲编程的 9 条军规</h1>
<p class="subtitle">像对冲基金一样编程 &mdash;&mdash; 精准、避险、非对称收益。</p>
<p class="subtitle">让廉价模型收集情报、侦察代码库、编译超级提示词；再把这些精心备好的顶尖食材和食谱，投喂给任何模型 &mdash;&mdash; 哪怕是新手厨师，也能端出米其林盛宴。让你投入的每一枚 Token，都获得超预期的回报。</p>

<h2>对冲哲学</h2>
<p>基准测试表明，提示词质量——上下文精度、指令接地（instruction grounding）、信噪比（signal-to-noise ratio）——决定约 50% 的输出质量；模型层级贡献约 35%，工具链仅占 15%。一个顶尖的 frontier model，一旦失去高质量上下文，其表现会跌破基准线；而一个中等模型，在外科手术级的高信号上下文（high-signal context）加持下，可以持续超越前者。天花板不是模型权重——是你往 context window 里装了什么。Hedge Coding 围绕这一约束构建：<strong>在消耗任何一枚推理 Token 之前，先将上下文精度最大化</strong>。</p>
<p>传统 AI 编程助手有 <strong>~70% 的 Token 在盲目探索中烧掉</strong> &mdash; 扫描目录、反复读文件、从零构建上下文。这不是投资，这是赌博。对冲编程用精准管道取代赌博：</p>
<ol>
    <li><strong>战术情报（实时同步）</strong> &mdash; Tree-sitter AST 提取每一个函数签名与导出，生成精准的 Repo Map（约 2K&ndash;5K tokens）。这是你的实时市场情报。</li>
    <li><strong>侦察兵（~$0.001）</strong> &mdash; 廉价模型充当你的侦察兵：锁定相关文件、输出执行清单、从知识库中匹配最合适的 Skills。情报收集完毕 &mdash; 成本仅需几分钱。</li>
    <li><strong>作战指挥官（重装合成旅）</strong> &mdash; 筛选文件 + 清单 + Skills 组装成结构化 XML Super Prompt &mdash; 顶尖食材，备齐上桌。粘贴进任何模型，看它超预期输出。</li>
</ol>

<h2>投资回报率与开发成功率</h2>
<table>
    <thead><tr><th>维度</th><th>传统编程</th><th>对冲编程</th><th>对冲收益</th></tr></thead>
    <tbody>
        <tr><td><strong>Token 消耗</strong></td><td>$1.95 (290K tokens)</td><td><strong>$0.94</strong> (60K tokens)</td><td><strong>立省 52% 成本</strong></td></tr>
        <tr><td><strong>Zero-Shot</strong></td><td>~40% 频繁幻觉</td><td><strong>~85%</strong> 精准指引</td><td><strong>出活率翻倍</strong></td></tr>
        <tr><td><strong>上下文浪费</strong></td><td>重复阅读无关文件</td><td><strong>零浪费</strong> 按需打包</td><td><strong>算力全用于推理逻辑</strong></td></tr>
        <tr><td><strong>订阅限额</strong></td><td>配额 <strong>3~7 天</strong>耗尽</td><td><strong>多撑 2 倍</strong> 开发量</td><td><strong>每月多 10 天满血</strong></td></tr>
    </tbody>
</table>
<blockquote>管道单次成本约 $0.002。但真正的超额回报绝不仅是省钱 &mdash; 而是 <strong>“一发入魂” 的极高开发成功率</strong>。</blockquote>

<h2>对冲编程的 9 条军规</h2>

<h3>一、巧用新会话 + 对冲编程辅助</h3>
<p>会话越长，每条消息都要为更早的对话支付额外账单。旧任务不断膨胀上下文，账单水涨船高。</p>
<p><strong>建议的工作方式：</strong>不同的任务开启新的会话，尽量保持在 3~4 条对话为一个循环。</p>
<p><strong>对冲编程辅助：</strong>廉价模型在几秒内重新编译完整上下文。全新会话，完整上下文，无需预热。</p>

<h3>二、把任务路由到正确的模型层级</h3>
<p>每一个任务默认都落到你最贵的模型上——翻译、写模板代码、JSON 转换、字段重命名。这些任务根本不需要项目上下文。</p>
<p><strong>建议的工作方式：</strong>接到任何任务前，先问：这需要真正了解我的代码库吗？如果不需要，交给廉价模型。</p>
<p><strong>对冲编程加持：</strong><strong>Hedge Ledger</strong> 实时显示 7 个顶尖模型的成本对比——Claude Opus 4.6 Thinking、Sonnet 4.6 Thinking、Gemini 3.1 Pro、GPT-5.4 等——让你在按下发送键前就清楚每一枚 Token 的价格。</p>

<h3>三、指令先给位置，再给任务</h3>
<p>模糊的指令会强迫高端模型先探索才能行动。你在为调查过程付费，而不是为修复本身。</p>
<p><strong>建议的工作方式：</strong>永远先给位置。文件路径、行号、需要改什么、为什么改。不允许开放式探索。</p>
<p><strong>对冲编程加持：</strong>Repo Map 在你打开会话前就给你完整的函数签名和文件结构全貌。内置 <strong>Grep 全文搜索</strong>，在整个代码库中瞬间定位任意符号、模式或 TODO——零 Token 消耗。</p>

<h3>四、不要为读过的文件重复付费</h3>
<p>每次会话，模型都在重新读取昨天读过的文件。你在用同样的 Token 反复重学同样的结构。</p>
<p><strong>建议的工作方式：</strong>维护一份持续更新的参考记录。如果你已经知道某个文件的结构，直接陈述。</p>
<p><strong>对冲编程加持：</strong>Super Prompt 在编译时一次性打包文件内容。没有实时文件读取，没有重复探索。每次编译都是零浪费的精准快照。</p>

<h3>五、每次会话前先过滤你的知识库</h3>
<p>知识库和技能库会随时间增长。把所有内容每次都塞给高端模型代价高昂——而且大部分内容跟当前任务完全无关。</p>
<p><strong>建议的工作方式：</strong>打开会话前，手动预过滤相关内容。只传入直接适用于今天任务的知识和技能。</p>
<p><strong>对冲编程加持：</strong>每个 Skill 现在都携带 <strong>when_to_use</strong> 字段——一行信号告诉模型何时应用它。只有正确的 Skills 会被注入。每个 Token 都物有所值。</p>

<h3>六、Super Prompt 自带说明——项目规则随 Prompt 带进任何 AI 工具</h3>
<p>每次打开 Claude Code、Cursor、ChatGPT 或任何 AI 编程工具的新会话，它对你的项目一无所知。你重新交代同样的规范、架构约束、操作禁区——在真正工作开始之前，先付费做了一次情况汇报。</p>
<p><strong>建议的工作方式：</strong>把项目规范写进一个持久文件，每次给 AI 传递上下文时把它嵌入进去——无论用哪个工具、经过多少次新会话，AI 到场时就已全部到位。</p>
<p><strong>对冲编程加持：</strong><strong>Project Memory</strong>（<code>.hedgecoding/MEMORY.md</code>）被编译<em>进入</em> Super Prompt 本身。当你把 Super Prompt 粘贴进 Claude Code、Cursor 或任何 AI 工具时，你的项目规则、规范和架构说明已经<strong>随 Prompt 打包进去了</strong>。Super Prompt 是自包含的——不需要重新交代，不浪费一分钱预热 Token，工具到场即可执行。</p>

<h3>七、先规划，再写代码</h3>
<p>复杂任务直接上代码生成，往往导致会话中途改方向、浪费输出、昂贵回滚。模型写了代码，你审查后发现方向错了，只能从头再来，再付一次。</p>
<p><strong>建议的工作方式：</strong>任何非平凡任务，先让模型输出详细的实现计划。在生产代码诞生之前，先验证方向。</p>
<p><strong>对冲编程加持：</strong>Super Prompt 提供了外科手术级的精准上下文，让高端模型可以自信地推理架构。你只需要要求它先做规划——它已经拥有产出结构化实现计划所需的一切（方案、受影响文件、步骤、风险）。对冲编程编译情报，你来决定任务。</p>

<h3>八、打磨你的任务描述——它是推理质量的精度上限</h3>
<p>完美的上下文，遇上模糊的目标，照样生产模糊的结果。哪怕是顶尖 frontier model，拥有外科手术级 Repo Map、完整注入的 Skills，一旦任务指令含糊，依然会在方向上产生幻觉。<strong>垃圾输入，垃圾输出——无论上下文质量有多高。</strong>模型无法代替你给出一个精准的任务授权。</p>
<p><strong>建议的工作方式：</strong>像写工程规范一样描述你的目标。说清楚成功是什么样的、什么不能动、代码库最近发生了什么变化。目标越紧致，输出越精准。</p>
<p><strong>对冲编程加持：</strong>侦察模型接收你的原始目标后，执行<strong>目标提炼（goal refinement）</strong>——将其提炼为结构化的 <code>refined_goal</code> 和逐步执行的 <code>execution_instructions</code> 清单，再组装 Super Prompt。你的输入越精准，清单越外科手术级。你的任务描述不只是一个请求——它是整个推理链的<strong>质量上限（inference quality ceiling）</strong>。</p>

<h3>九、读遍一切。不改一行。</h3>
<p>大多数 AI 编程工具直接写入你的文件。错误累积，文件被覆盖，你花在审查 AI 输出上的时间和自己写代码一样多。</p>
<p><strong>建议的工作方式：</strong>把 AI 模型当成一个能力极强的顾问，而不是自主执行者。每一条建议都在应用之前审查。</p>
<p><strong>对冲编程加持：</strong>零写入能力——这是刻意的设计。Hedge Coding 是一个只读的 Super Prompt 编译器：只读取、索引、编译。代码生成完全属于你选择的模型。你始终掌握控制权。</p>
`;
}
