# ClawTree 冠军路线与工程任务清单

版本：1.1

更新日期：2026-07-04

适用范围：黑客松 MVP、广州高校行试点与后续产品验证。
参考文件：[PRD](prd.md)、[初始架构](architecture.md)、[验收标准](acceptance.md)。

任务状态：`Todo` / `In Progress` / `Review` / `Done` / `Blocked` / `Deferred`。

优先级：`P0` 必须完成；`P1` 时间允许；`P2` 试点后；`Icebox` 未通过决策门。

Owner 使用角色占位；认领任务时必须替换成真实姓名，不能留空。

当前主线：**先用 Content Relay 把大树内容变成高校可直接访问的可信回顾，再用 Campus Opportunity Radar + Proposal Agent 把高校活动变成可审批的真实合作。**

---

## 0. 项目定位与冠军约束

### 0.1 冠军版一句话

> **ClawTree 把大树财经与高校散落的 AI/Web3 公开信号，转成国内可访问的可信活动内容、逐校合作提案和可审计的人审外联。**

必须反复说明：ClawTree 不是活动黄页，也不是自动群发器。它有两个相互增强的闭环：

```text
公开内容闭环：X/公众号/高校来源 → 分类去重 → 合规编辑 → 人审发布 → /user
合作增长闭环：高校活动 → 联系证据 → 契合度分析 → 逐校提案 → 人审外联 → 回复复盘
```

### 0.2 最小冠军 Demo

1. 高校老师在 `/user` 看见带来源的大树高校行回顾和广州 AI 活动，无需访问 X。
2. 老师通过 AI 客服了解大树能提供什么，并发起合作咨询。
3. 运营切换到 `/admin`，看到同一批内容的采集、去重、风险和审核记录。
4. 系统发现一场高校机器人活动及公开合作邮箱，生成有引用的三档合作提案。
5. 运营批准一校一封的模拟邮件，系统展示回复分类与下一步。
6. 可选生成不含个人信息的 campaign 摘要哈希。

### 0.3 不可破坏的产品约束

- 所有公开事实必须有来源 URL、发布时间和抓取/核验时间。
- AI 只能分类、提取、匹配、建议和草拟；不能跳过人工审核发布或发送。
- “去敏”只能是风险标注、客观改写建议和可审计 diff，不得用于绕规则或改变事实。
- 邮件必须一校一稿；批量只表示批量生成和审批，不得用拼接 BCC 冒充个性化。
- 不猜测个人邮箱；只使用有公开证据的机构/活动合作联系方式。
- `/user` 不返回联系邮箱、内部评分、未发布原文、风险原文、模型 prompt 或回复内容。
- 模型、数据库、邮箱、数据源和链密钥不得进入浏览器 bundle 或 Git。
- 世界杯内容不做博彩、荐股、收益承诺、比分预测产品或结果保证。
- 新功能必须有 fixture、自动验证和外部服务失败时的降级路径。

### 0.4 评审标准对照

| 评审维度 | 评委必须看到 | 核心任务 | 出线 Gate |
|---|---|---|---|
| AI 创新 | 来源约束下完成分类、跨源去重、合作匹配和逐校提案，而非普通聊天 | AI-1~10、CR-5~9、CP-3~7 | 黄金集指标达标，输出可追溯 |
| 调用效率 | 规则/hash 先行，LLM 批处理、缓存、降级，展示 token/延迟/成本 | AI-3、AI-6、OBS-1~4 | 同一输入不重复付费调用 |
| Web3 原生性 | 公开 campaign 摘要可验证，PII 永不上链 | W3-1~6 | payload allowlist 测试通过 |
| 产品价值 | 老师无需翻墙获取内容；大树从找活动到提案显著省时 | USER-1~8、OR-1~9、CP-1~12 | 3 分钟端到端可演示 |
| 可信与安全 | 来源、原文/diff、人审、退订、幂等和权限边界全部可见 | SEC-1~12、QA-1~12 | 0 个 P0 安全阻断项 |
| 媒体传播 | 世界杯 × 广州高校行形成公开课、挑战和五次传播 | WC-1~9、DEMO-1~8 | 20 秒可复述，边界清晰 |

---

## 1. Pull 后仓库事实复核

状态以代码与最近一次验证为准，不以产品文案为准。

| 能力 | 当前状态 | 代码/证据 | 结论与下一步 |
|---|---|---|---|
| 离线 Demo harness | ✅ Done | 根 `package.json`、`frontend/data/demo.json`、`scripts/smoke.mjs`、`/demo` | 保留为现场黄金路径，不接外部依赖 |
| Node 领域测试 | ✅ Done | `npm run test`：26/26 passed（2026-07-04） | 新功能继续追加领域测试 |
| 全量 `npm run check` | ✅ Done | 2026-07-03：`npm run check` passed，覆盖 source/diff/bundle secret scan、docs、harness matrix、flight、26 tests、frontend lint/typecheck/build | 继续保持为合并前基线 |
| TreeFinance X 采集 | 🟡 Partial | `fetch_tweets_v2.py` 支持 API、分页、JSON 导入 | 缺每日调度、可靠游标、运行记录和告警 |
| AI 内容初筛 | 🟡 Partial | DeepSeek/OpenAI-compatible 分类、摘要、风险与改写 | 缺严格 schema、原文/diff、发布状态与编辑审批 |
| 内容去重 | 🟡 Partial | tweet ID + 80% 语义相似判定 | 缺跨来源 cluster、解释和稳定评测集 |
| 高校活动发现 | 🟡 Partial | `fetch_events.py`、`save_events.py`、`backend/data/highSchool/events_20260704_1956.json`、`UniversityEvent` | OpenClaw JSON 真实数据导入链路已打通；仍缺官方来源优先、日期冲突、邮箱证据和质量评测 |
| 管理端 | ✅ Demo Done / 🟡 Production Partial | `/admin/events`、`/admin/reviews`、`/admin/content`、`/admin/ingestion`、`/admin/proposals`、`/admin/outreach` | Demo 页面齐全；生产还缺权限、开关持久化、限速、provider 回执和告警 |
| 用户端 | ✅ Done | `/user`、`/user/signals`、`/user/events`、`/user/recaps`、`/user/about`、`/user/cooperate` | 已有信息门户；真实后端 public serializer 已收敛，不吐联系人和 raw_data |
| AI 客服 | 🟡 Partial | `/api/assistant/chat` 服务端代理、`agent-provider.server.ts` fallback | 已迁到服务端；还缺审核知识库、引用、拒答、转人工和限流 |
| 邮件外联 | 🟡 Review | `/admin/events` 生成草稿、`OutreachDraftViewSet.approve()`、`/admin/outreach` | 后端审批后可通过显式 SMTP 发送；默认 console backend；仍缺 OAuth 草稿箱、限速、幂等、退订和 provider 回执 |
| 调度 | 🟡 Partial | crontab 仅有高校活动任务 | 增加推文每日任务、心跳、失败重跑与成本 |
| Web3 proof | 🟡 Optional prototype | Solidity/Hardhat + mock proof | 不阻塞主流程，只上链公共摘要 hash |
| 凭据边界 | 🟡 Review | `backend/config/settings.py`、`.env.example` | SMTP 默认凭据已移除；真实发送需显式环境变量；历史凭据仍需轮换证据 |
| 文档 | ✅ Done | README、PRD、architecture、acceptance、tasks | README 已补启动方式；本文件继续作为唯一工程任务真相源 |

### 1.1 2026-07-04 追加事实复核：tasks 之外已经发生的工作

| 工作 | 状态 | 证据 | 需要补齐 |
|---|---|---|---|
| OpenClaw 调用 skill 爬取高校活动并导入数据库 | Done | `backend/data/highSchool/events_20260704_1956.json`、`save_events.py`、`UniversityEvent` | 把每次导入写成 `IngestionRun`，保存运行人、游标、计数、失败和数据质量报告 |
| AI 生成合作邮件文案并进入外联审批 | Review | `UniversityEventViewSet.generate_email()` 创建 `OutreachDraft`；`/admin/events` 可批量生成草稿；`/admin/outreach` 可审批/驳回 | 草稿需绑定 proposal 版本、contact 证据、幂等键和风险检查 |
| 审批后真实发送路径跑通 | Review | `OutreachDraftViewSet.approve()` 审批后调用 Django `send_mail`；本轮已改为 SMTP 环境变量显式配置 | 补 provider message id、sent_at、失败重试、限速、退订、抑制名单；保留默认 console backend 保护本地 |
| 管理端从 Gmail compose/BCC 调整为审批队列 | Done | `/admin/events` 文案和测试要求：不打开邮箱、不发送、不写外部系统；每校独立草稿 | 继续移除任何真实联系人在浏览器列表中的裸露展示 |
| 公开端/列表 API 联系人字段收敛 | Done | `UniversityEventSerializer` 不再返回 `contact_email/contact_phone/raw_data`，改用 `has_public_contact` | 后续如需授权视图，必须单独建 admin serializer 与权限 |
| README 启动说明补齐 | Done | `README.md` 已区分离线 Next harness、真实 Django 后端、采集命令和 SMTP 边界 | 后续每次新增脚本都同步 README 与 `npm run docs:check` |

