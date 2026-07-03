# ClawTree（树爪智动）

ClawTree 是大树财经的 AI 媒体活动增长操作系统：把分散的高校活动与实时热点信号，在 15 分钟内转成可审核的选题、合作对象、个性化外联和可验证执行凭证。

当前仓库是一套面向黑客松的 **可运行 harness**。默认使用本地演示数据和 mock API，不需要数据库、模型 Key、邮箱或钱包；现场网络不稳定时仍能完整走通主流程。生产接入通过适配器逐步替换，不改变产品状态机。

## 当前状态与规划边界

- 默认可运行黄金路径：`/` 产品页、`/demo` 离线 Demo、mock API 与 smoke test。
- 已有真实原型：Django 高校活动采集、TreeFinance X 推文采集、DeepSeek 筛选/摘要/风险处理、80% 语义去重，以及 `/admin`、`/admin/events`、`/admin/reviews`。
- 规划中但尚未实现：独立 `/user` 门户、每日推文调度、公众号合规输入、内容发布审批、合作匹配/提案、可靠邮件审批发送。

新增规划只记录在 PRD、验收和任务文档中，不应被理解为当前可用功能。

## 5 分钟启动

前置条件：Node.js 20.9+，推荐 Node.js 22。

```bash
npm run install
npm run demo
```

打开 <http://127.0.0.1:3000/demo>。

若 3000 端口已被占用，可运行 `npm run demo -- --port 3333`，然后打开对应端口。

Windows PowerShell 同样使用上述命令；若 `npm` 被执行策略拦截，可将它替换为 `npm.cmd`。

## Demo 流程

1. 在 `/demo` 查看来自高校行、HTX Genesis/WAIC、世界杯财经热点的带来源信号。
2. 选择“广州高校行 × 世界杯事件驱动财经素养”机会和目标高校。
3. 点击“生成外联草稿”，查看 Agent 的结构化输出、引用来源和风险检查。
4. 点击“人工批准并模拟发送”。系统不会真的发邮件。
5. 点击“生成链上凭证”，得到不含邮件正文与个人信息的 mock TRON Nile 哈希。

## Harness 命令

```bash
npm run install          # 安装默认 Demo 所需依赖
npm run dev              # 开发模式
npm run test             # Node 内置测试，无额外测试依赖
npm run check            # 测试 + lint + TypeScript + production build
npm run demo             # 启动可交互 Demo
npm run smoke            # 启动临时服务并验证端到端主流程
```

智能合约是可选增强，不阻塞默认 Demo：

```bash
npm run install:contracts
npm run test:contracts
```

## 目录

```text
ClawTree/
├─ frontend/              # Next.js UI + mock Route Handlers
├─ frontend/data/demo.json  # 唯一演示数据源
├─ tests/                 # 最小领域/数据测试
├─ scripts/smoke.mjs      # HTTP 主流程 smoke test
├─ contracts/             # 可选 Solidity 凭证合约
├─ backend/               # Django 真实采集/管理原型，不在默认离线 Demo 链路
└─ docs/
   ├─ quickstart-background.md
   ├─ prd.md
   ├─ acceptance.md
   └─ tasks.md
```

详细背景见 [docs/quickstart-background.md](docs/quickstart-background.md)，产品范围见 [docs/prd.md](docs/prd.md)，目标技术边界见 [docs/architecture.md](docs/architecture.md)。

## 配置边界

默认 Demo 不读取任何密钥。进入真实试点后建议新增：

- `DASHSCOPE_API_KEY`：阿里百炼 Qwen（主模型，OpenAI-compatible API）。
- `DEEPSEEK_API_KEY`：成本敏感任务或备用模型。
- X API / Google Programmable Search 或合规数据服务：实时信号发现。
- Gmail/企业邮箱 OAuth：仅在人审后发送，禁止保存明文令牌。
- `DATABASE_URL`：PostgreSQL；MVP 本地可继续使用 JSON/SQLite。
- `TRON_RPC_URL`、`DEPLOYER_PRIVATE_KEY`：只在演示真实上链时使用，私钥绝不进入前端。

## 设计原则

- 先证明“发现 → 决策 → 外联 → 证据”闭环，再扩来源和自动化程度。
- 所有外部事实必须带来源；AI 结论和事实分开展示。
- 邮件发送、公开发布、链上写入均须人审。
- 批量外联必须一校一稿、逐批审批、限速和可退订；禁止用拼接 BCC 冒充个性化。
- 内容“去敏”只做合规风险识别、客观改写建议和可审计人审，不用于绕过规则。
- 链上只存哈希、时间和公共活动 ID，不存联系人、邮件正文或回复。
- 世界杯是首个热点增长模板，不把产品锁死成赛事工具。
