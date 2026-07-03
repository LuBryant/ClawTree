# ClawTree Gate 决策记录：GATE-1 / GATE-5 / GATE-6

日期：2026-07-03  
决策状态：冻结用于黑客松 MVP；后续变更必须同步更新 `docs/tasks.md` 与 `frontend/data/golden-gate.json`。  
决策来源：项目负责人在 Codex 工作线程中要求继续完成 GATE-1、GATE-5、GATE-6；本文件作为本轮实现前的产品冻结记录。

---

## GATE-1：主舞台重点冻结

### 决策

黑客松主舞台只保留两个重点：

1. **Content Relay / 内容接力站**
   - 把大树财经公开内容、高校行回顾、AI/Web3 话题与活动线索转成国内可访问、来源可追溯、经人审的公开内容。
   - Demo 中以老师视角开场：不用访问 X，也能看到来源、发布时间、编辑状态和合作入口。

2. **Campus Opportunity-to-Proposal / 高校机会到合作提案闭环**
   - 把高校公开活动信号、公开合作联系证据和大树能力库结合，生成有引用的三档合作提案与一校一稿外联草稿。
   - Demo 中以运营视角收束：AI 只能匹配和草拟，审批前不会发布、发送或上链。

### 如何处理四个候选方向

| 候选方向 | 本轮定位 | 说明 |
|---|---|---|
| Content Relay | 主舞台 1 | 老师侧价值最直观：国内可访问、可信回顾、来源透明。 |
| Opportunity Radar | 并入主舞台 2 | 作为“高校机会到提案闭环”的输入层，不单独作为第三条主线。 |
| Proposal Agent | 主舞台 2 | 体现 AI 创新和运营效率，必须引用活动事实和能力库事实。 |
| 双端门户 | 交付界面，不单独作为主舞台 | `/user` 和 `/admin` 是两条闭环的可见承载面，不再扩张成独立卖点。 |

### 明确不进入主舞台

- TreeRing / 未来陪审团 / Campus Signal Nodes：保留为赛后路线，不进入 P0 Demo。
- 真实邮件发送：本轮最多模拟发送或草稿箱；不做真实批量外发。
- 真实链上写入：本轮默认 mock proof；只证明公共摘要 hash 与隐私 allowlist。
- 世界杯主题：只作为可切换的传播素材，不压过“高校内容可信化 + 合作提案”主线。

### 20 秒冠军版一句话

> ClawTree 把大树财经和高校公开信号，变成老师能直接看的可信内容、运营能审批的逐校合作提案，并用无隐私的 proof 证明 campaign 过程真实发生。

### 成功标准

- 3 分钟内同时讲清楚老师价值和运营价值。
- 任何 AI 输出都能回到 source ID 或能力库条目。
- 公开端不出现邮箱、风险原文、未发布内容、模型 prompt 或回复原文。
- 审批前不会产生发布、发送或链上写入副作用。

---

## GATE-5：黄金集冻结

### 决策

冻结一个离线黄金集，用于后续分类、去重、合规、活动可信度、提案引用和外联状态机测试。

机器可读文件：

- `frontend/data/golden-gate.json`

黄金集包含：

- 10 条大树内容样本：覆盖高校行、AI 数据、黑客松、世界杯热点、RWA、战略合作与重复/风险边界。
- 10 个高校活动样本：覆盖官方、平台转载、日期冲突、过期、缺联系证据、机器人/AI/Web3 等场景。
- 3 所学校提案目标：沿用当前离线 Demo 的广州三校目标，保证和 `frontend/data/demo.json` 一致。

### 内容黄金集期望

| ID | 主题 | 期望分类 | 期望动作 |
|---|---|---|---|
| tf-campus-launch | 全球高校行启动 | campus + web3 | 可进入 Content Relay，需编辑摘要 |
| tf-nuist-recap | 南信大高校行复盘 | campus + recap | 可作为可信回顾样本 |
| tf-guangzhou-campus | 广州高校行第五站 | campus + ai + web3 | Demo 开场主信号 |
| tf-ai-data-ama | AI 数据资产 AMA | ai + data-rights | 可转为公开课/工作坊素材 |
| tf-htx-waic | HTX Genesis / WAIC | ai + web3 + hackathon | 可进入合作提案素材 |
| tf-worldcup-market | 世界杯事件驱动讨论 | sports + finance-literacy | 只能教育化表达，禁止博彩/荐股 |
| tf-worldcup-alt | 世界杯热点备用样本 | sports + duplicate-candidate | 与 tf-worldcup-market 做相似去重评估 |
| tf-rwa-entertainment | 文娱资产 RWA | rwa + media | 允许摘要，不承诺投资收益 |
| tf-aurellix-partner | Aurellix 战略合作 | partner + media-network | 可进入能力库，需避免过度背书 |
| tf-profile-positioning | 大树公开定位 | capability-source | 仅作为能力库背景，不作为活动回顾发布 |

### 高校活动黄金集期望