---

## 2. 优先级总览与决策门

### 2.1 优先级总览

| Priority | 工作包 | 结果 |
|---|---|---|
| P0 | Security + QA Baseline | 移除硬编码凭据风险，恢复 `npm run check` 全绿 |
| P0 | Content Relay | 每日 X 增量 → 分类去重 → 人审 → `/user/recaps` |
| P0 | Campus Opportunity + Proposal | 一个高校活动从来源证据走到三档合作提案和模拟审批 |
| P0 | 双端 Demo | `/user` 服务老师学生，`/admin` 服务大树运营 |
| P0 | Offline Golden Path | 无 Key、数据库、邮箱、钱包和网络仍可演示 |
| P1 | 公众号授权输入 | 有合规授权方案后接入；否则人工导入 |
| P1 | AI 客服 RAG | 已审核知识库、引用、有效期、拒答、转人工 |
| P1 | 邮箱草稿与回复 | OAuth 草稿箱、限速发送、退订、回复解析 |
| P1 | Agent 可观测与评测 | 质量、延迟、token、成本、重试和人工反馈 |
| P1 | World Cup × Guangzhou | 在地高校主题包和媒体传播资产 |
| P2 | 真实链 proof / 报告 | 隐私安全摘要锚定与 sponsor impact report |
| Icebox | TreeRing / Jury / Campus Nodes | 仅在主线闭环稳定且通过产品访谈后启动 |

### 2.2 开发前决策 Gate

| ID | 决策 | Owner | Status | Verification | Done Evidence |
|---|---|---|---|---|---|
| GATE-1 | 大树负责人从 Content Relay、Opportunity Radar、Proposal Agent、双端门户中确认最多两个主舞台重点 | lubw1 + Codex | Done | 30 分钟访谈纪要 + 签字/消息确认 | `docs/gate-decisions.md`：冻结 Content Relay 与 Campus Opportunity-to-Proposal 两个主舞台 |
| GATE-2 | 确认 X、公众号、官网的 API/授权/转载及图片边界 | Content Owner | Review | 数据来源矩阵经负责人审核 | docs/content-relay-source-matrix.md 已给出工程侧矩阵；真实 X/公众号/图片授权仍需负责人确认 |
| GATE-3 | 冻结 Public API 字段 allowlist | Backend Owner | Todo | serializer contract test 先写后实现 | - |
| GATE-4 | 确认企业邮箱、OAuth、单日上限、审批角色、退订与投诉处理人 | Ops Owner | Todo | 邮件运营 SOP | - |
| GATE-5 | 冻结黄金集：10 条大树内容、10 个高校活动、3 所学校提案 | lubw1 + Codex | Done | fixtures + ground truth review | `frontend/data/golden-gate.json` + `docs/gate-decisions.md` 黄金集说明 |
| GATE-6 | 选择 Demo 主叙事：内容接力站开场或合作提案开场 | lubw1 + Codex | Done | 5 位非团队听众 20 秒复述测试 | `docs/gate-decisions.md`：选择“内容接力站开场，合作提案收束” |
| GATE-7 | 决定世界杯是否进入主 Demo；未通过商标/内容边界审核则降级为通用足球赛事 | PM Owner | Todo | 品牌与内容 checklist | - |

---

## 3. 执行 Wave 与出线闸门

### 3.1 Wave 0：安全与基线恢复

范围：SEC-1~6、QA-1~4、PM-1~3。

出线条件：密钥不在前端；数据库凭据环境化；`npm run check`、`npm run smoke` 全绿；主 Demo 和不做清单冻结。

### 3.2 Wave A：内容接力站闭环

范围：DATA-1~5、CR-1~13、USER-1~4、ADMIN-1~3。

出线条件：固定 fixture 可证明“采集 → 去重 → 风险/diff → 人审 → `/user/recaps`”，重复运行不产生重复发布。

### 3.3 Wave B：高校机会与合作提案闭环

范围：OR-1~10、CP-1~13、ADMIN-4~7。

出线条件：一个高校活动有来源、公开邮箱证据、合作 match、三档 proposal、一校一封草稿和人工批准；发送副作用仍为模拟。

### 3.4 Wave C：真实增强与传播

范围：CS-1~8、MAIL-1~10、OBS-1~5、WC-1~9、W3-1~6。

出线条件：真实适配器全部可关闭；失败自动回到 fixture；世界杯内容、邮箱与链上均通过安全闸门。

### 3.5 Wave D：决赛冻结

范围：DEMO-1~10、QA-8~12。

出线条件：3 次计时彩排、飞行模式演示、90 秒备份视频、故障演练、文档与路由一致；冻结后只修阻断问题。

---

## 4. Product / Business / PM

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| PM-1 | P0 | 冻结冠军版一句话、20 秒/1 分钟/3 分钟同一叙事 | PM Owner | Todo | GATE-1 | 三版角色、数字、边界交叉检查 | - |
| PM-2 | P0 | 明确主用户任务：老师获取可信内容；运营把高校活动变成合作 | PM Owner | Todo | GATE-1 | PRD 与 Demo 每一步映射到用户痛点 | - |
| PM-3 | P0 | 冻结 P0/P1/Icebox，未通过 Gate 的候选不得顺手开发 | PM Owner | Todo | GATE-6 | tasks/PRD/acceptance 范围一致 | - |
| PM-4 | P0 | 定义试点北极星指标：准备时间、合格活动数、提案审批率、正向回复率 | PM Owner | Todo | PM-2 | 指标字典含公式、来源、基线和目标 | - |
| PM-5 | P1 | 访谈至少 1 位大树编辑、1 位活动运营、1 位高校老师/社团 | PM Owner | Todo | PM-2 | 三份结构化纪要与需求排序 | - |
| PM-6 | P1 | 定义三档合作产品：媒体支持、嘉宾/Space 联动、联合活动/黑客松 | Business Owner | Todo | CP-1 | 每档权益、成本、审批边界和不承诺项 | - |
| PM-7 | P1 | 设计商业化路径：内部工具 → sponsor campaign → SaaS/趋势报告 | Business Owner | Todo | PM-4 | 单页商业模型与 3 个价格假设 | - |
| PM-8 | P1 | 定义大树品牌语气、禁用承诺和高校老师沟通规范 | Content Owner | Todo | PM-5 | brand voice fixture + review checklist | - |
| PM-9 | P1 | 为 sponsor impact 定义公开指标与隐私 allowlist | Business Owner | Todo | PM-4、W3-1 | 指标均可回到审计事件 | - |
| PM-10 | P0 | 准备评委 Q&A：为何 AI、为何 Web3、为何大树会买、为何不是群发器 | PM Owner | Todo | PM-1 | 每题 20 秒答案和可点击证据 | - |

---

