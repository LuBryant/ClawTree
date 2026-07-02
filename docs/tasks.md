# ClawTree MVP 任务拆分

原则：按依赖顺序完成。任何 P1 不得阻塞 P0 的离线黄金路径。

## P0 — Harness 与契约

- [x] H01 根目录提供 `install/dev/test/check/demo/smoke` scripts。
- [x] H02 建立唯一 seed 数据文件和最小 Node 测试。
- [x] H03 建立 HTTP smoke runner，可自动启动/停止服务。
- [x] H04 编写 README、背景、PRD、验收标准和任务清单。

## P0 — 数据与 API

- [x] A01 定义 signal/campaign/target/reply/funnel fixture。
- [x] A02 `GET /api/health`。
- [x] A03 `GET /api/demo`。
- [x] A04 `POST /api/outreach/draft`，校验 campaign/target。
- [x] A05 `POST /api/outreach/approve`，强制 draft → approved → simulated_sent。
- [x] A06 `POST /api/proofs/anchor`，使用字段 allowlist 和确定性哈希。
- [x] A07 兼容活动列表 `/api/events` 与统计 `/api/events/stats`。

## P0 — UI

- [x] U01 重写产品首页，一屏说明用户、痛点和价值。
- [x] U02 Demo Console 展示 signal inbox 与来源。
- [x] U03 展示 campaign brief 和目标匹配原因。
- [x] U04 生成并预览外联结构化草稿。
- [x] U05 人工批准、模拟发送、回复 triage。
- [x] U06 显示隐私安全的 proof 结果。
- [x] U07 补齐 loading/error/empty 与移动端状态。

## P0 — QA 与路演

- [x] Q01 `npm run check` 通过。
- [x] Q02 `npm run smoke` 通过且无残留进程。
- [x] Q03 已完成首页、主交互、控制台和 390px 布局验收。
- [x] Q04 黄金路径不读取 Key、钱包、数据库或外部 API。
- [ ] Q05 准备 3 分钟讲稿与 90 秒备份视频。

## P1 — AI 适配器

- [ ] L01 定义 LLM provider interface 与 JSON schema。
- [ ] L02 接入 Qwen 百炼，设置超时、token 上限和降级。
- [ ] L03 接入 DeepSeek 作为分类/备用 provider。
- [ ] L04 建立 20 条黄金样本和 citation/intent/personalization 评测。
- [ ] L05 展示每次 run 的延迟、估算成本和 schema 重试次数。

## P1 — 真实工具

- [ ] T01 接入一个合规实时数据源并做缓存/去重。
- [ ] T02 Gmail/企业邮箱 OAuth 草稿箱模式；仍需人审发送。
- [ ] T03 Reply webhook/轮询与意图分类。
- [ ] T04 TRON Nile proof adapter；失败不阻塞主流程。
- [ ] T05 Campaign 周报导出。

## P2 — 试点后再做

- [ ] P01 PostgreSQL 持久化、身份权限和团队空间。
- [ ] P02 城市/主题 campaign 模板库。
- [ ] P03 赞助方只读报告链接。
- [ ] P04 联系偏好、退订和数据保留策略后台。
- [ ] P05 基于真实回复反馈训练匹配排序，不做无依据的“智能评分”。

## DECISION — 创新方向决策门（全部待做）

这些任务用于决定“做不做”，完成决策不等于承诺实现。

- [ ] D01 用 20 秒话术分别测试 Campaign OS、TreeRing 90、未来陪审团三种叙事，记录 5 位非团队听众的复述准确率。
- [ ] D02 访谈至少 1 位大树财经活动/编辑/商务成员，确认他们更缺运营效率、内容复用、趋势公信力还是赞助证明。
- [ ] D03 决定黑客松主舞台是“外联闭环”还是“TreeRing 可验证趋势”，另一路线保留为后台能力。
- [ ] D04 决定首个主题使用世界杯、HTX Genesis/WAIC，还是广州城市产业命题；世界杯不得成为长期产品边界。
- [ ] D05 为每个候选功能填写用户价值、演示高潮、技术成本、风险和可降级方案后再排期。
- [ ] D06 冻结被选中的功能；未选功能继续留在 backlog，不得顺手加入 P0。

