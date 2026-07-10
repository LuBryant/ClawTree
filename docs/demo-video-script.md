# ClawTree 冠军级 Demo 视频脚本：AI Agent 自动采集 × 智能外联 × 链上存证

参考：仓库根目录 [README.md](../README.md)、[SPEECH.md](SPEECH.md)、[PPT.md](PPT.md)。
这版脚本用于正式录屏/现场路演：主线不再只是“页面展示”，而是展示 ClawTree 已经把媒体与高校增长做成一条可运行的 AI Agent 工作流。

一句话主线：

> ClawTree 用 AI Agent 自动采集 + AI 智能外联 + 人工审批 + 链上存证，把“发现 → 聚合 → 智能外联 → 审批 → 链上凭证”做成全链路增长操作系统。

推荐时长：6–7 分钟。  
推荐展示方式：现场稳定时优先展示 Django 后端 live path；`/demo` 作为 100% 稳定的端到端黄金路径兜底。  
推荐叙事重点：这不是活动黄页，不是群发工具，也不是为了上链而上链；它是面向媒体、高校、活动方和 Web3 生态的 campaign growth OS。

## 0. 录制前检查

### 0.1 启动 Django 后端

终端 A：

```bash
cd /Users/brywing/Desktop/ClawTree/backend
source .venv/bin/activate
python manage.py migrate
python manage.py seed_events
python manage.py runserver 127.0.0.1:8000
```

如果还没有虚拟环境：

```bash
cd /Users/brywing/Desktop/ClawTree/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_events
python manage.py runserver 127.0.0.1:8000
```

### 0.2 启动前端并连接后端

终端 B：

```bash
cd /Users/brywing/Desktop/ClawTree
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api npm run demo
```

### 0.3 推荐打开 8 个标签页

- `http://127.0.0.1:3000/`：首页，讲定位和黄金路径。
- `http://127.0.0.1:3000/admin`：Django API 连接状态和运营指标。
- `http://127.0.0.1:3000/admin/ingestion`：AI Agent 自动采集与流水线。
- `http://127.0.0.1:3000/admin/events`：活动浏览器与 AI 智能外联。
- `http://127.0.0.1:3000/admin/outreach`：人工审批、钱包、链上凭证入口。
- `http://127.0.0.1:3000/admin/proposals`：提案、证据引用、Agent run evidence。
- `http://127.0.0.1:3000/user/events`：公开用户端与字段隔离。
- `http://127.0.0.1:3000/demo`：端到端黄金路径兜底。

可选打开：

- `http://127.0.0.1:8000/admin/`：Django Admin，证明数据真的落库。
- `https://nile.tronscan.org`：只有真实链上交易成功后再打开。

### 0.4 安全边界

录制时不要展示真实 `.env`、真实 API Key、真实 SMTP 密码、真实钱包私钥。  
默认本地 Django 使用 console email backend：审批邮件会打印在后端终端，不会误发给真实高校。  
链上 proof 只锚定公共摘要或哈希，不展示联系人、邮件正文、回复原文和 prompt。

## 1. 开场：把增长从手工作坊升级成 Agent 操作系统（0:00–0:45）

网页上展示什么：

打开首页 `/`，停在 hero 区域。镜头扫过：

- “AI PARTNERSHIP INTELLIGENCE NETWORK”
- “Turn public signals into trusted partnerships”
- 70%+、15 min、0 PII
- 四步黄金路径：发现可信信号 → 生成增长机会 → 人审外联 → 沉淀可验证结果

建议口播：

大家好，我们是 ClawTree 团队。

ClawTree 是面向媒体、高校、活动方和 Web3 生态的 AI 合作增长操作系统。今天我展示的不是一个静态网站，而是一条 live workflow：Django 后端、AI Agent 自动采集、AI 智能外联、人工审批和链上存证会连成一条完整路径。

