# ClawTree MVP 产品需求文档

版本：0.3
日期：2026-07-03
目标：72 小时黑客松可交付，并可直接承接广州高校行小规模试点。

## 1. 项目一句话描述

ClawTree 是大树财经的 AI 媒体活动增长操作系统：将分散的高校活动与实时热点信号，在 15 分钟内转成可审核的选题、合作名单和个性化外联，并用不含隐私的链上哈希证明执行结果。

候选升级定位（尚未决定进入 MVP）：

> **ClawTree · TreeRing「大树年轮」**：让大树不只报道趋势，而是提前发现趋势、公开记录判断，并在 30/90 天后回来验证。

候选传播口号：**“不是追热点，而是证明我们比热点更早看见它。”**

### 1.1 近半年公开动态调研结论

本轮调研核查了大树财经公开 X 主页、近期时间线缓存、用户提供的帖子、Space 记录和高校行复盘。X 高级搜索存在登录墙，因此结论用于产品方向判断，不视为完整的半年推文统计。

调研得到四个相对稳定的业务信号：

1. **大树是资源连接型媒体，而不只是资讯账号。** 公开定位强调内容、资源、Web3 Space、品牌孵化、行业会议和定制服务；与 Aurellix 的合作也覆盖 RWA 内容、峰会、项目生态及华语/东南亚传播。
2. **高校行已成为系列化 IP。** 公开复盘显示路线已覆盖浙大、复旦、交大、南信大并继续前往广州，同时连接清华、浙大、复旦、香港大学等学生区块链组织。
3. **大树擅长把热点快速转成 Space、活动与合作。** 近半年主题包括 AI Agent × RWA、AI 数据权益、世界杯/预测市场、文娱 IP RWA、稳定币、跨境产业、HTX Genesis/WAIC 等。
4. **真正值得产品化的缺口是内容资产沉淀。** 大树已经拥有大量活动、嘉宾、合作伙伴和媒体矩阵；ClawTree 不应只“帮他们找高校”，而应把一次性活动转成可复用的观点图谱、后续内容、赞助证明和校园节点网络。

产品策略因此调整为三层，但仅第一层属于当前已承诺 MVP：

- **Backstage — Campaign OS（当前 MVP）**：信号、策划、匹配、外联、审批和漏斗。
- **Onstage — TreeRing 90（候选）**：提取可验证观点、时间戳存证、30/90 天后复查，形成媒体栏目。
- **Network — Campus Signal Nodes（候选）**：把高校合作方变成持续贡献本地信号的校园节点网络。

调研依据：

