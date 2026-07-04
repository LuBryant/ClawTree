# ClawTree（树爪智动）

> AI × Web3 × Media Growth OS for TreeFinance campus campaigns.

ClawTree 是为大树财经打造的 **AI 媒体活动增长操作系统**：把分散在 X、高校官网、活动平台和公开内容源里的信号，转成可审核的选题、合作名单、逐校外联草稿、回复漏斗与隐私安全的链上执行凭证。

它不是活动黄页，也不是自动群发器。ClawTree 的核心判断是：媒体与高校合作真正缺的不是“更多内容”，而是一个能把 **趋势发现 → 可信判断 → 人审行动 → 可验证影响力** 串起来的操作系统。

    公开内容闭环：X / 高校 / 活动源 → 分类去重 → 合规编辑 → 人审发布 → /user
    合作增长闭环：高校活动 → 联系证据 → 契合分析 → 逐校提案 → 人审外联 → 回复复盘 → Proof

## 一句话 Demo

在 3 分钟内，ClawTree 可以演示：

1. 从公开信号中识别「世界杯 × 广州高校行 × AI/Web3」campaign 机会。
2. 匹配广州高校与活动组织，保留来源证据和推荐合作形式。
3. 生成一校一稿的 AI 外联草稿，并完成 guardrail 检查。
4. 经过人工批准后模拟发送，解析正向回复。
5. 生成不含联系人、邮件正文和隐私数据的 mock TRON proof。

默认演示完全离线：不需要数据库、不需要模型 Key、不需要邮箱、不需要钱包，也不会产生任何外部副作用。

## 为什么这个项目值得做

大树财经已经在推进全球高校行、AI/Web3 活动、Space、黑客松和合作伙伴传播。但现实工作流里有几个高摩擦点：

- 高校活动、公开联系方式和热点内容散落在不同渠道，人工检索容易遗漏，也难以复用。
- 内容团队、活动团队和商务团队经常围绕同一个热点重复写方案、查证据、改邮件。
- 高校方不一定知道大树能提供什么资源，合作沟通需要反复解释。
- 全自动群发和自动发布会伤害品牌，尤其是在财经、Web3、校园场景中。
- 赞助方和合作伙伴需要看到真实执行证据，而不是只看模糊曝光量。

ClawTree 的答案是一个可审计的半自动系统：AI 负责搜索、总结、匹配和草拟；人负责批准、发布、发送和最终承诺；Web3 只负责记录公共摘要哈希，不碰隐私。

## 当前已经做了什么

### 1. 可现场演示的离线黄金路径