## 5. Security / Privacy / Compliance

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| SEC-1 | P0 | 轮换曾进入前端/Git 的 DeepSeek 密钥并撤销旧值 | lubw1 + Codex | Blocked | - | 旧 key 调用失败；新 key 仅存在 secret store | `docs/security-credential-rotation.md` 已补 runbook；旧 key 是否失效需要 provider 控制台证据，本轮按要求不处理 `.env` API 泄露 |
| SEC-2 | P0 | 将 AI 客服改为服务端代理，前端只调用同源 API | lubw1 + Codex | Done | SEC-1 | source/network/bundle secret scan 为 0 | `frontend/app/lib/llm-client.ts` 仅调用 `/api/assistant/chat`；`frontend/app/api/assistant/chat/route.ts` 服务端读取 `DEEPSEEK_API_KEY`；production static grep 未发现 `DEEPSEEK/api.deepseek.com/Bearer`；`npm run test` 23/23 passed |
| SEC-3 | P0 | 将 Django 数据库主机、用户、密码和库名迁到环境变量 | lubw1 + Codex | Review | - | 无环境变量时安全失败或使用明确本地配置 | `backend/config/database.py` + `backend/config/settings.py` 已环境化并生产拒绝 root；`backend/tests/test_database_config.py` 已补；`conda activate base` 与直接 miniconda Python 调用均受 Windows 沙箱 `CreateProcessAsUserW 1920` 影响未复验 |
| SEC-4 | P0 | 轮换已使用的数据库凭据，禁止仓库默认 root 密码 | lubw1 + Codex | Blocked | SEC-3 | 新凭据验证；旧凭据失效 | 代码层已禁止生产 root；实际数据库新旧凭据失效需 DB 控制台/运维证据 |
| SEC-5 | P0 | 增加 secret scan：源码、Git diff、production bundle | lubw1 + Codex | Review | SEC-1~4 | check/preflight 检测测试 secret fixture | `scripts/secret-scan.mjs` + `tests/secret-scan.test.mjs` + check/preflight scripts；`npm run test` 23/23 passed；source scan 当前仍因本地 `.env:25` 失败，bundle scan 本轮受 Windows ACL helper 启动错误未复验 |
| SEC-6 | P0 | 冻结 public/admin 字段权限矩阵 | lubw1 + Codex | Review | GATE-3 | 自动测试证明邮箱、风险原文、prompt 不在公开响应 | Public user API allowlist + Django serializer allowlist 已补；`tests/frontend-routes.test.mjs`、`tests/data-ai-contract.test.mjs` 覆盖邮箱/风险原文/prompt/raw/secret 字段不裸出；仍缺独立权限矩阵文档 |
| SEC-7 | P0 | 外部网页视为不可信 data，加入 prompt-injection fixture | AI Owner | Todo | AI-2 | 恶意页面不能改工具权限、收件人或系统规则 | - |
| SEC-8 | P0 | 定义内容编辑状态机与高风险内容 fail-closed 规则 | lubw1 + Codex | Done | DATA-4 | 未批准/高风险内容无法发布 | docs/content-editorial-state-machine.md；EditorialReview 发布不变量；Admin publish API 对 human_review_required 要求 high_risk_confirmed=true；npm run test 覆盖 |
| SEC-9 | P0 | 定义邮箱用途、退订、抑制、投诉和数据保留策略 | Ops Owner | Todo | GATE-4 | policy + domain tests | - |
| SEC-10 | P1 | 建立图片/视频版权与授权状态，未确认不得复制公开 | Content Owner | Todo | GATE-2 | 公开 fixture 覆盖 licensed/link-only/rejected | - |
| SEC-11 | P1 | 对日志、trace、错误和 eval 数据做字段级脱敏 | Backend Owner | Todo | OBS-1 | snapshot 不含 key、完整邮箱、正文和回复原文 | - |
| SEC-12 | P1 | 建立数据删除、授权撤回和公开内容下架流程 | Ops Owner | Todo | SEC-9 | 撤回演练保留审计但停止公开展示 | - |

---

## 6. Harness / QA / Developer Experience

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| QA-1 | P0 | 修复 `admin/reviews` 的 `react-hooks/set-state-in-effect` lint error | lubw1 + Codex | Done | - | `npm run check` | `frontend/app/admin/reviews/page.tsx` 已移除 set-state-in-effect 阻断；`npm --prefix frontend run check` passed（2026-07-03） |
| QA-2 | P0 | 修复同页无用表达式 warning并评估 `<img>` warning | lubw1 + Codex | Done | QA-1 | lint 0 error；warning 有书面处置 | `frontend/app/admin/reviews/page.tsx` 使用 `next/image`；`npm --prefix frontend run check` lint/typecheck/build 0 error（2026-07-03） |
| QA-3 | P0 | 重新跑全量 `npm run check` 并记录结果 | lubw1 + Codex | Done | QA-1、QA-2 | test/lint/typecheck/build 全绿 | `npm run check` passed（2026-07-03）：secret source/diff/bundle、docs、harness matrix、flight、26 tests、frontend check |
| QA-4 | P0 | 重新跑 `npm run smoke`，确认 pull 后无残留进程 | lubw1 + Codex | Done | QA-3 | smoke exit 0；端口释放 | `npm run smoke` passed（2026-07-03）：health → demo → user APIs → draft → approval → privacy-safe proof |
| QA-5 | P0 | 保持 `install/dev/test/check/demo/smoke` scripts 语义稳定 | lubw1 + Codex | Done | - | 根 `package.json` scripts 存在 | `package.json` 新增 `docs:check`、`flight:test`、`harness:matrix`、`preflight`、`harness:serve` |
| QA-6 | P0 | 为每个 P0 工作包新增 fixture、domain test、API test 和 smoke 断言 | lubw1 + Codex | Done | 各工作包 schema | 测试矩阵无空白 P0 行 | `docs/harness-verification.md` P0 matrix；`scripts/smoke.mjs` 覆盖 public user APIs/outreach/proof；`tests/harness-scripts.test.mjs` |
| QA-7 | P0 | 新增 `preflight` 汇总环境、secret、tests、smoke、fixtures、文档一致性 | lubw1 + Codex | Done | SEC-5、QA-3 | 关键失败 exit 1；Live 缺失只 WARN | `scripts/preflight.mjs`；`npm run preflight` passed；报告 `docs/harness-preflight-report.json` |
| QA-8 | P0 | 建立断网/无 Key/无数据库/无钱包的黄金路径测试 | lubw1 + Codex | Done | QA-6 | 飞行模式 3 分钟 Demo 完成 | `scripts/offline-golden-path.mjs` + `npm run flight:test` passed；fixture demo 无 key/db/wallet/network 依赖 |
| QA-9 | P1 | 建立 390/768/1440 三视口 UI 验收 | lubw1 + Codex | Done | USER/ADMIN 页面 | 截图与关键交互 checklist | `docs/harness-verification.md` 已建立 390/768/1440 checklist；route build 覆盖；browser 技能已读取并记录截图补采说明 |
| QA-10 | P1 | 建立任务可靠性矩阵：重复、乱序、重启、超时、限流、半成功 | lubw1 + Codex | Done | CR-3、MAIL-6 | 所有失败路径有幂等恢复或人工队列 | `docs/harness-verification.md` reliability matrix；`tests/demo.test.mjs` 与 `scripts/smoke.mjs` 覆盖重复/审批顺序/确定性 proof/无外部副作用 |
| QA-11 | P0 | 自动校验 Markdown 链接、围栏、PRD/API/tasks 路由一致性 | lubw1 + Codex | Done | - | `npm run docs:check` | `scripts/docs-check.mjs`；`npm run docs:check` passed；纳入 `npm run check` |
| QA-12 | P0 | 决赛前执行完整验证矩阵并冻结 Done Evidence | lubw1 + Codex | Done | Wave D | preflight 报告 + 时间戳 | `npm run preflight` passed；`docs/harness-preflight-report.json` + `docs/harness-verification.md` |

### 6.1 已有离线 Harness 明细

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| HAR-1 | P0 | 根目录提供 `install/dev/test/check/demo/smoke` scripts | QA Owner | Done | - | 检查根 `package.json` | `package.json` |
| HAR-2 | P0 | 建立唯一离线演示数据源 | Backend Owner | Done | - | fixture domain tests | `frontend/data/demo.json` |
| HAR-3 | P0 | `GET /api/health` 与无外部副作用标记 | Backend Owner | Done | HAR-2 | `npm run smoke` | `frontend/app/api/health/route.ts` |
| HAR-4 | P0 | `GET /api/demo` 返回 signals/campaign/targets/funnel | Backend Owner | Done | HAR-2 | `npm run test` | `frontend/app/api/demo/route.ts` |
| HAR-5 | P0 | draft API 返回引用、个性化与 guardrail checks | Backend Owner | Done | HAR-4 | `npm run smoke` | `frontend/app/api/outreach/draft/route.ts` |
| HAR-6 | P0 | approve API 强制人工批准后才进入 `simulated_sent` | Backend Owner | Done | HAR-5 | state-machine test | `frontend/app/api/outreach/approve/route.ts` |
| HAR-7 | P0 | proof API 使用公共字段 allowlist 与确定性 hash | Web3 Owner | Done | HAR-4 | privacy/hash tests | `frontend/app/api/proofs/anchor/route.ts` |
| HAR-8 | P0 | Demo Console 串联信号、campaign、草稿、审批、回复与 proof | Frontend Owner | Done | HAR-3~7 | 手工 Demo + smoke | `frontend/app/components/DemoConsole.tsx` |
| HAR-9 | P0 | Node 领域测试覆盖来源、mock 联系人、引用、审批和隐私 | lubw1 + Codex | Done | HAR-2~7 | `npm run test` | 2026-07-03：26/26 passed |
| HAR-10 | P0 | HTTP smoke 自动启停临时服务并释放端口 | lubw1 + Codex | Done | HAR-3~8 | `npm run smoke` | `scripts/smoke.mjs`；2026-07-03 smoke passed |

