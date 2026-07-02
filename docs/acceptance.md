# ClawTree MVP 验收标准

本文件是交付检查表。每个 P0 功能必须能由命令、API 响应或清晰的人工步骤验证。

## A. Harness

- [ ] `npm run install` 在 Node.js 20.9+ 的干净环境成功。
- [ ] `npm run test` 通过数据、状态机和隐私字段测试。
- [ ] `npm run check` 通过 test、ESLint、TypeScript 和 production build。
- [ ] `npm run demo` 启动后 `/`、`/demo` 可访问。
- [ ] `npm run smoke` 自动走通 health → demo → draft → approve → anchor 并返回退出码 0。

## B. 产品主流程

- [ ] `/demo` 展示至少 4 条带原始 URL、发布时间、发布者和验证状态的信号。
- [ ] Demo 明确区分公开事实、AI 推断和 mock 数据。
- [ ] 至少 1 个 campaign 引用 3 条以上信号，并说明目标、受众和内容形式。
- [ ] 至少 3 个高校目标有 0–100 分数和两条可解释理由。
- [ ] `POST /api/outreach/draft` 返回 `subject/body/personalization/citationIds/guardrailChecks/status`。
- [ ] 草稿至少引用 2 条信号，guardrail checks 全部是布尔值。
- [ ] 未批准的草稿不得显示为 sent；批准后状态只能是 `simulated_sent`，并返回 `externalSideEffect:false`。
- [ ] 回复样例包含意图、置信度、摘要和下一步建议。
- [ ] 锚定结果包含 network、payloadHash、txHash 和明确的 mock 标识。

## C. 安全和可信度

- [ ] 所有 Demo 联系方式都显示 `MOCK`，不冒充真实高校联系方式。
- [ ] API 不执行真实邮件发送、公开发帖或链上写入。
- [ ] Proof payload allowlist 不含邮箱、联系人姓名、正文、回复原文或模型 prompt。
- [ ] 同一 campaign/draft 输入产生相同 payload hash。
- [ ] 页面不把 AI 生成内容描述为已确认合作。
- [ ] 金融内容包含“教育/活动策划，不构成投资建议”的边界。

## D. 体验和路演

- [ ] 评委从打开 `/demo` 到得到凭证不超过 3 分钟。
- [ ] 所有主要按钮有 loading、成功或错误反馈。
- [ ] 390px 和 1440px 视口无阻断性布局问题。
- [ ] 无网络、无模型 Key、无钱包、无数据库时黄金路径仍可运行。
- [ ] README 的命令、端口与实际实现一致。

## E. 可选增强（不阻塞 P0）

- [ ] Qwen/DeepSeek 适配器能在 10 秒内返回 schema 合法输出，失败自动降级 fixture。
- [ ] 至少一个真实只读信号连接器带缓存和来源追踪。
- [ ] 一次真实 TRON Nile 交易有浏览器链接，且 payload 通过隐私测试。
- [ ] 合约测试独立通过：`npm run install:contracts && npm run test:contracts`。