我们要解决的问题很现实：高校活动、Web3 热点、赛事话题、开发者活动和赞助资源每天都在发生，但它们分散在官网、X、公众号、活动平台和社群里。人工刷信息、整理表格、逐校写邮件、追踪回复，效率很低，也很难向赞助方证明 campaign 真实执行过。

ClawTree 的核心就是这条链路：发现 → 聚合 → 智能外联 → 审批 → 链上凭证。AI 负责规模化，人审负责品牌和合规，Web3 proof 负责可信执行。

评审打点：

- 技术创新：AI Agent 工作流，而不是单个聊天框。
- 产品完成度：Django 后端 + 前端控制台 + proof layer。
- 商业价值：把活动增长变成可验证、可复用、可规模化的资产。

## 2. Django 后端总览：证明这不是前端动画（0:45–1:25）

网页上展示什么：

切到 `/admin`。停留在：

- 活动总量
- AI 活动
- Web3 活动
- 待外联
- $HTX 卡片
- 系统状态里的“后端 API 正常”

建议口播：

先看运营后台。这里的活动统计、AI/Web3 分类和待外联数量来自 Django API，不是写死在页面里的数字。

Django 后端负责承载真实运营数据：高校活动、活动回顾、采集运行、外联草稿、审批状态和 proof 记录。前端只是操作台，真正的业务状态在后端。

这点对黑客松评审很重要：ClawTree 不只是漂亮的 demo 页面，而是一个可以继续接入真实采集、真实审批、真实钱包和真实 sponsor report 的产品原型。

评审打点：

- 产品完成度：后端 API 已连接，管理端能读真实数据。
- 工程可信度：状态、数据、审批不是前端假流程。
- 可运营性：活动、外联、proof 都有后端模型承接。

## 3. 发现与聚合：AI Agent 自动采集高校和媒体信号（1:25–2:20）

网页上展示什么：

切到 `/admin/ingestion`。展示四步流水线：

- `collect_events`：采集高校 AI/Web3 活动。
- `fetch_tweets`：抓取/筛选大树财经内容。
- `generate_emails`：生成合作邮件草稿。
- `auto_approve`：审批发送控制面，强调真实发送仍有人审边界。

可展示：

- 每一步的启动/停止按钮。
- 定时开关和上限配置。
- 最近运行状态、added/skipped/failed、耗时。
- 页面说明：“采集活动 → 推文筛选 → AI 邮件 → 审批发送”。

建议口播：

这里是 ClawTree 的第一个核心能力：AI Agent 自动采集与聚合。

传统团队需要人工到高校官网、社团平台、活动平台和 X 上找线索。ClawTree 把这个过程拆成可监控的流水线：先采集高校 AI/Web3 活动，再抓取和筛选大树财经相关内容，然后进入邮件草稿生成和审批流程。

这不是简单爬虫。真正重要的是运营可控：每一步都有上限、定时、运行状态、失败记录和人工边界。对真实组织来说，AI Agent 不能只会“跑一次”，它必须能被启动、停止、审计、复盘。

如果现场需要，我们可以启动某一步；但正式录屏建议只展示控制台和最近运行结果，把时间留给完整链路。

评审打点：

- AI Agent 自动采集：从外部信号进入后端工作流。
- 可运营性：定时、上限、运行状态、失败记录。
- 风险控制：自动化进入审批队列，而不是直接产生外部副作用。

## 4. 聚合后的公开出口：高校老师和学生看到什么（2:20–3:00）

网页上展示什么：

切到 `/user/events`。展示：

- 活动列表和 AI/Web3 标签。
- 搜索和筛选。
- 来源链接、报名/详情入口。
- “联系信息仅管理端可见”提示。

建议口播：

采集和聚合之后，公开用户端承接的是安全、可公开的信息。高校老师、学生和开发者可以看到活动标题、时间、地点、主题、来源和报名入口。

但公开端不会返回联系人、内部评分、prompt、邮件正文、风险原文和外联状态。ClawTree 不是把数据粗暴摊开，而是把同一份后端数据按角色分层：公开端服务发现，管理端服务合作，proof layer 服务可信复盘。