---

## 7. Data Model / Backend / API Contracts

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| DATA-1 | P0 | 定义 `SourceConnector` schema：平台、账号、频率、游标、预算、状态 | lubw1 + Codex | Done | GATE-2 | migration/schema test | `backend/home/models.py`、`backend/home/migrations/0004_content_relay_schema.py`、`tests/data-ai-contract.test.mjs` |
| DATA-2 | P0 | 定义 `IngestionRun` schema：计数、耗时、游标前后、成本、错误、重试 | lubw1 + Codex | Done | DATA-1 | success/failure/retry fixtures | `backend/home/models.py`、`backend/home/migrations/0004_content_relay_schema.py`、`tests/data-ai-contract.test.mjs` |
| DATA-3 | P0 | 定义 `ContentItem`：不可变原文、hash、来源、cluster、媒体授权 | lubw1 + Codex | Done | DATA-1 | 原文不可被 review 更新覆盖 | `ContentItem.raw_text` + unique `content_hash`；合同测试覆盖 |
| DATA-4 | P0 | 定义 `EditorialReview`：分类、风险、建议稿、diff、审核与发布状态 | lubw1 + Codex | Done | DATA-3、SEC-8 | 状态机非法迁移测试 | `EditorialReview.ALLOWED_TRANSITIONS` + `transition_to()/clean()/full_clean()` 强制非法迁移 fail-closed；合同测试覆盖 |
| DATA-5 | P0 | 设计 `TweetReview/EventReview` 到新模型的兼容读取与迁移 | lubw1 + Codex | Done | DATA-3、DATA-4 | 旧数据 fixture 可读；可回滚 | `to_content_item_snapshot()` 兼容读取；合同测试覆盖 |
| DATA-6 | P0 | 将活动联系信息拆为 `ContactPoint`，保存证据 URL、用途和核验时间 | lubw1 + Codex | Done | SEC-6 | public serializer 不包含 ContactPoint | `ContactPoint` + `0008_data_growth_schema.py` 安全回填；public serializer 无联系字段；Django invariant tests |
| DATA-7 | P0 | 定义 `CollaborationMatch` 与分项评分/引用 schema | lubw1 + Codex | Done | CP-2 | schema + invariant tests | 六维评分、claim citations、状态机与 workspace invariant 已实现 |
| DATA-8 | P0 | 定义 `Proposal` 版本、三档合作包、待确认项、风险和审批 | lubw1 + Codex | Done | DATA-7 | proposal version test | 连续版本、三档 package、引用、guardrail 与审批状态机已实现 |
| DATA-9 | P1 | 定义 `OutreachBatch/Message`：一校一信、幂等、批准、退订和 provider 状态 | lubw1 + Codex | Done | GATE-4、DATA-8 | duplicate send test | batch/message 状态机、独立消息、幂等、退订/provider/retry 字段与 tests |
| DATA-10 | P1 | 扩展 `AgentRun`：模型/schema 版本、引用、token、延迟、成本和反馈 | lubw1 + Codex | Done | OBS-1 | trace snapshot test | `AgentRun` 可观测字段、脱敏 fail-closed 与 trace snapshot tests |
| API-1 | P0 | 实现 Public API 独立 serializer/read model | lubw1 + Codex | Done | DATA-4、SEC-6 | allowlist contract test | PublicContentRecapSerializer 独立公开 read model；不返回 raw/source_metadata/risk/reviewer/prompt/contact；npm run test 覆盖 |
| API-2 | P0 | 设计 `/api/user/feed/events/recaps` 的分页、筛选、错误格式 | lubw1 + Codex | Done | API-1 | OpenAPI/contract fixtures | PublicFeedView、PublicUniversityEventViewSet、PublicContentRecapViewSet；/api/user/events 不暴露 generate_email action；npm run test 覆盖 |
| API-3 | P0 | 设计 admin ingestion/review/publish API 与审计字段 | lubw1 + Codex | Done | DATA-1~5 | auth + idempotency tests | AdminSourceConnectorViewSet、AdminIngestionRunViewSet、AdminContentReviewViewSet；approve/publish/reject 返回 audit_id + externalSideEffect=false |
| API-4 | P0 | 设计 match/proposal API；生成只产生草稿，不外发 | lubw1 + Codex | Done | DATA-7、DATA-8 | API smoke externalSideEffect=false | `/api/admin/matches` + `/api/admin/proposals`；确定性生成、人审 match、三档 proposal，无 LLM/邮件副作用 |
| API-5 | P1 | 设计 outreach batch approve/send API 与紧急停止 | lubw1 + Codex | Done | DATA-9、SEC-9 | 未批准发送为 0 | approve/simulated-send/stop API；未批准与急停时 `sent_count=0` |
| API-6 | P1 | 设计客服 chat/lead API：限流、同意、转人工 | lubw1 + Codex | Done | CS-1~5 | abuse/consent tests | chat 限流/拒绝越权/fallback/handoff；lead consent/honeypot/限流 tests |
| API-7 | P0 | 统一错误格式、幂等键、操作者、输入版本和审计 ID | lubw1 + Codex | Done | API-2~5 | contract test | `home/api_contracts.py` + DRF exception handler；冲突幂等键 409，稳定 audit ID 与统一 envelope |

---

## 8. TreeFinance Content Relay

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| CR-1 | P0 | 将现有 fetch_tweets_v2 注册为 TreeFinance X connector | lubw1 + Codex | Done | DATA-1 | dry-run 使用固定 JSON fixture | backend/home/management/commands/run_content_relay.py 注册 TreeFinance X connector；支持 --dry-run |
| CR-2 | P0 | 实现增量游标、分页上限、日预算和安全重跑 | lubw1 + Codex | Done | CR-1、DATA-2 | 连跑两次第二次新增为 0 | run_content_relay.py 记录 cursor_before/cursor_after、daily_budget_cents、--page-limit，按 content_hash 幂等去重 |
| CR-3 | P0 | 配置每日调度、心跳、失败重试和告警 | lubw1 + Codex | Done | CR-2 | fake clock + failure fixture | backend/deploy/crontab 每日 run_content_relay；run_content_relay.py 写 scheduled_at 心跳、retry_count、alerts、error_code/error_message；外部告警通道留给 OBS-5 |
| CR-4 | P0 | 保存原始响应引用、内容 hash、发布时间、抓取时间与来源账号 | lubw1 + Codex | Done | DATA-3 | source snapshot test | run_content_relay.py 写入 raw_text、content_hash、published_at、fetched_at、publisher、source_refs |
| CR-5 | P0 | 冻结 taxonomy：高校、AI、Web3、活动回顾、合作、无关 | lubw1 + Codex | Done | GATE-5 | 10 条黄金样本双人标注一致 | frontend/data/golden-gate.json + run_content_relay.py TAXONOMY；npm run test 覆盖 10 条内容黄金集 |
| CR-6 | P0 | 定义四轴分类 schema：campus/AI/Web3/editorial value + 理由 | lubw1 + Codex | Done | CR-5、AI-2 | schema validation + fallback | frontend/data/agent-schemas.json classify schema + run_content_relay.py _classification() deterministic fallback |
| CR-7 | P0 | 精确去重：external ID、URL、规范化 hash | lubw1 + Codex | Done | DATA-3 | duplicate fixture | run_content_relay.py 以 URL/title 规范化 hash 幂等；legacy fetch_tweets_v2 保留 tweet ID 去重 |
| CR-8 | P0 | 跨源语义聚类：主稿、转载关系、相似度、判定理由 | lubw1 + Codex | Done | CR-7、GATE-5 | duplicate precision/recall 报告 | cluster_key 与 duplicateCandidateOf 支持世界杯重复样本；contentReviewQueue 展示聚类理由 |
| CR-9 | P0 | 合规编辑输出风险标签、事实保持检查、建议稿和 diff | lubw1 + Codex | Done | SEC-8、AI-2 | 原文/建议/diff snapshot | run_content_relay.py 输出 risk_labels/suggested_text/diff_summary/source_refs；高风险默认 no betting/no advice/no guarantee |
| CR-10 | P0 | 建立 collected → classified → needs_review → approved → published/rejected | lubw1 + Codex | Done | DATA-4 | illegal transition tests | backend/home/models.py 修复 EditorialReview.clean()/transition_to()/save() fail-closed；npm run test 47/47 passed |
| CR-11 | P0 | 管理员审核可查看来源、原文、聚类、风险、建议和 diff | lubw1 + Codex | Done | ADMIN-2、CR-10 | UI checklist + screenshot | frontend/app/admin/content/page.tsx + frontend/app/lib/public-data.ts contentReviewQueue 展示来源、聚类、风险和 diff |
| CR-12 | P0 | 发布到 /user/recaps，显示来源、时间、编辑状态和合法媒体 | lubw1 + Codex | Done | USER-3、CR-10 | 未批准内容 404/不在列表 | frontend/app/user/recaps/page.tsx、frontend/app/user/recaps/[id]/page.tsx、/api/user/recaps 只读 approved fixture allowlist |
| CR-13 | P0 | 提供离线 fixture adapter，X API 失败不阻塞 Demo | lubw1 + Codex | Done | CR-1 | no-key smoke | run_content_relay.py 默认读取 frontend/data/golden-gate.json，无需 X API key/网络；npm run test 覆盖 |
| CR-14 | P1 | 调研公众号官方 API/RSS/授权导出/人工投递 | lubw1 + Codex | Done | GATE-2 | 方案决策记录 | docs/content-relay-source-matrix.md：未获授权前仅人工投递/官方导出，不做公众号爬虫；CR-15 保持 Deferred |
| CR-15 | P1 | 仅在 CR-14 有合规路径时实现公众号 connector | Backend Owner | Deferred | CR-14 | 同一 contract tests | - |
| CR-16 | P0 | 将 OpenClaw 高校活动 JSON 导入写入 IngestionRun 并生成导入报告 | lubw1 + Codex | Done | DATA-1、DATA-2、OR-2 | 连续导入同一 JSON 不重复；报告含 saved/skipped/failed/source | backend/home/management/commands/save_events.py 写入 OpenClaw Campus Events connector、IngestionRun、cursor、saved/skipped/failed/source 报告 |

