# ClawTree（树爪智动）

ClawTree 是给大树财经使用的 AI 媒体活动增长操作系统：把分散的高校活动、公开内容和实时热点信号，转成可审核的内容回顾、合作提案、逐校外联和可验证执行证据。

它不是活动黄页，也不是自动群发器。核心闭环是：

```text
公开内容闭环：X/高校/活动来源 -> 分类去重 -> 合规编辑 -> 人审发布 -> /user
合作增长闭环：高校活动 -> 联系证据 -> 契合分析 -> 逐校提案 -> 人审外联 -> 回复复盘
```

## 当前已经做了什么

- **离线黑客松黄金路径**：`/demo` 可以完整演示“可信信号 -> campaign -> 目标高校 -> AI 外联草稿 -> 人工批准 -> mock 回复 -> mock TRON proof”，默认无数据库、无模型 Key、无邮箱、无钱包、无外部副作用。
- **用户端 `/user`**：已有首页、Signals、Events、Recaps、About、Cooperate，面向高校老师/学生展示可访问的公开内容、活动机会和合作入口；公开 API 有字段 allowlist，不返回联系人、prompt、风险原文和邮件正文。
- **管理端 `/admin`**：已有活动浏览器、内容审核台、采集运行台、合作提案页、外联审批台、回顾管理页，展示来源、游标、成本、失败、提案分档、审批状态和 mock/live 边界。
- **真实 Django 原型**：已有高校活动模型、TreeFinance 推文回顾、内容接力 schema、采集运行记录、外联草稿审批、链上凭证字段；支持 OpenClaw JSON 导入、活动检索采集、X 推文导入/采集、DeepSeek/OpenAI-compatible 分析和去重。
- **AI 工程基线**：前端客服走同源服务端代理；agent schema 覆盖 classify/dedup/compliance/match/proposal/reply；无 Key 时有 deterministic fallback，便于断网演示。
- **外联边界**：活动浏览器只生成草稿；真实发送只在 Django 外联审批通过后发生，并且 SMTP 必须通过环境变量显式配置。本地默认使用 console email backend。
- **Web3 可选增强**：Next mock proof 使用隐私 allowlist 和确定性 hash；`contracts/` 里有 Hardhat 合约与测试，可作为真实链上 proof 的后续增强。

## 5 分钟离线启动

前置条件：Node.js 20.9+，推荐 Node.js 22。

```bash
npm run install
npm run demo
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

常用入口：

- `/`：产品首页
- `/demo`：3 分钟端到端离线 Demo
- `/user`：高校老师/学生视角
- `/admin`：大树运营/编辑视角

如果 3000 端口被占用：

```bash
npm run demo -- --port 3333
```

## 验证命令

```bash
npm run test       # Node 内置测试，覆盖数据、AI 边界、路由和隐私 allowlist
npm run smoke      # 自动启动临时服务并验证主流程
npm run check      # secret scan + docs + matrix + tests + lint/typecheck/build
npm run preflight  # 决赛前完整自检并写入 docs/harness-preflight-report.json
```

可选合约验证：

```bash
npm run install:contracts
npm run test:contracts
```

## 启动真实 Django 后端原型

默认 Demo 不依赖 Django。要使用真实采集、数据库、外联审批和后台 API，另开一个终端：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_events
python manage.py runserver 127.0.0.1:8000
```

再开前端终端，让 Next 调 Django：

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api npm run demo
```

Django 会自动读取仓库根目录 `.env` 和 `backend/.env`。可以从 `.env.example` 复制一份开始配置：

```bash
cp .env.example .env
```

本地默认数据库是 SQLite；只有设置 `DATABASE_ENGINE=mysql` 时才需要 `MYSQL_*`。本地未配置 SMTP 时，审批发送会写到 console backend，不会真的发邮件；真实发送必须配置 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASS` 和 `DEFAULT_FROM_EMAIL`。

## 真实数据与采集命令

OpenClaw 高校活动 JSON 导入：

```bash
cd backend
python manage.py save_events data/highSchool/events_20260704_1956.json --dry-run
python manage.py save_events data/highSchool/events_20260704_1956.json
```

高校活动自动检索与 LLM 提取，需要 `OPENAI_API_KEY` 或兼容网关配置：

```bash
python manage.py fetch_events --output-json --score-min 5 --dry-run
```

TreeFinance X 推文导入/采集，需要 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`；实时采集还需要 `TWITTER_API_KEY`：

```bash
python manage.py fetch_tweets_v2 --import-only data/twitterData.json --dry-run
python manage.py fetch_tweets_v2 --pages 3
python manage.py fetch_tweets_v2 --dedup
```

## 配置边界

默认离线 Demo 不读取任何密钥。真实试点建议配置：

- `DEEPSEEK_API_KEY`：推文筛选、摘要、润色和邮件草稿生成的低成本模型。
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`：高校活动提取或 OpenAI-compatible 备用模型。
- `TWITTER_API_KEY`：TreeFinance X 时间线采集。
- `DATABASE_ENGINE`、`SQLITE_PATH` 或 `MYSQL_*`：本地 SQLite 或生产 MySQL。
- `SMTP_*`、`DEFAULT_FROM_EMAIL`：只在真实审批发送时使用。
- `TRON_RPC_URL`、`DEPLOYER_PRIVATE_KEY`：只在演示真实上链时使用，私钥绝不进入前端。

## 目录

```text
ClawTree/
├─ frontend/              # Next.js UI、mock API、用户端和管理端
├─ frontend/data/         # demo.json、golden-gate.json、agent schema
├─ backend/               # Django 真实采集、数据库和外联审批原型
├─ backend/data/          # OpenClaw / X 采集样本数据
├─ contracts/             # 可选 Solidity proof 合约
├─ scripts/               # smoke、preflight、secret scan、harness 工具
├─ tests/                 # Node 领域/边界测试
└─ docs/                  # PRD、架构、验收、任务和验证报告
```

## 设计原则

- 先证明“发现 -> 决策 -> 外联 -> 证据”闭环，再扩来源和自动化程度。
- 所有外部事实必须带来源；AI 结论和事实分开展示。
- 邮件发送、公开发布、链上写入都必须人审。
- 批量外联必须一校一稿、逐批审批、限速和可退订，禁止 BCC 冒充个性化。
- 链上只存哈希、时间和公共活动 ID，不存联系人、邮件正文或回复。

详细背景见 [docs/quickstart-background.md](docs/quickstart-background.md)，产品范围见 [docs/prd.md](docs/prd.md)，工程任务见 [docs/tasks.md](docs/tasks.md)。