评审打点：

- 用户价值：学生和高校能发现活动，不用自己到处翻。
- 数据治理：公开 API 字段 allowlist。
- 产品闭环：自动采集不是只进后台，也能转化为公开内容资产。

## 5. 智能外联：从活动浏览器到一校一稿（3:00–4:10）

网页上展示什么：

切到 `/admin/events`。按顺序展示：

1. 活动卡片：分类、评分、联系方式、来源链接。
2. 筛选 `AI+Web3` 或 `Web3`。
3. 选择一条活动。
4. 点击“AI 生成邮件文案”。
5. 展示生成出的合作邮件草稿。
6. 点击“前往外联审批台”。

如果模型 API 慢，停留不超过 15 秒，直接进入已有草稿或切 `/demo`。

建议口播：

现在进入第二个核心能力：AI 智能外联。

活动浏览器里，运营团队可以看到后端采集的高校活动和公开联系信息。点击 AI 生成邮件，Django 后端会读取活动信息、工作区品牌档案和能力库，生成一封合作邀请草稿。

这里有两个关键点。

第一，它不是群发模板，而是一校一稿。AI 会根据活动主题、学校和合作场景生成个性化内容。

第二，它不会直接发送。生成后的邮件只进入外联审批队列。批量也只代表批量生成独立草稿，不代表 BCC 群发，不代表自动触达。

这就是 ClawTree 的产品哲学：AI 负责把增长动作规模化，人负责最后的品牌承诺。

评审打点：

- AI 应用程度：从活动数据直接生成外联草稿。
- 业务价值：把“找活动 → 写邮件”从小时级压缩到分钟级。
- 安全边界：一校一稿、进入审批队列、不自动群发。

## 6. 审批：AI 可以加速，但不能越权（4:10–5:00）

网页上展示什么：

切到 `/admin/outreach`。展示：

- 待审批草稿数量。
- 邮件正文可编辑。
- 批准并发送、还原原文、驳回。
- 如果使用 console email backend：点击批准后，切到后端终端展示邮件打印日志。
- 如果配置了真实 SMTP：只发给自己控制的测试邮箱。

建议口播：

这里是 ClawTree 的安全闸门：外联审批台。

AI 生成的每一封邮件都必须逐校逐封人工审核。运营人员可以修改正文、批准或驳回。没有人工审批，系统不会发送。

今天本地默认使用 Django console email backend，所以点击批准不会误发给真实高校，而是打印在后端终端。这证明真实 Django 发送路径已经接好，同时避免现场产生不可控外部副作用。

在生产环境里，这里可以接 SMTP 或 OAuth 邮箱 provider，但仍然必须保留限速、退订、抑制名单、幂等和人工审批。

评审打点：

- 品牌安全：AI 不直接代表组织行动。
- 后端完成度：审批后调用 Django `send_mail` 路径。
- 真实可用：本地安全模式和生产发送模式边界清楚。

## 7. 链上凭证：让 sponsor 和生态方验证执行结果（5:00–5:55）

网页上展示什么：

继续在 `/admin/outreach`。展示：

- TRON Nile 钱包状态区域。
- 如果已连接 TronLink/OKX，展示地址、Nile、TRX 余额。
- 对已批准草稿点击“生成链上凭证”。
- 展示 proof tx hash / network / explorer URL，或 mock proof fallback。
- 强调 proof 只存公共摘要，不含隐私。

可选补充切到 `/demo` 的 Human Gate + Proof 区域，展示稳定的 payloadHash。

建议口播：

最后是链上存证，也是 ClawTree 和普通 CRM/自动化工具最大的区别。

当外联经过人工审批后，系统可以生成链上凭证。这个 proof 的价值不是“为了 Web3 而 Web3”，而是给 sponsor、Grant、生态项目和主办方一个可验证的执行记录：这次 campaign 什么时候生成、什么时候审批、对应哪个活动、状态是什么。