| ID | 场景 | 期望结果 |
|---|---|---|
| event-fudan-robotics | 高校机器人活动，联系证据完整 | 进入 proposal golden path |
| event-gdufe-ai-finance | 广州财经/数智主题活动 | 高匹配，适合内容合作 |
| event-sysu-ai-club | AI 学生社团活动 | 中高匹配，需人工核验社团来源 |
| event-scut-web3-lab | Web3/区块链技术活动 | 中高匹配，适合技术工作坊 |
| event-official-no-email | 官方活动但无公开邮箱 | 可展示，不生成外联草稿 |
| event-platform-duplicate | 活动平台转载重复 | 合并到官方主稿 |
| event-date-conflict | 日期冲突 | fail-closed，进入人工核验 |
| event-expired | 已过期活动 | 不进入公开 `/user/events` |
| event-private-email | 只有疑似个人邮箱 | 拒绝联系方式，不外联 |
| event-prompt-injection | 页面含恶意指令文本 | 外部文本只作为 data，不改变工具权限 |

### 三校提案目标

| ID | 学校/组织 | 期望提案方向 |
|---|---|---|
| target-gdufe | 广东财经大学数智学院（演示目标） | 财经素养 + AI 数据权益 + 媒体支持 |
| target-sysu | 中山大学 AI 学生社团（演示目标） | AI 工作坊 + 学生挑战 + 活动复盘 |
| target-scut | 华南理工大学区块链协会（演示目标） | AI×Web3 技术圆桌 + 黑客松联动 |

### 黄金集使用规则

- fixture 中标记为 `fixtureOnly: true` 的样本只能用于离线测试，不得当成真实公开事实展示。
- 任何公开展示必须使用 `publicDisplayAllowed: true` 且具备来源 URL、发布时间和抓取/核验时间。
- 活动联系点必须有 `contactEvidenceUrl`；否则只能生成“待确认问题”，不得生成邮件草稿。
- 提案结论必须引用 `sourceIds` 或 `capabilityIds`；引用不足时输出 `needs_confirmation`。

---

## GATE-6：Demo 主叙事冻结

### 决策

主 Demo 选择 **“内容接力站开场，合作提案收束”**。

不选择“合作提案开场”的原因：如果一上来就是外联，容易被评委误解为 AI 群发器；先从老师侧的可信内容入口开场，可以先建立公益性、可信度和现实价值，再切到运营端展示增长效率。

### 3 分钟 Demo 脚本

| 时间 | 画面 | 讲述重点 |
|---:|---|---|
| 0:00–0:25 | `/user` 或公开内容入口 | “老师不用访问 X，也能看到大树高校行回顾和广州 AI 活动；每条都有来源、发布时间和编辑状态。” |
| 0:25–0:55 | 公开回顾/活动卡片 | “AI 只做分类、去重、摘要和风险提示；发布必须经过人审。” |
| 0:55–1:25 | `/admin` 采集/审核视角 | “运营看到同一批内容的来源、去重、风险、diff 和审核记录。” |
| 1:25–2:10 | 高校机会与 match/proposal | “系统发现一个高校机器人/AI 活动，把活动事实和大树能力库匹配，生成轻/中/深三档合作提案。” |
| 2:10–2:40 | 外联草稿和审批 | “一校一稿，引用齐全；未批准不会发送，批量只代表批量生成和进入审批队列。” |
| 2:40–3:00 | proof / evidence page | “最后只把公共摘要 hash 化，邮箱、正文、回复和 prompt 永不上链。” |

### 20 秒复述版

> 老师看到的是可信内容入口，运营看到的是可审批的合作增长后台。ClawTree 用 AI 把公开信号变成回顾、活动机会和逐校提案，但每一步都有来源、人审和隐私边界。

### 1 分钟版

> ClawTree 服务两个角色：高校老师不用翻 X，就能看到大树财经经审核的高校行回顾、AI/Web3 活动和合作入口；大树运营则在后台看到采集、去重、风险、审核、活动匹配和三档合作提案。AI 负责提取、匹配和草拟，不负责擅自发布或群发。最后系统可以生成不含邮箱、正文、回复和 prompt 的公共 campaign 摘要 hash，让赞助方和团队都能验证过程可信。

### 5 秒理解测试问题

给非团队听众看完首页后，只问三个问题：

1. 这个产品帮老师解决什么？期望答案：不用访问 X，也能看可信活动/回顾/合作信息。
2. 这个产品帮大树运营解决什么？期望答案：找高校机会、生成有证据的合作提案、审批外联。
3. AI 能不能自动发布或群发？期望答案：不能，必须人审。

### 备选开场

如果现场 `/user` 尚未实现或网络不稳定，退回当前 `/demo`：

1. 以信号墙替代公开内容入口。
2. 强调 `externalSideEffect:false` 和 mock/live 标识。
3. 仍按“可信内容 → 提案 → 审批 → proof”顺序讲，不改主叙事。

---

## 后续实现顺序

1. DATA-1~5、AI-1~3：先让黄金集 schema 和 deterministic fallback 稳定。
2. CR-1~13、USER-2~4、ADMIN-2~3：实现内容接力站闭环。
3. OR-1~9、CP-1~10、ADMIN-4：实现高校机会到提案闭环。
4. QA-7~12、DEMO-1~8：把本文件中的脚本和黄金集变成自动验证与路演证据。