---

## 9. Campus Opportunity Radar

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| OR-1 | P0 | 冻结来源优先级：校官网/学院/创新中心/公开社团/学会/活动平台 | lubw1 + Codex | Done | GATE-5 | source policy review | `docs/campus-opportunity-source-policy.md` 冻结 6 级来源、冲突和联系人准入规则 |
| OR-2 | P0 | 把现有 Bing/CCF/活动行检索封装为 source adapters | lubw1 + Codex | Done | DATA-1 | 每来源 fixture 可单独运行 | `home/opportunity_radar/sources/` + `fetch_events --source/--fixture`；三来源离线 tests |
| OR-3 | P0 | 校验活动日期、时区、报名状态、取消/延期和页面新鲜度 | lubw1 + Codex | Done | OR-2 | 过期/冲突/取消 fixtures | `UniversityEvent` lifecycle/freshness/timezone/date-conflict schema + `refresh_radar_assessment()` |
| OR-4 | P0 | 提取标题、高校、主题、形式、地点、日期、报名链接和原始证据 | lubw1 + Codex | Done | AI-2 | 字段级 ground truth | strict `OpportunityEvent` schema，JSON-LD 优先，每字段 evidence quote + raw evidence |
| OR-5 | P0 | 联系方式只收公开机构/活动邮箱并保存证据 URL 与用途 | lubw1 + Codex | Done | DATA-6、SEC-9 | 猜测/私人邮箱 fixture 被拒绝 | `opportunity_quality.validate_contact_candidate()` + `save_events` evidence-bound `ContactPoint` import |
| OR-6 | P0 | 定义活动可信度：官方性、完整度、新鲜度、日期一致性 | lubw1 + Codex | Done | OR-1、OR-3 | 可解释子分测试 | 35/25/20/20 确定性加权，保存四项子分和 `confidence_explanation` |
| OR-7 | P0 | 低可信、日期冲突、过期活动进入人工核验队列 | lubw1 + Codex | Done | OR-6 | fail-closed state test | pending/verified/rejected 状态机 + assess/verify/reject API/Admin actions；阻断项不可 verify |
| OR-8 | P0 | `/user/events` 只展示已核验且未过期活动，不显示联系点 | lubw1 + Codex | Done | USER-4、API-2 | public allowlist test | `frontend/app/user/events/page.tsx` + `/api/user/events` allowlist test |
| OR-9 | P0 | `/admin/events` 展示来源、可信度、联系证据和核验动作 | lubw1 + Codex | Done | ADMIN-3、OR-7 | UI checklist | `frontend/app/admin/ingestion/page.tsx` + `frontend/app/admin/proposals/page.tsx` 以 fixture 展示核验状态 |
| OR-10 | P1 | 建立重复、过期、错误邮箱、无官方来源的质量评测集 | lubw1 + Codex | Done | GATE-5 | 数据质量报告 | `backend/data/quality/campus-opportunity-eval.json` 8/8 passed；`docs/campus-opportunity-quality-report.json` |

---

## 10. Collaboration Proposal / Outreach

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| CP-1 | P0 | 建立大树审核能力库：媒体、嘉宾、Space、高校行、黑客松、混合活动 | Content Owner | Todo | PM-6、PM-8 | 每条含来源、owner、有效期和批准状态 | - |
| CP-2 | P0 | 定义 match 子分：主题、受众、时间、城市、资源、信息完整度 | AI Owner | Todo | DATA-7 | scoring rubric review | - |
| CP-3 | P0 | 输出契合点、冲突、缺失信息、引用、置信度和建议动作 | AI Owner | Todo | CP-1、CP-2 | strict schema test | - |
| CP-4 | P0 | 准备“高校机器人活动”离线黄金样本 | AI Owner | Todo | GATE-5 | 人工期望提案 + 反例 | - |
| CP-5 | P0 | 生成轻/中/深三档 proposal，明确双方价值、资源和待确认项 | AI Owner | Todo | CP-3、PM-6 | proposal schema + human review | - |
| CP-6 | P0 | 所有合作结论必须引用活动事实或能力库事实 | AI Owner | Todo | CP-5 | citation coverage = 100% 或待确认 | - |
| CP-7 | P0 | 禁止模型承诺未批准的奖金、嘉宾、曝光、投资或主办身份 | AI Owner | Todo | PM-8、SEC-8 | adversarial fixtures | - |
| CP-8 | P0 | 生成一校一 proposal、一校一邮件草稿 | Backend Owner | Todo | DATA-8、CP-5 | 3 校产生 3 个独立对象 | - |
| CP-9 | P0 | `/admin/proposals` 展示证据、diff、三档方案和审批 | lubw1 + Codex | Done | ADMIN-4、CP-8 | UI checklist | `frontend/app/admin/proposals/page.tsx` |
| CP-10 | P0 | 模拟批次审批：未批准不能进入 simulated_sent | Backend Owner | Todo | API-4 | state-machine test | - |
| CP-11 | P1 | 建立事实引用率、个性化差异、虚假承诺和品牌语气 eval | AI Owner | Todo | GATE-5、CP-8 | eval report | - |
| CP-12 | P1 | 将批准 proposal 导出为会前 brief/Markdown，而不只用于邮件 | Backend Owner | Todo | CP-9 | export snapshot test | - |
| CP-13 | P1 | 基于真实回复反馈评估排序；未有足够数据前不训练 | AI Owner | Deferred | MAIL-9 | offline evaluation | - |