但隐私不上链。联系人、邮箱、邮件正文、回复原文和 prompt 都不会进入链上 payload。链上只锚定公共摘要或哈希。

如果现场测试网稳定，我们可以展示 TRON Nile 交易；如果测试网波动，系统会降级为 mock proof。这个降级不影响主流程，因为 ClawTree 的 proof layer 是增强层，不能让链上波动阻塞运营。

评审打点：

- Web3 应用真实：解决可信执行、赞助验收和 impact report。
- 隐私安全：只上公共摘要哈希，不上 PII 和正文。
- 生态契合：TRON Nile、HTX/B.AI/Grant campaign 都有落点。

## 8. 端到端黄金路径：用 `/demo` 一次性串起全链路（5:55–6:45）

网页上展示什么：

切到 `/demo`。快速扫过：

1. “全球足球赛事 × 广州高校行”。
2. Story rail：可信信号 → 主题设计 → 高校匹配 → 人工审批 → 影响凭证。
3. Signal Inbox：已核验来源。
4. Target Match：候选高校和证据链接。
5. Generate outreach draft。
6. Approve and simulate send。
7. Generate onchain proof。

建议口播：

刚才我们展示的是 Django live path：采集、聚合、外联、审批、proof 都接到了真实后端。

现在用 `/demo` 把评审最关心的一条端到端故事串起来：从全球热点和高校信号出发，设计成 AI/Web3 校园 campaign，匹配目标高校，生成一校一稿，经过人工批准，最后生成 privacy-safe proof。

这条黄金路径的意义是：即使现场没有模型 Key、没有数据库、没有邮箱、没有钱包，也能稳定复现产品闭环；而在现场稳定时，它又可以升级为刚才展示的 Django live path。

评审打点：

- 展示质量：端到端故事清楚，不被外部 API 绑架。
- 产品韧性：live path 和 offline golden path 都存在。
- 核心闭环：发现 → 聚合 → 智能外联 → 审批 → 链上凭证。

## 9. HTX / B.AI / 商业化：为什么它值得投资（6:45–7:25）

网页上展示什么：

回到首页 `/` 或停在 `/admin/proposals`。展示：

- “One engine / many workspaces”
- TreeFinance reference demo case
- 三档合作提案
- Required citations / prohibited promises
- Agent run evidence

建议口播：

为什么这个项目适合 HTX Genesis，也为什么它有投资价值？

HTX、B.AI、Grant、黑客松、协议方和高校创新中心，都需要做同一件事：找到开发者、学生、社群和媒体合作伙伴，把活动从一次性传播变成可复盘的增长资产。

ClawTree 可以成为这类生态增长的操作系统。AI Agent 帮你发现和聚合机会，AI 智能外联帮你规模化触达，人审确保品牌和合规，链上 proof 让 sponsor 和生态方验证结果。

商业化路径很清楚：先用大树财经高校行作为参考案例验证闭环，再服务黑客松和 Web3 生态 campaign，最后扩展成面向媒体、协议方、高校创新中心和赞助方的 SaaS 工作区。

评审打点：

- 商业潜力：从内部效率工具升级为 campaign SaaS。
- 生态契合：HTX / B.AI / TRON / Grant / DAO 协作都有入口。
- 投资叙事：沉淀的是可复用增长资产，不是一次活动数据。

## 10. 收尾：一句话总结（7:25–7:40）

网页上展示什么：

回到首页 hero，停在“Turn public signals into trusted partnerships”。

建议口播：

一句话总结：ClawTree 把分散的高校、媒体和 Web3 生态信号，变成真实合作。

我们用 AI Agent 自动采集解决发现问题，用 AI 智能外联解决规模化问题，用人工审批解决品牌和合规风险，用链上存证解决可信执行和复盘问题。谢谢各位评委。

## 5 分钟压缩版路线

如果视频必须压到 5 分钟：