## CANDIDATE — TreeRing 90 / 大树年轮（待选择）

- [ ] TR01 定义 `Claim` schema，明确事实、观点、预测三种类型及可证伪条件。
- [ ] TR02 准备 8–12 条活动观点黄金样本，包含模糊观点、可验证预测和不可验证反例。
- [ ] TR03 实现结构化观点抽取 mock，输出来源、支持证据、反方证据、概率和复查日期。
- [ ] TR04 设计规范化 commitment payload；证明链上字段不含私密联系人、邮件和完整未公开稿件。
- [ ] TR05 实现确定性 hash 与 mock TRON Nile commitment，相同输入必须产生相同哈希。
- [ ] TR06 实现 30/90 天 mock verification，允许 `supported/refuted/mixed/inconclusive` 四种结论。
- [ ] TR07 展示证据截止时间、模型版本和人工审核状态，禁止 AI 结论冒充编辑结论。
- [ ] TR08 新增 `/treerings/[id]` 公开卡片，形成《三个月前，他们说对了吗？》分享视觉。
- [ ] TR09 为 extract/commit/verify 增加领域测试和 smoke 断言。

## CANDIDATE — 未来陪审团（待选择）

- [ ] FJ01 定义教授、创业者、学生、AI Agent 四种参与角色和匿名/署名同意流程。
- [ ] FJ02 为同一问题提交 0–100% 概率、理由和来源，提交后只能追加修正版本。
- [ ] FJ03 使用 Brier Score 或同类可解释指标评价概率校准，不使用粉丝数或投资收益。
- [ ] FJ04 设计“谁更懂未来”对比页面和活动现场大屏模式。
- [ ] FJ05 增加免责声明和内容规则，禁止币价竞猜、收益承诺和博彩引导。

## CANDIDATE — Campus Signal Nodes（待选择）

- [ ] CS01 选 3 所已有合作高校做节点试点，不在 MVP 追求全国覆盖。
- [ ] CS02 定义每周信号提交模板：原始来源、当地背景、为什么重要、验证状态和授权范围。
- [ ] CS03 设计来源质量和贡献信誉，不用 Token 或拉人头数量作为激励。
- [ ] CS04 生成高校 AI×Web3 趋势地图；页面只展示机构与公开信号，不展示个人画像。
- [ ] CS05 制定学生节点同意、署名、撤回和数据保留规则。

## CANDIDATE — 媒体与商业玩法（待选择）

- [ ] MC01 实现“一场活动五次传播”模板：活动前、现场、会后、30 天、90 天。
- [ ] MC02 实现城市命题生成器；先完成南京、广州、杭州、上海、成都、香港六套离线 fixture。
- [ ] MC03 为每个城市主题验证高校专业、当地产业和公开来源，禁止仅靠城市刻板印象生成。
- [ ] MC04 定义 `ImpactPassport` 的公开指标、证据和隐私字段 allowlist。
- [ ] MC05 设计赞助方只读页，明确赞助方不能修改编辑验证结论。
- [ ] MC06 生成大树对外提案话术：“把 300+ 场内容变成会成长的趋势图谱”。
- [ ] MC07 设计 3 个媒体标题和 30 秒短视频脚本，验证是否比“AI 自动写邮件”更容易被复述。

## 每个任务的 Definition of Done

1. 有明确输入、输出和错误行为。
2. 至少一个自动验证或 smoke 断言。
3. mock/真实副作用边界在 UI 和 API 中可见。
4. 新字段更新 PRD/API 文档与 fixture。
5. 不引入新的 Key、数据库或外部服务作为默认启动前提。