### 10.1 真实邮件工作包

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| MAIL-1 | P1 | 接入 Gmail/企业邮箱 OAuth，默认只创建草稿箱 | Backend Owner | Todo | GATE-4、SEC-9 | sandbox account test | - |
| MAIL-2 | P1 | 每封邮件绑定 proposal 版本、contact 证据和幂等键 | Backend Owner | Todo | DATA-9、CP-8 | duplicate retry test | - |
| MAIL-3 | P1 | 批次显示收件人、差异、风险、预计速率和审批人 | lubw1 + Codex | Done | ADMIN-5、MAIL-2 | approval UI checklist | `frontend/app/admin/outreach/page.tsx` mock 批次 UI |
| MAIL-4 | P1 | 实现批次批准、计划时间、单日上限和立即停止 | Backend Owner | Todo | API-5 | fake clock + stop test | - |
| MAIL-5 | P1 | 实现退订、抑制、硬退信和投诉熔断 | Backend Owner | Todo | SEC-9 | suppression tests | - |
| MAIL-6 | P1 | 实现限速、指数退避、provider 超时和半成功恢复 | Backend Owner | Todo | MAIL-4 | reliability matrix | - |
| MAIL-7 | P1 | 禁止拼接 BCC 正文；相同模板也必须独立消息对象 | lubw1 + Codex | Review | MAIL-2 | domain invariant test | 旧 `/admin/events` Gmail compose/BCC 入口已改为模拟审批草稿，不打开邮箱、不发送、不写外部系统；production static grep 未发现 `mail.google.com/bcc`；真实 provider message invariant 待 MAIL-2 |
| MAIL-8 | P1 | 监控 inbox/webhook，保存受控回复快照 | Backend Owner | Todo | MAIL-1 | sandbox reply smoke | - |
| MAIL-9 | P1 | 回复分类 positive/question/decline/ooo/unknown + 人工复核 | AI Owner | Todo | MAIL-8、AI-2 | golden reply eval | - |
| MAIL-10 | P1 | 管理端展示漏斗、下一步、owner 和 SLA | lubw1 + Codex | Done | MAIL-9 | dashboard checklist | `frontend/app/admin/outreach/page.tsx` 展示批次状态/停止开关/限额 |
| MAIL-11 | P1 | 为真实 SMTP/OAuth 发送补充 provider 回执、sent_at、失败原因和重试状态 | Backend Owner | Todo | MAIL-1、MAIL-2、MAIL-6 | 真实发送成功/失败均有审计记录；本地 console backend 不标记 live sent | `OutreachDraftViewSet.approve()` 已有审批后 `send_mail` 路径；需生产化 |

---

## 11. Frontend：用户端与管理端

### 11.1 用户端 `/user`

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| USER-1 | P0 | 冻结 IA：主页、signals、events、recaps、about、cooperate | lubw1 + Codex | Done | GATE-6 | route map 与 PRD 一致 | `frontend/app/user/layout.tsx` + route build 输出 |
| USER-2 | P0 | 新建 `/user` 首页，15 秒解释大树、内容和合作入口 | lubw1 + Codex | Done | USER-1 | 5 秒理解测试 | `frontend/app/user/page.tsx` |
| USER-3 | P0 | 新建 `/user/recaps` 与详情页 | lubw1 + Codex | Done | CR-12、API-2 | approved-only smoke | `frontend/app/user/recaps/page.tsx`、`frontend/app/user/recaps/[id]/page.tsx` |
| USER-4 | P0 | 新建 `/user/events`，含筛选、状态、来源和报名外链 | lubw1 + Codex | Done | OR-8、API-2 | expired hidden test | `frontend/app/user/events/page.tsx`，公开端隐藏联系点 |
| USER-5 | P1 | 新建 `/user/signals`，区分事实、AI 摘要和编辑说明 | lubw1 + Codex | Done | API-2 | visual semantics checklist | `frontend/app/user/signals/page.tsx` |
| USER-6 | P0 | 新建 `/user/about`，展示大树能力、案例和有效日期 | lubw1 + Codex | Done | CP-1 | content review | `frontend/app/user/about/page.tsx` + `capabilityLibrary` fixture |
| USER-7 | P1 | 新建 `/user/cooperate`，明示留资用途和人工响应预期 | lubw1 + Codex | Done | API-6、SEC-9 | consent test | `frontend/app/user/cooperate/page.tsx`，无外部副作用 |
| USER-8 | P0 | 用户端不依赖 X 页面即可完成“看案例 → 找活动 → 了解合作” | lubw1 + Codex | Done | USER-2~7 | teacher journey smoke | `npm --prefix frontend run check` route build + `tests/frontend-routes.test.mjs` |

### 11.2 管理端 `/admin`

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| ADMIN-1 | P0 | 保留现有 Dashboard/events/reviews，修正导航与状态文案 | lubw1 + Codex | Done | QA-1 | route smoke | `frontend/app/admin/layout.tsx` 新增工作台导航 |
| ADMIN-2 | P0 | 新建 `/admin/content` 审核台 | lubw1 + Codex | Done | CR-10、CR-11 | review/publish UI test | `frontend/app/admin/content/page.tsx` |
| ADMIN-3 | P0 | 新建 `/admin/ingestion` 展示运行、游标、失败、成本和重跑 | lubw1 + Codex | Done | DATA-2、CR-3 | run fixtures | `frontend/app/admin/ingestion/page.tsx` |
| ADMIN-4 | P0 | 新建 `/admin/proposals` 匹配与提案审批页 | lubw1 + Codex | Done | CP-9 | golden proposal demo | `frontend/app/admin/proposals/page.tsx` |
| ADMIN-5 | P1 | 新建 `/admin/outreach` 批次、审批、停止和回复漏斗 | lubw1 + Codex | Done | MAIL-3~10 | sandbox smoke | `frontend/app/admin/outreach/page.tsx`，默认 mock/no side effect |
| ADMIN-6 | P0 | 联系邮箱只在授权管理视图出现，默认遮罩 | lubw1 + Codex | Done | SEC-6 | role/visual test | `maskedEmail` fixture + public API allowlist test；旧 `/admin/events` 已隐藏邮箱/电话并改为草稿审批入口 |
| ADMIN-7 | P1 | 展示 Agent 运行引用、模型版本、延迟和人工反馈 | lubw1 + Codex | Done | OBS-1~4 | trace detail UI | `frontend/app/admin/proposals/page.tsx` 展示 `agentRuns` |
| ADMIN-8 | P0 | 在 `/admin/ingestion` 增加运行开关：大树财经活动回顾采集、高校活动采集、合作邮件自动生成、AI 润色建议 | Frontend + Backend Owner | Todo | DATA-1、CR-3、OR-2、MAIL-4、OBS-4 | 开关默认关闭；状态持久化；每次变更写审计；禁用时任务不得运行 | 用户对话新增；“AI 自动审批/自动发送”必须拆成建议与执行，执行仍需人工审批和 GATE-4 |

---

## 12. Agent / AI / Eval / Observability

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| AI-1 | P0 | 建立统一服务端 LLM provider interface | lubw1 + Codex | Done | SEC-2 | Qwen/DeepSeek/fallback contract test | `frontend/app/lib/agent-provider.server.ts` + 合同测试 |
| AI-2 | P0 | 为 classify/dedup/compliance/match/proposal/reply 固定 JSON Schema | lubw1 + Codex | Done | GATE-5 | invalid output retry/fallback tests | `frontend/data/agent-schemas.json` 覆盖 6 类任务；`validateJsonSchema()` 在 provider 返回前校验模型 JSON，失败进入 deterministic fallback；合同测试覆盖 |
| AI-3 | P0 | 实现 deterministic fallback：规则分类、精确去重、固定提案模板 | lubw1 + Codex | Done | AI-2 | no-key golden path | `DeterministicFallbackProvider`；无 Key 自动降级 |
| AI-4 | P0 | 外部来源只作为引用数据，不得成为 system/tool 指令 | Codex | Done | SEC-7 | prompt injection suite | `agent-safety.mjs` 不可信数据包 + 模型前注入隔离；12 条安全 fixture；管理端展示 quarantine |
| AI-5 | P0 | 模型输出每个事实结论绑定 source IDs | Codex | Done | AI-2 | citation coverage test | 六类 schema 强制 claim-level `evidence`；拒绝空/越权/自造引用；`agent-safety.test.mjs` |
| AI-6 | P1 | 缓存相同内容 hash + schema/model 版本的结果 | lubw1 + Codex | Done | DATA-10 | repeated call cost = 0 incremental | `agent-result-cache.mjs` 规范 hash + schema/model 版本隔离、TTL/LRU 与并发合并；cache-hit trace 增量 token/成本为 0 |
| AI-7 | P1 | 建立 20+ 黄金样本：分类、去重、合规、match、reply | lubw1 + Codex | Done | GATE-5 | versioned dataset | `frontend/data/agent-golden-evals.json` v2026-07-11：30 条，覆盖六任务与 7 条低置信反例 |
| AI-8 | P1 | 定义指标：分类 F1、去重 precision/recall、citation coverage、proposal acceptance | lubw1 + Codex | Done | AI-7 | evaluation report | `npm run eval:agents`；`docs/agent-evaluation-report.json` 阈值全通过；回归测试覆盖指标与失败门槛 |
| AI-9 | P1 | 失败时标记 unknown/needs_review，不强行给答案 | lubw1 + Codex | Done | AI-2 | low-confidence fixtures | 六类 schema v3 强制 `decisionStatus`；低置信、未核验、注入与 provider 失败统一 `unknown + needsReview`，不生成可执行答案 |
| AI-10 | P1 | 记录人工修订作为 feedback，但未审查前不自动训练 | lubw1 + Codex | Done | DATA-10 | feedback audit test | `POST /api/admin/agent-runs/{run_id}/feedback/` 持久化脱敏修订、操作者和时间；强制 `trainingEligible=false`、`trainingStatus=not_reviewed`，自动训练请求 fail-closed |
| OBS-1 | P1 | 持久化 AgentRun：run ID、步骤、模型、schema、引用、token、延迟、成本 | lubw1 + Codex | Done | DATA-10 | trace snapshot | `AgentRun` + admin read/metrics API；聚合任务、token、P95、成本、fallback/cache hit |
| OBS-2 | P1 | 每个工具调用记录输入引用、状态、重试和错误，不保存 chain-of-thought | lubw1 + Codex | Done | OBS-1、SEC-11 | privacy snapshot | `record_tool_call()` 仅保存 tool/reference/status/retry/error code；PII/prompt/body fail-closed |
| OBS-3 | P1 | Dashboard 展示按 connector/task 的成功率、P95 延迟和成本 | lubw1 + Codex | Done | OBS-1 | metrics fixture | `/api/admin/agent-metrics/` + `frontend/data/agent-observability.json` + `/admin` 可观测表格 |
| OBS-4 | P1 | 设置单日 API/LLM 预算和超限降级 | lubw1 + Codex | Done | OBS-1 | budget boundary test | `DailyAgentBudget` + `claim_daily_budget()`；超限前 fail closed 并持久化 fallback-only |
| OBS-5 | P1 | 为采集静默失败、连续无新增和异常去重率设置告警 | lubw1 + Codex | Done | CR-3、OBS-1 | fake alert test | `AgentAlert` 幂等告警；silent/no-new/duplicate-rate fake-clock tests |