1. 首页定位：25 秒。
2. `/admin` 后端 API 正常：25 秒。
3. `/admin/ingestion` 自动采集流水线：45 秒。
4. `/admin/events` AI 生成邮件草稿：1 分钟。
5. `/admin/outreach` 人审 + proof：1 分 20 秒。
6. `/demo` 端到端黄金路径扫一遍：1 分钟。
7. 商业化和收尾：25 秒。

最不能压缩的是这条链：

> 发现 → 聚合 → 智能外联 → 审批 → 链上凭证

这是 ClawTree 和普通活动平台、CRM、群发工具最大的区别。

## 视频里一定要说出的 10 句话

1. ClawTree 不是活动黄页，也不是自动群发器，而是 AI 合作增长操作系统。
2. 我们实现的是“发现 → 聚合 → 智能外联 → 审批 → 链上凭证”的全链路。
3. Django 后端承载真实活动、采集运行、外联草稿、审批状态和 proof 记录。
4. AI Agent 自动采集高校 AI/Web3 活动和媒体内容，并进入可审计流水线。
5. AI 智能外联是一校一稿，不是 BCC 群发。
6. AI 可以生成草稿，但不能越权发送；每封外联都必须人工审批。
7. 本地默认 console email backend 可以证明发送路径存在，同时避免误发真实联系人。
8. Web3 proof 只锚定公共摘要或哈希，不上联系人、邮件正文、回复内容和 prompt。
9. 对 HTX / B.AI / Grant / 黑客松生态，ClawTree 把活动增长变成可验证、可复盘、可规模化的 campaign。
10. `/demo` 是稳定黄金路径，Django live path 是真实运营增强，两者共同证明项目既能演示，也能落地。

## 风险问题话术

如果评委问“这是不是只是前端演示？”：

不是。管理端连接 Django API，后端有活动、采集运行、外联草稿、审批和 proof 字段。`/demo` 是稳定黄金路径，Django live path 是真实运营原型。

如果评委问“自动采集是不是会乱抓数据？”：

ClawTree 把采集设计成可控流水线：有来源、上限、定时、状态、失败记录和人工审核。公开端只展示可公开字段，管理端才处理联系方式和外联。

如果评委问“AI 会不会乱发邮件？”：

不会。AI 只生成草稿，必须进入 `/admin/outreach` 人工审批。批量只代表批量生成独立草稿，不代表 BCC 群发。

如果评委问“有没有真实发邮件？”：

本地默认使用 Django console email backend，审批后邮件打印在后端终端，避免误发真实高校。配置 SMTP 后可以真实发送，但生产必须保留人工审批、限速、退订、抑制名单和幂等。

如果评委问“有没有真实上链？”：

系统支持 TRON Nile 钱包和 OutreachRecord proof 路径；现场稳定时可以展示真实交易。默认也保留 mock proof fallback，因为测试网不应该阻塞核心运营流程。无论 mock 还是真实交易，隐私字段都不上链。

如果评委问“HTX 生态是不是只放了行情？”：

行情只是入口。真正的生态契合是把 HTX、B.AI、Grant、开发者活动和高校合作做成 campaign OS：生态项目可以发现高校机会、生成提案、审批外联、沉淀 sponsor impact report，并用 proof 记录公共执行结果。

如果评委问“为什么投资人应该关注？”：

因为媒体、高校、协议方、交易平台、黑客松主办方和赞助商都有同一个痛点：如何把分散信号变成可信合作，并把结果证明给合作方看。ClawTree 沉淀的是增长操作系统，不是一次活动页面。

## 录屏导演提示

- 先展示 Django live path，再用 `/demo` 串故事；真实和稳定两手都要有。
- 每个关键页面停 1–2 秒，让评委看清状态、按钮和 proof。
- 鼠标只做关键动作：启动/展示流水线、生成草稿、进入审批、生成 proof。
- 看到 “console email backend”、“联系信息仅管理端可见”、“payloadHash/proof” 时要停顿，这是评委记住安全边界的证据。
- 如果任何外部服务卡住，立刻切 `/demo`，不要现场 debug。