- [/demo](http://127.0.0.1:3000/demo) 展示端到端 campaign 流程。
- 使用本地 fixture 驱动，适合黑客松现场断网或 API 不稳定场景。
- 所有 mock 联系邮箱均使用 .invalid，避免误触达真实对象。
- outreach approval、reply triage、proof anchor 都标记 externalSideEffect: false。

### 2. 面向高校老师和学生的公开用户端

- [/user](http://127.0.0.1:3000/user)：公开入口，展示大树财经高校内容与校园机会。
- [/user/signals](http://127.0.0.1:3000/user/signals)：校园信号与热点。
- [/user/events](http://127.0.0.1:3000/user/events)：高校 AI/Web3 活动列表、分类、搜索和统计。
- [/user/recaps](http://127.0.0.1:3000/user/recaps)：经审核后的活动回顾。
- [/user/cooperate](http://127.0.0.1:3000/user/cooperate)：合作入口与 consent flow。
- AI 客服通过服务端同源接口调用，带 RAG 知识库、引用、拒答和人工转接边界。

公开 API 使用字段 allowlist，不返回联系人、prompt、风险原文、邮件正文等内部字段。

### 3. 面向运营和编辑的管理端

- [/admin](http://127.0.0.1:3000/admin)：运营总览。
- [/admin/ingestion](http://127.0.0.1:3000/admin/ingestion)：采集运行、来源、游标、成本和失败状态。
- [/admin/content](http://127.0.0.1:3000/admin/content)：内容审核与发布状态。
- [/admin/events](http://127.0.0.1:3000/admin/events)：高校活动浏览器。
- [/admin/proposals](http://127.0.0.1:3000/admin/proposals)：合作匹配、三档提案和引用证据。
- [/admin/outreach](http://127.0.0.1:3000/admin/outreach)：外联草稿、人审批准、拒绝和 proof anchor。
- [/admin/reviews](http://127.0.0.1:3000/admin/reviews)：活动回顾和推文回顾管理。

### 4. 真实 Django 后端原型

backend/ 已经不是空壳，而是承载真实试点能力的 Django + DRF 原型：

- 高校 AI/Web3 活动模型、导入、检索采集和 seed 数据。
- TreeFinance X 推文导入/采集、筛选、摘要、敏感风险标记和去重。
- 内容接力相关 schema：来源连接器、采集运行、内容项、审核状态。
- 外联草稿审批模型与链上凭证字段。
- 支持 SQLite 本地试跑，也可通过环境变量切换 MySQL。

### 5. Agent 工程与安全基线

项目没有把 Agent 当成一个会聊天的黑盒，而是拆成可测试的结构化能力：

- classify：内容分类。
- dedup：重复检测。
- compliance：合规风险与安全摘要。
- match：活动与大树能力匹配。
- proposal：三档合作提案。
- reply：回复意图识别和下一步建议。

每个 Agent 输出都要求 JSON Schema、sourceIds、claim-level evidence 和 needsReview。外部来源文本会被当成不可信数据包裹，检测 prompt injection，禁止模型把来源里的“指令”当系统指令执行。

### 6. Web3 proof，但不把隐私上链

/api/proofs/anchor 会对公开 allowlist 字段生成确定性 hash 和 mock TRON tx hash。allowlist 只包含：

- payloadVersion
- draftId
- universityName
- eventTitle
- approvedBy
- approvedAt
- approvalStatus

不包含邮箱、联系人、邮件正文、回复内容、prompt 或任何个人隐私。

contracts/ 里也提供了可选 Hardhat 合约：

- EventRegistry.sol：高校活动注册与存证。
- OutreachRecord.sol：外联记录和回复意图哈希存证。
- TrendOracle.sol：趋势报告快照哈希存证。

## 产品亮点

| 亮点 | 说明 |
|---|---|
| Campaign OS，而不是信息看板 | 从信号发现一路走到外联、回复和影响力证明。 |
| AI 可用但不越权 | AI 生成建议和草稿；发布、发送、上链都必须经过人审。 |
| 证据优先 | 事实、来源、抓取时间、引用覆盖和风险标签贯穿整个流程。 |
| 适合财经/Web3/高校场景 | 内置无博彩、无比分预测、无投资建议、无收益承诺、无结果保证等 guardrails。 |
| 黑客松可演示，试点可演进 | Next.js 离线黄金路径保障现场稳定；Django 原型承接真实数据和审批。 |
| Web3 有现实意义 | 链上只存公共摘要哈希，用来证明“何时看见、何时行动、何时复盘”，不滥用链。 |

## GENESIS / HTX Hackathon 评审映射

ClawTree 按照 GENESIS 关注的技术创新、产品完成度、商业潜力、生态契合和展示质量来设计 Demo，而不是只做一个概念页。

| 评审维度 | ClawTree 如何回应 |
|---|---|
| 技术创新 30% | 把媒体 campaign 拆成来源采集、结构化 Agent、证据引用、人审外联和链上 proof；每个 Agent 输出都有 schema、sourceIds 和 claim-level evidence。 |
| 产品完成度 25% | 已有 /demo、/user、/admin 三条可演示路径，覆盖高校用户、运营编辑和评审视角；默认离线可跑，避免现场 API 波动。 |
| 商业潜力 20% | 直接服务大树财经高校行、黑客松赞助、AI/Web3 活动增长和 sponsor impact report；可扩展为 campaign SaaS。 |
| 生态契合 15% | 已展示 $HTX 行情入口、TRON Nile / proof 设计、面向 HTX Genesis/WAIC/高校行的活动增长场景；后续可接 HTX API、B.AI 算力和 Grant campaign。 |
| 展示质量 10% | README、演示脚本、离线 fixture、smoke/preflight 命令和 3 分钟黄金路径都围绕现场稳定演示设计。 |

评委构成上，ClawTree 也分别准备了对应叙事：

- 技术评委：看 Agent 安全、结构化输出、RAG 边界、隐私 allowlist、测试和合约。
- 投资评委：看真实需求、可复制 campaign、赞助方报告和高校网络增长。
- 生态评委：看 HTX / TRON / B.AI 可接入位置，以及如何为生态项目带来高校与内容增长。
- 社区评委：看高校学生、社团、开发者和黑客松团队如何使用公开端发现活动与参与合作。

## HTX / B.AI 生态契合

GENESIS 关注 $HTX 应用场景、B.AI 生态应用与算力服务、AI Agent 金融、链上资产管理、交易基础设施、DAO 工具与智能金融操作系统。ClawTree 的切入点是“生态增长与智能金融媒体操作系统”：

- $HTX 场景：管理端展示 $HTX 实时行情入口，可扩展为 campaign 预算、赞助权益、生态积分或高校任务激励。
- HTX 生态增长：帮助 HTX、B.AI、生态项目把黑客松、Grant、开发者活动和高校合作变成可追踪 campaign。
- B.AI 算力：Agent 编排、内容抽取、匹配提案和 AI 客服都可以迁移到 B.AI 算力/API，形成可落地的 AI 应用工作负载。
- TRON / Web3 proof：外联审批和 impact report 只锚定公共摘要哈希，证明执行结果，同时避免把联系人、邮件正文和回复隐私上链。
- DAO / Grant 协同：未来可把高校节点贡献、活动复盘、赞助曝光和 Grant 里程碑做成可验证的生态协作记录。

一句话：ClawTree 不是把 Web3 当装饰，而是用链上 proof 解决生态合作里的“可信执行与可复盘”问题，用 AI Agent 解决“活动增长无法规模化”的问题。

## 技术架构

    /user 公开端
      ├─ 活动、信号、回顾、AI 客服
      └─ 公开 API 字段 allowlist

    /admin 管理端
      ├─ 采集、审核、提案、外联
      └─ Agent Orchestrator
          ├─ Connectors：X / 高校官网 / 活动平台 / 手工导入
          ├─ LLM Gateway：DeepSeek / OpenAI-compatible / deterministic fallback
          ├─ Django + DRF：活动、内容、审核、外联
          ├─ Proof Layer：canonical hash / TRON mock / Solidity contracts
          └─ Guardrails：Human approval / PII allowlist / no side effects

    Offline Fixtures + Golden Tests
      ├─ demo.json / golden-gate.json
      └─ schema / citation / privacy / smoke tests

## 3 分钟演示路线

1. 打开首页 [/](http://127.0.0.1:3000/)：说明 ClawTree 是 AI 媒体活动增长 OS。
2. 进入 [/demo](http://127.0.0.1:3000/demo)：展示世界杯 × 广州高校行 campaign。
3. 选择一个目标高校：查看匹配理由、来源证据和推荐合作形式。
4. 点击生成草稿：展示一校一稿、引用来源和 guardrail checks。
5. 点击人工批准：强调 Demo 不会发送邮件，真实发送必须走 Django 审批和 SMTP 配置。
6. 生成 proof：展示公共摘要 hash，解释隐私数据不上链。
7. 切到 [/admin/proposals](http://127.0.0.1:3000/admin/proposals) 和 [/admin/outreach](http://127.0.0.1:3000/admin/outreach)：证明这不是单页 Demo，而是可运营的后台。
8. 切到 [/user](http://127.0.0.1:3000/user)：展示高校老师/学生看到的公开端。

完整 5–7 分钟视频录制脚本见 [docs/demo-video-script.md](docs/demo-video-script.md)。

## 快速启动

前置条件：Node.js 20.9+，推荐 Node.js 22。

    npm run install
    npm run demo

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

如果 3000 端口被占用：

    npm run demo -- --port 3333

常用入口：

- [/](http://127.0.0.1:3000/)：产品首页
- [/demo](http://127.0.0.1:3000/demo)：端到端离线 Demo
- [/user](http://127.0.0.1:3000/user)：高校老师/学生视角
- [/admin](http://127.0.0.1:3000/admin)：大树运营/编辑视角

## 验证命令

    npm run test       # Node 内置测试：数据、AI 边界、路由、隐私 allowlist
    npm run smoke      # 自动启动临时服务并验证主流程
    npm run check      # secret scan + docs + matrix + tests + lint/typecheck/build
    npm run preflight  # 决赛前完整自检，写入 docs/harness-preflight-report.json

可选合约验证：

    npm run install:contracts
    npm run test:contracts

## 启动真实 Django 后端原型

默认 Demo 不依赖 Django。要使用真实采集、数据库、外联审批和后台 API，另开一个终端：

    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    python manage.py migrate
    python manage.py seed_events
    python manage.py runserver 127.0.0.1:8000

再开前端终端，让 Next 调 Django：

    NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api npm run demo

Django 会自动读取仓库根目录 .env 和 backend/.env。可以从 .env.example 复制一份开始配置：

    cp .env.example .env

本地默认数据库是 SQLite；只有设置 DATABASE_ENGINE=mysql 时才需要 MYSQL_*。

本地未配置 SMTP 时，审批发送会写到 console backend，不会真的发邮件。真实发送必须配置 SMTP_HOST、SMTP_USER、SMTP_PASS 和 DEFAULT_FROM_EMAIL。

## 数据采集与导入

OpenClaw 高校活动 JSON 导入：

    cd backend
    python manage.py save_events data/highSchool/events_20260704_2340.json --dry-run
    python manage.py save_events data/highSchool/events_20260704_2340.json

高校活动自动检索与 LLM 提取，需要 OPENAI_API_KEY 或兼容网关配置：

    python manage.py fetch_events --output-json --score-min 5 --dry-run

TreeFinance X 推文导入/采集，需要 DEEPSEEK_API_KEY 或 OPENAI_API_KEY；实时采集还需要 TWITTER_API_KEY：

    python manage.py fetch_tweets_v2 --import-only data/twitterData.json --dry-run
    python manage.py fetch_tweets_v2 --pages 3
    python manage.py fetch_tweets_v2 --dedup

## 环境变量边界

默认离线 Demo 不读取任何密钥。真实试点建议配置：

- DEEPSEEK_API_KEY：推文筛选、摘要、润色、AI 客服和邮件草稿生成的低成本模型。
- DEEPSEEK_BASE_URL / DEEPSEEK_MODEL：仅允许受控服务端 provider；默认 DeepSeek。
- OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL：高校活动提取或 OpenAI-compatible 备用模型。
- TWITTER_API_KEY：TreeFinance X 时间线采集。
- DATABASE_ENGINE、SQLITE_PATH 或 MYSQL_*：本地 SQLite 或生产 MySQL。
- SMTP_*、DEFAULT_FROM_EMAIL：只在真实审批发送时使用。
- TRON_RPC_URL、DEPLOYER_PRIVATE_KEY：只在演示真实上链时使用；私钥绝不进入前端。

## 仓库结构

    ClawTree/
    ├─ frontend/              # Next.js UI、mock API、用户端和管理端
    ├─ frontend/data/         # demo.json、golden-gate.json、agent schema 与 eval fixtures
    ├─ backend/               # Django 真实采集、数据库和外联审批原型
    ├─ backend/data/          # OpenClaw / X 采集样本数据
    ├─ contracts/             # Solidity proof 合约与 Hardhat 测试
    ├─ scripts/               # smoke、preflight、secret scan、harness 工具
    ├─ tests/                 # Node 领域/边界测试
    └─ docs/                  # PRD、架构、验收、任务、主题包和验证报告

## 设计原则

- 先证明“发现 → 决策 → 外联 → 证据”闭环，再扩数据源和自动化程度。
- 所有外部事实必须带来源；AI 结论和事实分开展示。
- 邮件发送、公开发布、链上写入都必须人审。
- 批量外联必须一校一稿、逐批审批、限速和可退订，禁止 BCC 冒充个性化。
- 链上只存哈希、时间和公共活动 ID，不存联系人、邮件正文或回复。
- 世界杯内容只作为事件驱动市场、财经素养和 AI 复盘案例；不做博彩、比分预测、投资建议、收益承诺或结果保证。

## Roadmap

- **MVP / Hackathon**：稳定离线黄金路径、公开端、管理端、AI 安全测试和 mock proof。
- **Pilot / 广州高校行**：接入真实 Django 数据、每日采集、编辑审核、逐校外联审批和回复漏斗。
- **Campaign SaaS**：面向赞助方、黑客松、协议和 AI 平台提供 campaign 工作台与 impact report。
- **TreeRing 90**：将观点、证据和 30/90 天复盘做成可验证媒体栏目，证明“不是追热点，而是更早看见趋势”。
- **Campus Signal Nodes**：让高校合作方成为持续贡献本地信号的校园节点网络。

## 延伸阅读

- [项目简述](project.md)
- [产品需求文档](docs/prd.md)
- [架构说明](docs/architecture.md)
- [验收标准](docs/acceptance.md)
- [工程任务](docs/tasks.md)
- [AI 客服与 RAG 边界](docs/assistant-rag.md)
- [Agent 安全与引用](docs/agent-safety-and-citations.md)
- [世界杯 × 广州高校行主题包](docs/world-cup-guangzhou-theme-package.md)
- [5–7 分钟演示视频脚本](docs/demo-video-script.md)