---

## 13. TreeFinance AI 客服 / RAG

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| CS-1 | P1 | 建立审核知识库：平台介绍、案例、合作模式、资源边界、联系渠道 | Codex | Done | USER-6、CP-1 | 每条含 owner、来源、有效期 | `frontend/data/assistant-knowledge.json` 12 条审核知识 |
| CS-2 | P1 | 检索回答展示引用或信息日期 | Codex | Done | CS-1、AI-1 | groundedness eval | `/api/assistant/chat` 返回 citations + knowledgeAsOf；聊天 UI 展示 |
| CS-3 | P1 | 过期/未知/冲突信息必须拒答或转人工 | Codex | Done | CS-2 | stale/unknown fixtures | `assistant-rag.server.ts` fail-closed 分支 + 测试 |
| CS-4 | P1 | 禁止承诺奖金、嘉宾、曝光、投资、主办身份和回复时间 | Codex | Done | PM-8 | adversarial Q&A tests | 模型调用前策略拦截 + 输出 guardrail + 32 条黄金集 |
| CS-5 | P1 | 提供合作意向转人工，留资前明确用途和同意 | Codex | Done | API-6、SEC-9 | consent/abuse tests | Chat handoff + `/user/cooperate` 同意前禁用保存；无外部副作用 |
| CS-6 | P1 | 为学生与老师提供不同快捷问题，但共享事实来源 | Codex | Done | CS-2 | UX review | `ChatDialog.tsx` 角色切换 + `QUICK_ACTIONS[audience]` |
| CS-7 | P1 | 建立至少 30 个问答黄金集与失败案例 | Codex | Done | CS-1 | answer/citation/refusal report | `assistant-evals.json` 32 条 + `assistant-rag.test.mjs` |
| CS-8 | P1 | 无模型 Key 时降级为 FAQ 检索，不显示假在线状态 | Codex | Done | AI-3 | no-key smoke | `faq_fallback` + `ASSISTANT_FORCE_FALLBACK=1` smoke；UI 展示真实模式 |

---

## 14. 世界杯 × 广州高校行主题包

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| WC-1 | P1 | 选 3~5 所广州高校，以公开院系/实验室/社团来源验证匹配 | Codex | Done | GATE-7、OR-1 | 每校至少 2 个来源 | `frontend/data/demo.json` 5 校 × 2 来源；`docs/world-cup-guangzhou-theme-package.md` |
| WC-2 | P1 | 设计公开课：“全球足球赛事作为事件驱动市场实验室” | Codex | Done | WC-1 | 教学大纲 review | `/demo` 90 分钟四模块；主题包文档 |
| WC-3 | P1 | 设计 AI Agent 赛前叙事/赛后事实复盘挑战 | Codex | Done | WC-2 | challenge brief + fixture | `themePackage.challenge` 四阶段 fixture |
| WC-4 | P1 | 评分只看引用、校准、反方证据和复盘，不看猜中比分 | Codex | Done | WC-3 | rubric + negative tests | `tests/demo.test.mjs` 校验 100% 权重且排除比分/赛果 |
| WC-5 | P1 | 把广州体育消费、跨境电商、内容出海、机器人/AI 形成在地议题 | Codex | Done | WC-1 | 公开来源支持，不用城市刻板印象 | `/demo` 四类在地议题；主题包候选证据矩阵 |
| WC-6 | P1 | 设计一场活动五次传播：赛前、现场、赛后、30 天、90 天 | Codex | Done | WC-2 | 内容日历与 owner | `/demo` Campaign Afterlife；主题包传播 owner 表 |
| WC-7 | P0 | 核验赛事名称、标识、图片和数据许可；不明确则使用通用表达 | Codex | Review | GATE-7 | rights checklist | `/demo` 使用通用表达、无赛事视觉；真实发布仍需内容负责人复核 |
| WC-8 | P0 | 增加无博彩、无投资建议、无收益承诺、无结果保证检查 | Codex | Done | WC-2 | content guardrail test | `/demo` Content Firewall + draft guardrailChecks + `tests/demo.test.mjs` |
| WC-9 | P1 | 生成广州站三档赞助包和 Impact Passport 指标 | Codex | Done | PM-9、WC-6 | sponsor mock report | `/demo` Signal/Lab/Campus 三档与 4 个隐私安全指标 |

---

## 15. Web3 / Proof（可选增强）

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| W3-1 | P1 | 冻结公共 proof payload allowlist 与版本 | Web3 Owner | Review | PM-9、SEC-6 | privacy tests | 现有 mock proof 可复用 |
| W3-2 | P1 | canonical serialization 和确定性 hash | Web3 Owner | Done | - | 同一输入 hash 相同 | 现有 `/api/proofs/anchor` 测试 |
| W3-3 | P1 | Proof 不含 email/contact/body/reply/name/prompt | QA Owner | Done | W3-1 | `npm run test` | 现有领域测试 |
| W3-4 | P2 | 实现 TRON Nile adapter，失败不阻塞 campaign | Web3 Owner | Todo | W3-1、W3-2 | testnet tx + explorer link | - |
| W3-5 | P2 | UI 明确 mock/live 网络与外部副作用 | Frontend Owner | Todo | W3-4 | no fake tx test | - |
| W3-6 | P2 | 生成 sponsor impact proof，只含公共聚合指标 | Web3 Owner | Todo | PM-9、W3-4 | payload review | - |

---

## 16. Demo / Pitch / Launch