- [大树财经 X 主页](https://x.com/TreefinanceCN)
- [全球高校行启动](https://x.com/TreefinanceCN/status/2059550267524186527)
- [南信大高校行完整复盘](https://news.cnyes.com/news/id/6498641)
- [广州高校行第五站](https://x.com/TreefinanceCN/status/2071559653612552638)
- [HTX Genesis / WAIC](https://x.com/TreefinanceCN/status/2069611885700489685)
- [世界杯热点内容](https://x.com/TreefinanceCN/status/2065003624980455715)
- [文娱资产 RWA](https://x.com/TreefinanceCN/status/2066777563628990943)
- [Aurellix 战略合作](https://x.com/TreefinanceCN/status/2068136750946660786)

## 2. 目标用户

### 主要用户：大树财经活动/生态运营

- 每周寻找高校活动、策划高校行并联络主办方。
- 需要高效率，但不能接受品牌失控或错误群发。
- 成功定义：更短的准备时间、更多合格机会、更清晰的跟进状态。

### 次要用户：大树财经编辑/内容团队

- 将热点和活动转成 X Space、采访、报道与趋势周报。
- 成功定义：选题有证据、能复用、能连接嘉宾与活动。

### 观察用户：赞助方/合作伙伴

- 关心覆盖了哪些高校、形成哪些内容和合作线索。
- 成功定义：看到来源可信、口径清晰、可验证的 campaign 报告。

### 外部触达对象：高校老师、创新中心和学生社团负责人

- 接收清晰、相关、不过度群发的合作邀请。
- 不要求注册 ClawTree；通过邮件/表单回复即可。

## 3. 用户痛点

| 痛点 | 当前代价 | MVP 解法 |
|---|---|---|
| 信号分散且重复 | 每次 campaign 花数小时搜索、复制和核对 | 统一信号卡片、来源、抓取时间、去重和验证状态 |
| 热点无法快速变成活动 | 编辑、活动、商务各写一套方案 | Agent 生成带依据的 opportunity brief 与复用内容 |
| 找到活动但不知道先联系谁 | 高价值目标淹没在表格中 | 可解释匹配分：主题、城市、时间、组织画像、联系方式 |
| 外联重复且容易“AI 味”过重 | 低回复率、品牌风险 | 结构化草稿、引用约束、风险检查、强制人审 |
| 回复和进度散落 | 无法统计漏斗和复盘 | campaign 状态机与回复意图分类 |
| 赞助价值不可证明 | 难以续约和规模化 | 可导出的漏斗报告和隐私安全的链上摘要凭证 |
| 嘉宾观点随活动结束而消失 | Space/活动只形成一次传播，无法长期追踪 | 候选：抽取可验证观点并设置 30/90 天复查 |
| 无法证明“何时看见趋势” | 事后总结缺少时间可信度，媒体判断力难以沉淀 | 候选：对观点、证据和复查日期做链上时间戳 |
| 高校关系仍是联系人列表 | 每站重新组织，校园洞察不能持续回流 | 候选：Campus Signal Nodes 与贡献信誉机制 |

## 4. Demo 场景

**世界杯 × 广州高校行增长战役。** 系统读取 4 条带公开来源的信号：广州高校行第五站、全球高校行 AI 数据资产 AMA、HTX Genesis/WAIC，以及世界杯事件驱动市场讨论。Agent 生成“世界杯 × AI：事件驱动市场与数据权益”校园内容机会，匹配广州高校，生成个性化邀请。运营人员检查引用与风险后批准模拟发送，系统解析一封模拟正向回复，最后为 campaign 摘要生成 TRON Nile mock 凭证。

3 分钟演示脚本：

1. 30 秒：信号墙展示来源可信度与机会分。
2. 45 秒：解释 Agent 为什么把三个信号组合成一个 campaign。
3. 45 秒：生成结构化外联，突出人审、引用和 guardrails。
4. 30 秒：模拟回复分类和下一步建议。
5. 30 秒：生成不含 PII 的凭证哈希和赞助漏斗。

### 4.1 候选增强 Demo：TreeRing 90（待决策，不阻塞当前 Demo）

在现有“信号 → campaign → 外联 → 凭证”之后增加：

1. AI 从活动资料中提取 3 个可证伪的趋势判断，区分事实、观点和推断。
2. 教授、创业者、学生和 AI Agent 对同一问题给出概率与证据，组成“未来陪审团”。
3. 将观点、来源、置信度、验证指标和复查日期规范化哈希并模拟上链。
4. 模拟 30/90 天后的公开证据检索、反证检查和校准评分。
5. 生成《三个月前，他们说对了吗？》媒体卡片和赞助影响报告。

这个增强的高潮不再是“邮件已发送”，而是：**一枚在结果发生前就已经存在的观点时间戳。**

## 5. MVP 功能列表

### P0：必须完成

1. **Signal Inbox**：展示至少 4 条种子信号，包含 URL、来源、时间、类型、验证状态和摘要。
2. **Opportunity Brief**：将信号组合为一个 campaign，显示受众、价值、内容形式、时间与引用 ID。
3. **Target Match**：至少 3 个高校目标及可解释评分；联系方式在 Demo 中必须明显标记为 mock。
4. **Outreach Draft**：根据目标和 campaign 返回固定 schema 的邮件主题、正文、个性化理由、引用与风险检查。
5. **Human Approval**：草稿未经批准不得进入 `simulated_sent`；所有发送仅模拟。
6. **Reply Triage**：种子回复归类并给出下一步建议。
7. **Proof Anchor**：对公共 campaign 摘要做确定性哈希；Demo 返回 mock 交易 ID 和网络标识。
8. **Dashboard**：展示信号、目标、外联和回复的漏斗指标。
9. **Harness**：`install/dev/test/check/demo/smoke` 全部可运行。

### P1：时间允许

1. Qwen/DeepSeek OpenAI-compatible 适配器和结构化输出重试。
2. 一条真实只读数据连接器（优先官方 X API 或 Google 搜索结果）。
3. 草稿导出到 Gmail 草稿箱，不自动发送。
4. 真实 TRON Nile 写入及区块浏览器链接。
5. 周报 Markdown/PDF 导出。

### 候选创新功能：全部待决策

以下功能已写入产品路线，但在产品负责人明确选择前不得进入 P0：

1. **TreeRing 90 / 大树年轮**：观点抽取、反证条件、时间戳、30/90 天复查和准确性报告。
2. **未来陪审团**：教授、创业者、学生和 AI 对同一组问题提交概率预测并公开复盘。
3. **Campus Signal Nodes**：高校负责人和 Campus Agent 共同贡献当地公开信号，形成高校趋势地图。
4. **一场活动五次传播**：活动前预测、现场观点、会后复盘、30 天追踪、90 天验证。
5. **城市命题生成器**：结合当地高校专业与产业，为不同城市生成不可复制的主题。
6. **Sponsor Impact Passport**：向赞助方展示高校覆盖、内容资产、合作线索和可验证影响。

## 6. 明确不做什么

- 不做自动群发、自动公开发帖或绕过人审。
- 不做通用 CRM、学生社交网络、票务和报名支付。
- 不做世界杯博彩、投资建议、自动交易或资产托管。
- 不抓取登录墙后的个人信息，不购买或猜测私人邮箱。
- 不将姓名、邮箱、邮件正文、回复或画像上链。
- 不承诺实时覆盖所有高校；MVP 只证明可追溯闭环。
- 不在关键 Demo 链路依赖多个后端服务、多个模型或真实测试网。
- 不在 72 小时内做 DAO 治理、Token 激励或多链部署。
- 未经明确决策，不把 TreeRing、未来陪审团或校园节点网络加入当前黄金路径。
- TreeRing 不做博彩、代币价格竞猜或投资收益排行榜；只追踪可验证的公共趋势判断。

## 7. 数据模型

所有实体包含 `id`、`created_at`、`updated_at`（种子 JSON 可省略更新时间）。生产环境使用 UUID；Demo 使用可读 ID。

### `Source`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 来源 ID |
| platform | enum | `x/google/campus/luma/manual` |
| publisher | string | 发布者 |
| url | URL | 原始链接 |
| published_at | datetime | 发布时间 |
| fetched_at | datetime | 抓取时间 |
| content_hash | string | 规范化正文哈希 |
| verification | enum | `verified/unverified/stale` |

### `Signal`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 信号 ID |
| source_id | string | 来源外键 |
| kind | enum | `campus/hackathon/topic/sports/partner` |
| title/summary | string | 只描述来源支持的事实 |
| tags | string[] | 主题标签 |
| city | string? | 城市 |
| starts_at | datetime? | 相关时间 |
| confidence | number | 0–1，事实抽取置信度 |
| status | enum | `new/verified/rejected/used` |

### `Campaign`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | campaign ID |
| name | string | 名称 |
| objective | string | 可度量目标 |
| audience | string[] | 受众 |
| angle | string | 核心内容角度 |
| format | string[] | 校园分享/X Space/报道等 |
| signal_ids | string[] | 引用信号 |
| owner | string | 内部负责人 |
| status | enum | `draft/review/active/complete/archived` |

### `Organization` 与 `Contact`

`Organization` 保存高校/社团/伙伴的公开资料、城市、标签和来源。`Contact` 单独保存公开商务联系方式、同意/退订状态和来源；联系人数据永不上链。Demo 的联系人必须有 `is_mock: true`。

### `Match`

| 字段 | 类型 | 说明 |
|---|---|---|
| campaign_id/organization_id | string | 复合关系 |
| score | integer | 0–100 |
| reasons | string[] | 可解释评分原因 |
| missing_fields | string[] | 缺失信息 |
| status | enum | `suggested/shortlisted/rejected` |

### `Outreach`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 外联 ID |
| campaign_id/target_id | string | 关联对象 |
| subject/body | string | 草稿；生产环境需加密/权限控制 |
| personalization | string[] | 个性化依据 |
| citation_ids | string[] | 使用的信号 |
| guardrail_checks | object | 事实、PII、退订、承诺检查 |
| status | enum | `draft/approved/simulated_sent/sent/replied/closed` |
| approved_by/approved_at | string/datetime? | 审批审计 |

合法状态转换：`draft → approved → simulated_sent|sent → replied → closed`。禁止跳过 `approved`。

### `Reply`

保存 `outreach_id`、原文（受控）、`intent`（positive/question/decline/ooo/unknown）、置信度、抽取联系人、下一步建议和是否需要人工复核。

### `Proof`

保存 `campaign_id`、`payload_version`、`payload_hash`、`network`、`tx_hash`、`anchored_at` 和公共字段清单。哈希 payload 只包含来源 ID、campaign ID、批准事件、聚合计数和时间，不含 PII。

### `AgentRun`

保存 `run_id`、`task_type`、模型/规则版本、输入引用、结构化输出、token/延迟、工具调用、错误和人工反馈，用于评测与成本追踪。

### 候选数据模型（待决策后实施）

#### `Claim`

保存活动中可验证的观点：`speaker_id`、`statement`、`claim_type`、`evidence_source_ids`、`counter_evidence`、`falsification_criteria`、`confidence`、`review_at` 和 `status`。`claim_type` 至少区分 `fact/opinion/forecast`，只有 `forecast` 进入准确性复查。

#### `ForecastCommitment`

保存 `claim_id`、`participant_role`（professor/founder/student/ai）、概率、提交时间、规范化 payload hash、链和交易哈希。提交后只允许追加修正记录，不覆盖原判断。

#### `VerificationRun`

保存 `claim_id`、复查日期、支持/反对证据、数据截止时间、结论、评分、模型版本和人工审核状态。AI 只能提出建议，最终公开结论必须经过编辑审核。

#### `CampusNode`

保存高校、公开社团、节点负责人授权状态、主题能力、信号贡献、来源质量和贡献信誉。不得把学生隐私、社交画像或未经同意的联系方式写入节点画像。

#### `ImpactPassport`

保存 campaign 的高校覆盖、内容产出、合格线索、公开互动和 proof IDs。赞助资金与编辑结论分离，赞助方不得修改观点验证结果。

## 8. API 列表

MVP Route Handlers 均以 `/api` 开头；写操作默认 mock，不产生外部副作用。

| 方法 | 路径 | 用途 | MVP |
|---|---|---|---|
| GET | `/api/health` | 服务、数据与 demo 模式健康状态 | 实现 |
| GET | `/api/demo` | 一次返回 Demo 信号、campaign、目标、漏斗 | 实现 |
| POST | `/api/outreach/draft` | `{campaignId,targetId}` 生成结构化草稿 | 实现 |
| POST | `/api/outreach/approve` | `{draftId,approvedBy}` 人审并模拟发送 | 实现 |
| POST | `/api/proofs/anchor` | `{campaignId,draftId}` 生成公共摘要凭证 | 实现 |
| GET | `/api/events` | 兼容已有活动浏览器的种子事件列表 | 实现/兼容 |
| GET | `/api/events/stats` | 活动统计 | 实现/兼容 |
| POST | `/api/signals/ingest` | 真实连接器写入信号 | P1 |
| POST | `/api/replies/classify` | 结构化回复意图 | P1（Demo 使用种子结果） |
| GET | `/api/reports/:campaignId` | campaign 周报 | P1 |
| POST | `/api/claims/extract` | 从已核验活动资料抽取结构化观点 | 候选 |
| POST | `/api/claims/:id/commit` | 提交概率、证据和复查日期并生成哈希 | 候选 |
| POST | `/api/claims/:id/verify` | 运行证据检索与 30/90 天复查 | 候选 |
| GET | `/api/treerings/:id` | 获取公开年轮卡片与历史验证记录 | 候选 |
| GET | `/api/campus-nodes` | 高校趋势节点地图 | 候选 |
| GET | `/api/impact-passports/:campaignId` | 赞助影响护照 | 候选 |

统一错误格式：`{ "error": { "code": string, "message": string, "retryable": boolean } }`。写 API 生产化后需要鉴权、幂等键与审计记录。

## 9. 页面列表

| 页面 | 路径 | 目的 |
|---|---|---|
| 产品首页 | `/` | 15 秒解释价值、用户和主 Demo 入口 |
| Demo Console | `/demo` | 单页走通信号 → 草稿 → 审批 → 凭证 |
| 运营概览 | `/admin` | 漏斗、重点机会、系统状态 |
| 活动/信号浏览 | `/admin/events` | 筛选已有活动；保留已有页面 |
| Campaign 详情 | `/campaigns/[id]` | P1，完整时间线和报告 |
| 设置/连接器 | `/settings` | P1，模型、数据源、邮件和链配置 |
| TreeRing 公开卡 | `/treerings/[id]` | 候选，展示原始判断、证据、时间戳与复查结果 |
| 未来陪审团 | `/jury/[campaignId]` | 候选，比较四类参与者的概率判断 |
| 高校信号地图 | `/campus-map` | 候选，展示高校节点和公开趋势，不展示个人画像 |
| 赞助影响护照 | `/impact/[campaignId]` | 候选，只读分享页 |

## 10. 成功验收标准

1. 新环境执行 `npm run install` 后，`npm run check` 成功。
2. `npm run demo` 可打开 `/demo`，不配置任何 Key 或数据库。
3. `npm run smoke` 自动验证 health、demo、draft、approve、anchor 五步并以 0 退出。
4. Demo 至少展示 4 条信号，每条都有 URL、发布时间和验证状态；mock 联系方式清楚标识。
5. 草稿 API 返回固定字段，包含至少 2 条引用和全部 guardrail 检查。
6. 不批准不能进入发送状态；批准 API 明确返回 `simulated_sent` 和 `externalSideEffect:false`。
7. 同一输入两次锚定得到同一 `payloadHash`；payload 不包含 `email/body/contact/name` 字段。
8. 评委能在 3 分钟内完成主流程，任何步骤不依赖外部网络。
9. 页面在 390px 与 1440px 宽度可用，无明显横向溢出。
10. README、PRD、验收标准和任务拆分与实际命令/路由一致。

候选创新功能若被选中，需另行满足：

- 每个 forecast 必须包含可证伪条件、复查日期、至少 2 个来源和概率值，不能只保存模糊口号。
- 同一观点的 commitment hash 在提交后不可静默改变；修正必须形成新版本。
- AI 验证结果必须展示支持证据、反方证据、数据截止时间和人工审核状态。
- “未来陪审团”使用概率校准或 Brier Score 等可解释指标，不以粉丝数或投资收益排名。
- 赞助方可以验证影响数据，但不能影响编辑结论或删除不利复查结果。

## 11. 72 小时开发计划

### 0–6 小时：收敛叙事与验收

- 冻结一句话、Demo 脚本、P0/P1 和不做清单。
- 确定 4 条公开信号与 mock 标记规则。
- 跑通 harness 基线，创建 golden path。

### 6–20 小时：数据与 API

- 完成 JSON fixture、类型和状态机。
- 实现 health/demo/draft/approve/anchor Route Handlers。
- 写 Node 测试与 smoke；先让 API 闭环通过。

### 20–38 小时：Demo Console

- 实现信号墙、campaign brief、目标匹配和草稿预览。
- 实现人工批准、模拟发送、回复和凭证反馈。
- 做 loading/error/empty 状态与移动端布局。

### 38–50 小时：AI 真实增强（可降级）

- 接 Qwen 结构化输出适配器；超时、schema 失败时退回 fixture。
- 建 10–20 条黄金样本，评测事实引用、意图和个性化。
- 记录延迟和调用成本。

### 50–60 小时：Web3 与报告

- 复用/收缩合约，只锚定公共摘要哈希。
- 若测试网稳定则演示一次真实交易；默认仍保留 mock。
- 生成赞助方漏斗卡片。

### 60–68 小时：验证与故障演练

- 运行 `check` 和 `smoke`，修复所有 P0。
- 在断网、无 Key、无钱包环境彩排。
- 检查来源、PII、过度承诺和金融内容 guardrails。

### 68–72 小时：路演包装

- 录制 90 秒备份视频和 3 分钟现场脚本。
- 准备三张图：痛点、闭环、商业飞轮。
- 最终冻结代码，只接受阻断性修复。

## 12. 最大技术风险和备选方案

| 风险 | 触发信号 | 首选处理 | 备选方案 |
|---|---|---|---|
| X/Google 访问、限流或结构变化 | 采集失败率 >20% | 官方 API、缓存、按来源适配 | 使用已保存且带时间戳的 fixture 完成 Demo |
| LLM 编造活动或承诺 | 引用覆盖不足、schema 不合法 | 只允许从 source IDs 取事实；结构化输出 + 校验 + 人审 | 规则模板生成，模型只润色非事实部分 |
| 发送损害品牌或触发垃圾邮件 | 退信、投诉、重复发送 | 草稿箱模式、人审、速率限制、幂等和退订列表 | Demo 永远只模拟；试点每天不超过小批量 |
| 测试网/RPC 不稳定 | 交易 30 秒未确认 | 队列、重试、区块浏览器核验 | 本地确定性哈希 + 预录真实交易，不阻塞主流程 |
| PII 泄露 | payload/日志出现邮箱或正文 | 数据分层、字段 allowlist、日志脱敏、链上 schema 校验 | 关闭真实发送与上链，只输出本地公共摘要 |
| 多技术栈拖慢交付 | 前后端环境无法在 15 分钟搭建 | 默认 Next.js 单体 + JSON，无数据库 | Django/合约作为可选服务，不进黄金路径 |
| 中文 prompt injection/恶意网页 | 页面文本要求 Agent 泄密或调用工具 | 外部内容作为不可信 data，工具参数 schema、域名白名单 | 仅采集元数据和人工批准来源 |
| “世界杯”叙事偏离主业 | 评委认为在蹭热点 | 强调可复用 campaign 模板与财经素养 | 一键切换为 HTX Genesis/WAIC 高校招募场景 |
| 趋势判断被误解为投资建议或博彩 | 页面出现币价、收益承诺或下注引导 | 只做公共趋势与媒体事实核验；设置可证伪指标和免责声明 | 使用技术采用/政策/用户行为类判断，禁用价格竞猜 |
| AI 对模糊观点强行判定“对错” | 缺少截止时间、指标或反方证据 | 无法验证时标记 `inconclusive`；公开编辑审核状态 | 只展示原始观点和证据变化，不给准确率 |
| 赞助关系损害媒体独立性 | 赞助方要求修改验证结论 | 资金、运营指标与编辑判断数据分层；保留版本审计 | 关闭公开排名，仅输出中性 impact passport |

## 13. 候选产品路线与决策标准

### 13.1 推荐路线

建议保留 Campaign OS 作为后台效率底座，把 **TreeRing 90** 作为最优先评估的公共媒体产品，再把 **Campus Signal Nodes** 作为试点后的数据网络。这样形成：后台可用、前台可传播、网络可积累的三层结构。

### 13.2 候选方案比较

| 方案 | 大树匹配 | 媒体记忆点 | AI/Web3 必要性 | MVP 成本 | 当前建议 |
|---|---:|---:|---:|---:|---|
| Campaign OS | 高 | 中 | 中 | 已完成 | 保留为后台 |
| TreeRing 90 | 高 | 很高 | 很高 | 中 | 第一候选 |
| 未来陪审团 | 高 | 很高 | 高 | 中 | TreeRing 的展示玩法 |
| Campus Signal Nodes | 很高 | 高 | 中 | 高 | 试点后建设 |
| 一场活动五次传播 | 很高 | 高 | 中 | 中 | 优先验证内容价值 |
| 城市命题生成器 | 高 | 高 | 中 | 低 | 可作为下一站快速增强 |
| Sponsor Impact Passport | 很高 | 中 | 高 | 中 | 有赞助方后实施 |

### 13.3 进入开发前的决策门

任何候选功能只有满足以下条件才可进入已承诺范围：

1. 能在 20 秒内向评委解释清楚，且不是通用邮件/聊天 Agent。
2. 有大树活动、编辑或商务成员确认实际使用场景。
3. 有不依赖外网和真实链的降级 Demo。
4. 新功能至少增加一个自动测试和一个 smoke 断言。
5. 不破坏当前 `install/dev/test/check/demo/smoke` 黄金路径。
6. 不新增个人隐私上链、投资建议、博彩或自动公开发布风险。