| ID | Priority | Task | Owner | Status | Depends On | Verification | Done Evidence |
|---|---|---|---|---|---|---|---|
| DEMO-1 | P0 | 编写 20 秒、1 分钟、3 分钟中英文脚本 | PM Owner | Todo | PM-1、GATE-6 | 数字/角色/步骤一致 | - |
| DEMO-2 | P0 | Demo 首页只保一个主 CTA，并明确用户端/管理端切换 | lubw1 + Codex | Done | USER-1、ADMIN-1 | 5 秒理解测试 | 根导航新增 `/user` 与 `/admin`，`/user` 首页提供老师/运营切换 |
| DEMO-3 | P0 | 一键加载固定 campaign、内容、活动、提案和回复 fixture | lubw1 + Codex | Done | QA-8 | reset 后结果确定 | `frontend/app/lib/public-data.ts` 统一复用 `demo.json` + `golden-gate.json` |
| DEMO-4 | P0 | 主流程每一步显示来源、AI/事实边界和 mock/live 状态 | lubw1 + Codex | Done | SEC-6、AI-5 | visual checklist | `/user/signals`、`/admin/content`、`/admin/outreach` 显示来源/边界/mock |
| DEMO-5 | P0 | 做一次“老师视角 → 运营视角”的 3 分钟完整演示 | PM Owner | Todo | Wave A、Wave B | 3 次均低于 3 分钟 | - |
| DEMO-6 | P0 | 录制 90 秒备份视频与本地 MP4 | PM Owner | Todo | DEMO-5 | 飞行模式可播放 | - |
| DEMO-7 | P0 | 故障演练：X、LLM、数据库、邮箱、链、钱包分别失效 | QA Owner | Todo | QA-8、QA-10 | 15 秒内切到正确 fallback | - |
| DEMO-8 | P0 | 准备评委证据页：测试、schema、来源、成本、proof、限制 | PM Owner | Todo | QA-7、OBS-3 | 所有链接可打开 | - |
| DEMO-9 | P1 | 准备三个媒体标题、海报文案和 30 秒短视频脚本 | Content Owner | Todo | WC-6 | 5 人传播复述测试 | - |
| DEMO-10 | P0 | 最后 6 小时功能冻结，只接受阻断性修复 | QA Owner | Todo | QA-12 | 全员确认与 commit hash | - |

---

## 17. 候选创新与试点后路线

以下任务默认 `Icebox/Deferred`，不得绕过 GATE-1~7 进入 P0。

| ID | Direction | Priority | Status | 进入条件 | 首个可验证结果 |
|---|---|---|---|---|---|
| TR-1 | TreeRing 90：可证伪观点与 30/90 天复查 | Icebox | Deferred | 大树确认趋势公信力优先于运营效率 | 8 条 forecast fixture + deterministic hash |
| TR-2 | TreeRing 公开卡片 | Icebox | Deferred | TR-1 通过人工审核与合规检查 | `/treerings/[id]` 离线 Demo |
| FJ-1 | 教授/创业者/学生/AI 未来陪审团 | Icebox | Deferred | 有真实活动参与者与授权 | 概率提交 + Brier Score fixture |
| CSN-1 | Campus Signal Nodes | P2 | Deferred | 3 所合作高校愿意试点 | 每周信号模板 + 同意机制 |
| CSN-2 | 高校趋势地图 | P2 | Deferred | CSN-1 连续运行 4 周 | 只展示机构与公开信号 |
| MEDIA-1 | 城市命题生成器 | P2 | Deferred | 广州模板验证有效 | 6 城 fixture 与来源 |
| MEDIA-2 | 一场活动五次传播自动模板 | P1 | Todo | WC-6 或真实活动采用 | 五阶段内容资产包 |
| MEDIA-3 | 大树访谈节目检索 + ASR + 嘉宾观点文章 | P1 | Todo | 有公开授权音视频来源、转写许可和编辑审核 | 检索 3 期访谈节目，语音转文字，按嘉宾抽取观点、引用时间戳和反方证据，生成一篇待审核文章 |
| IMPACT-1 | Sponsor Impact Passport | P2 | Deferred | 有 sponsor 指标确认 | 只读报告 + proof IDs |
| TOKEN-1 | Token/DAO 激励 | Icebox | Deferred | 有真实网络、法律评估和反作弊设计 | 不在黑客松阶段实现 |

---

## 18. 团队分工与协作流程

### 18.1 推荐角色

| Role | 负责范围 | 当前 P0 |
|---|---|---|
| PM Owner | 范围、指标、用户访谈、路演 | GATE、PM、DEMO |
| Backend Owner | Django、数据、API、任务、邮件 | DATA、API、CR、OR、MAIL |
| Frontend Owner | `/user`、`/admin`、状态与响应式 | USER、ADMIN、DEMO UI |
| AI Owner | schema、分类、去重、match、proposal、eval | AI、CR AI、CP AI |
| Content Owner | 大树能力库、编辑规范、来源与世界杯内容 | CR taxonomy、CP-1、WC |
| Security Owner | secret、权限、隐私、版权和外联边界 | SEC、WC-7/8 |
| QA Owner | harness、tests、smoke、preflight、故障演练 | QA、DEMO-7/10 |
| Web3 Owner | proof payload、hash 与可选链 adapter | W3 |
| Ops Owner | scheduler、预算、邮箱、告警与 SLA | CR-3、OBS、MAIL policy |

### 18.2 任务认领规则

1. 认领前确认依赖已完成，或把任务标为 `Blocked` 并写明阻塞 ID。
2. 将 Owner 角色替换为真实姓名，将状态改为 `In Progress`。
3. 开工前先补 Verification；无法验证的任务不得开始。
4. 一次 PR 尽量只完成一个任务 ID；PR 标题包含 ID。
5. 实现与测试同 PR；新增字段同步 PRD/API/fixture。
6. 完成后先改为 `Review`，只有验证者复现成功才改 `Done`。
7. `Done Evidence` 必须填写文件、测试结果、截图、报告或 tx；不能只写“已完成”。

### 18.3 分支命名

```text
codex/<task-id>-<short-name>
feature/<task-id>-<short-name>
fix/<task-id>-<short-name>
docs/<task-id>-<short-name>
```

### 18.4 合并标准

- 对应 Verification 在干净环境可复现。
- `npm run test` 通过；P0 合并需 `npm run check` 与相关 smoke 通过。
- 不新增真实 secret、私人联系人、无授权媒体或假 tx。
- UI 显示 loading/error/empty、mock/live 和人工审批边界。
- PRD、architecture、acceptance、tasks 与实现保持一致。
- 不降低既有安全不变量或离线黄金路径。

---

## 19. Definition of Ready / Done

### 19.1 Definition of Ready

任务进入 `In Progress` 前必须满足：

1. 有唯一 ID、Priority、真实 Owner 和明确依赖。
2. 输入、输出、错误行为和外部副作用已写清。
3. Verification 可由另一位成员执行。
4. 所需 fixture、权限、账号/API 或 mock 方案已准备。
5. 涉及真实发布、邮件、PII、版权或链上写入时，安全 Gate 已通过。

### 19.2 Definition of Done

任务标记 `Done` 前必须满足：

1. 实现、测试、文档和 fixture 同步完成。
2. 至少一个自动验证；纯视觉任务有固定视口截图与 checklist。
3. 失败、超时、重复、无 Key 和外部服务不可用行为明确。
4. mock/真实副作用边界在 API 与 UI 可见。
5. 日志不包含 secret、完整 PII、未发布原文或 chain-of-thought。
6. 新 API 有 schema、错误格式、权限和幂等策略。
7. `Done Evidence` 已填写，验证者可独立复现。
8. 不破坏 `install/dev/test/check/demo/smoke` 黄金路径。

### 19.3 每日更新模板

```text
Task: CR-8
Owner: <name>
Status: In Progress
Yesterday: 完成跨源候选生成
Today: 接语义判重与 reason schema
Blocked by: GATE-5 黄金集尚缺 2 条反例
Verification: npm run test -- dedup
Evidence: <PR / file / report>
```

---

## 20. 当前立即行动清单

按顺序执行，不并行开启未满足依赖的工作：

1. `SEC-1~5`：轮换并迁移模型/数据库凭据，增加 secret scan。
2. `QA-1~4`：保持 check/smoke 全绿基线；2026-07-04 `npm run test` 已恢复 26/26。
3. `ADMIN-8`：把 X/高校采集和自动化开关纳入采集运行台，默认关闭并写审计；`CR-16` 后端导入审计已完成。
4. `MAIL-2、MAIL-4、MAIL-6、MAIL-11`：把真实审批发送补齐幂等、限速、provider 回执和失败重试。
5. `GATE-1、GATE-5、GATE-6`：确认主舞台与黄金集。
6. `DATA-1~5、AI-1~3`：冻结内容链路 schema 与降级。
7. `CR-1~13、USER-2~4、ADMIN-2~3`：内容接力站已跑通，下一步补真实 API 授权证据与现场截图。
8. `OR-1~9、CP-1~10、ADMIN-4`：跑通高校机会与提案。
9. `MEDIA-3`：作为路演亮点评估访谈节目 ASR 观点文章，但不得阻塞 P0 主闭环。
10. `DEMO-1~8、QA-7~12`：完成路演、故障和证据冻结。

任何 P1/P2/Icebox 工作不得阻塞以上 P0 顺序。
