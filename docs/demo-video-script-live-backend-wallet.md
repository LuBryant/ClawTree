# ClawTree 现场稳定版 Demo 脚本：Django 后端 + 真实钱包能力

本脚本是 [demo-video-script.md](./demo-video-script.md) 的增强版，不覆盖原有离线黄金路径脚本。  
适用场景：现场网络、电脑、浏览器、测试网都比较稳定，希望展示更“真”的后端数据、审批队列、AI 邮件草稿、Django Admin、TronLink 钱包或 TRON Nile proof 能力。

核心原则：

> 现场演示可以真实连接后端和钱包，但不要把“真实外部副作用”变成不可控风险。真实邮件只发给你自己控制的测试邮箱；真实链上交易只在已经彩排成功的合约和 recorder 钱包上展示。

## 1. 展示版本选择

建议现场按三档准备，越往下越真实，也越需要提前彩排。

| 档位 | 展示内容 | 现场推荐度 | 风险 |
|---|---|---:|---|
| A. 真实 Django 后端 | SQLite 数据库、API、活动浏览器、AI 生成草稿、审批队列、Django Admin | 最高 | 低 |
| B. 真实钱包连接 | TronLink/OKX 钱包连接、Nile 地址、TRX 测试币余额 | 高 | 中 |
| C. 真实链上交易 | 调 OutreachRecord 合约、生成 Nile tx、保存 proof 到 Django | 仅彩排成功后展示 | 高 |

最佳现场策略：

1. 主流程用 A 档：真实 Django 后端。
2. 钱包只展示 B 档：连接 TronLink、显示 Nile 地址和余额。
3. C 档只在你已经确认该钱包有 recorder 权限、测试网稳定、交易彩排成功时展示。
4. 如果任何一步卡住，立刻回到 `/demo` 离线黄金路径，不要现场 debug。

## 2. 录制/路演前准备

### 2.1 本地依赖

在项目根目录安装前端依赖：

```bash
cd /Users/brywing/Desktop/ClawTree
npm run install
```

准备 Python 虚拟环境：

```bash
cd /Users/brywing/Desktop/ClawTree/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

如果安装 `mysqlclient` 在本机失败，而你只是现场演示 SQLite，可以先确认本机编译环境；不要临场折腾 MySQL。默认 `.env.example` 已经把 `DATABASE_ENGINE=sqlite` 作为安全本地路线。

### 2.2 环境变量

复制根目录环境变量模板：

```bash
cd /Users/brywing/Desktop/ClawTree
cp .env.example .env
```

最小可用配置：

```env
DJANGO_DEBUG=true
DATABASE_ENGINE=sqlite
DEEPSEEK_API_KEY=你的_deepseek_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

说明：

- `DEEPSEEK_API_KEY` 用于后端真实生成合作邮件草稿。
- 不配置 SMTP 时，Django 会使用 console email backend：批准邮件时不会真的发给外部邮箱，而是打印在后端终端里。这是最适合现场展示的安全模式。
- 如果一定要展示真实 SMTP 发送，只能发给你自己控制的测试邮箱，并且要先在 Django Admin 里把对应 `OutreachDraft.recipient_email` 改成你的测试邮箱。

不要在视频或投屏中打开真实 `.env`。

### 2.3 数据库初始化

终端 A：

```bash
cd /Users/brywing/Desktop/ClawTree/backend
source .venv/bin/activate
python manage.py migrate
python manage.py seed_events
```

可选：创建 Django Admin 账号。

```bash
python manage.py createsuperuser
```

### 2.4 合约和钱包准备，可选

先跑合约测试：

```bash
cd /Users/brywing/Desktop/ClawTree
npm run install:contracts
npm run test:contracts
```

如果只展示钱包连接，不需要部署合约。

如果要展示真实交易，需要提前确认：

1. 浏览器安装 TronLink 或 OKX Wallet。
2. 钱包切到 TRON Nile 测试网。
3. 钱包有 Nile 测试 TRX。
4. `frontend/app/config/tron.ts` 里的 `CONTRACTS.OutreachRecord` 是已部署的 Nile 合约地址。
5. 当前连接的钱包是该合约的 authorized recorder。最简单方式：用部署该合约的钱包演示，因为合约 constructor 会把部署者设为 recorder。

如果你没有 recorder 权限，前端会尝试交易失败并回退 mock。现场可以展示“钱包已连接 + proof 可降级”，不要硬说是真实交易。

## 3. 现场启动命令

需要两个长期运行的终端。

### 终端 A：启动 Django 后端

```bash
cd /Users/brywing/Desktop/ClawTree/backend
source .venv/bin/activate
python manage.py runserver 127.0.0.1:8000
```

保持这个终端开着。后端日志、console email、API 请求都会在这里出现。

### 终端 B：启动前端并连接后端

```bash
cd /Users/brywing/Desktop/ClawTree
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api npm run demo
```

保持这个终端开着。浏览器打开：

```text
http://127.0.0.1:3000
```

### 终端 C：可选，自检

录屏前跑：

```bash
cd /Users/brywing/Desktop/ClawTree
npm run docs:check
npm run test
npm run smoke
```

如果时间充足：

```bash
npm run check
```

## 4. 浏览器标签页准备

提前打开这些页面：

- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/admin`
- `http://127.0.0.1:3000/admin/events`
- `http://127.0.0.1:3000/admin/outreach`
- `http://127.0.0.1:3000/admin/proposals`
- `http://127.0.0.1:3000/user/events`
- `http://127.0.0.1:8000/admin/`，可选
- `https://nile.tronscan.org`，只在真实链上交易成功后打开

## 5. 现场演示脚本：真实 Django 后端版，约 6 分钟

### 5.1 开场：这次不是纯离线 Demo（0:00–0:35）

网页上展示：

打开 `/` 首页，停在 hero 和黄金路径。

口播：

大家好，我们是 ClawTree。今天我展示的是现场增强版，不只是离线 fixture。前端正在连接本地 Django 后端，活动数据、邮件草稿、审批队列和 proof 记录都会走真实 API。

但我们仍然保留安全边界：AI 不会直接发送邮件，真实发送必须人工审批；链上 proof 只写公共摘要，不写联系人和邮件正文。

### 5.2 后端健康检查：证明 API 已连接（0:35–1:05）

网页上展示：

切到 `/admin`。

镜头停在：

- 活动总量
- AI 活动
- Web3 活动
- 待外联
- 系统状态里的“后端 API 正常”
- $HTX 卡片，如果行情加载成功就顺手展示

口播：

这里可以看到 Dashboard 已经从 Django API 读取数据。活动总量、AI/Web3 分类、待外联状态都不是写死在页面里的，而是来自后端数据库。

$HTX 行情是 HTX 生态入口。如果现场行情 API 波动，不影响主流程，因为 ClawTree 的核心是 campaign workflow，不依赖行情接口才能演示。

### 5.3 活动浏览器：真实后端数据和筛选（1:05–1:55）

网页上展示：

切到 `/admin/events`。

操作：

1. 展示活动卡片、分类、评分、联系方式。
2. 用分类筛选选择 `AI+Web3` 或 `Web3`。
3. 搜索一个学校或关键词。
4. 展示页面提示：本页不会打开邮箱、不会发送、不会写外部系统。

口播：

现在进入活动浏览器。这里的数据来自 Django 的 `UniversityEvent` 模型。运营团队可以按 AI、Web3、活动类型和评分筛选高校活动。

注意这里是管理端，所以能看到联系信息；公开用户端不会返回这些字段。ClawTree 的产品逻辑是：公开端承接信息，管理端处理合作，字段权限必须分层。

这一页的批量能力也有边界：批量只代表批量生成草稿进入审批队列，不代表 BCC 群发，更不会直接打开邮箱或触达外部系统。

### 5.4 AI 生成合作邮件：从后端创建审批草稿（1:55–2:55）

网页上展示：

在 `/admin/events` 选择一个活动，点击“AI 生成邮件文案”或批量生成。

如果 `DEEPSEEK_API_KEY` 已配置：

- 展示生成出的邮件草稿。
- 展示“草稿 · 待审批”。
- 点击“前往外联审批台”。

如果模型 API 慢：

- 停留不超过 15 秒。
- 口播说明“这里调用后端 LLM 网关生成；如果现场模型延迟，会直接使用预置离线 Demo 继续主流程。”
- 切回 `/demo` 或进入已有草稿。

口播：

现在让后端 AI 生成一封合作邀请草稿。这里的请求不是前端直接带 Key 调模型，而是通过 Django 后端读取工作区品牌档案、活动信息和能力库，再生成邮件。

生成后它只进入审批队列。AI 的角色是 copilot，不是 operator。它能写草稿，但不能替团队发送，也不能替品牌做承诺。

### 5.5 外联审批台：人工批准是真正的安全闸门（2:55–3:55）

网页上展示：

切到 `/admin/outreach`。

操作：

1. 展示待审批草稿。
2. 展示邮件正文可编辑。
3. 展示批准、驳回按钮。
4. 如果使用 console email backend，可以点击批准，然后迅速切到终端 A 展示邮件打印在后端日志中。
5. 如果配置了真实 SMTP，不要发给真实高校邮箱；只对你自己控制的测试邮箱演示。

口播：

这里是 ClawTree 最重要的安全边界：AI 草稿必须逐校逐封人工审批。运营人员可以编辑正文、批准或驳回。

今天本地默认使用 Django console email backend，所以点击批准不会真的发给外部邮箱，而是把邮件打印在后端终端。这样我们能证明后端发送路径存在，同时避免现场误触达真实高校联系人。

如果上线到生产，SMTP 或 OAuth 邮箱 provider 可以接入，但必须继续保留限速、幂等、退订、抑制名单和人工审批。

### 5.6 Django Admin：证明数据真的落库（3:55–4:30）

网页上展示：

切到 `http://127.0.0.1:8000/admin/`。

操作：

1. 登录 Django Admin。
2. 打开 `University events`，展示 seed 数据。
3. 打开 `Outreach drafts`，展示刚刚生成/审批的草稿状态。
4. 不展示真实 secret，不展示真实私钥。

口播：

这里是 Django Admin，可以看到活动、外联草稿和审批状态都已经落到数据库。也就是说，ClawTree 不是一个前端动画，而是有后端模型、API、审核状态和运营数据的真实原型。

对评委来说，这意味着项目可以从黑客松 Demo 继续演进到真实运营。

### 5.7 公开用户端：后端数据的安全出口（4:30–5:10）

网页上展示：

切到 `/user/events`。

镜头停在：

- 活动列表
- 来源链接
- 分类筛选
- “联系信息仅管理端可见”

口播：

再看公开用户端。同样是活动数据，但公开端不会返回联系人、内部评分、prompt、邮件正文或风险原文。高校老师和学生看到的是可公开的信息：活动、时间、主题、来源和报名入口。

这就是 ClawTree 的数据治理：同一份后端数据，按照用户角色给不同字段。媒体和高校合作不是越透明越好，而是要把可信信息公开，把敏感协作留在受控后台。

### 5.8 收尾：真实后端价值（5:10–5:45）

网页上展示：

回到 `/admin/proposals` 或首页。

口播：

这条现场路径展示了 ClawTree 的真实后端能力：Django 数据库、活动筛选、AI 邮件生成、人工审批、发送边界和公开端字段隔离。

一句话总结：ClawTree 把分散的高校和生态信号，变成可执行、可审批、可验证的合作流程。

## 6. 现场演示脚本：真实钱包能力版，可追加 1–2 分钟

这一段建议放在真实 Django 后端演示之后。先展示钱包连接；只有彩排成功再展示真实链上交易。

### 6.1 钱包连接版：展示真实 TronLink/OKX 状态（推荐）

网页上展示：

切到 `/admin/outreach`。

操作：

1. 点击“连接 TronLink”。
2. 在钱包弹窗里确认连接。
3. 页面显示：
   - TRON Nile
   - 钱包地址缩写
   - TRX 测试币余额

口播：

这里展示的是真实钱包连接。ClawTree 可以读取 TronLink 或 OKX Wallet 注入的钱包状态，确认当前地址、Nile 网络和测试 TRX 余额。

这一步不产生链上写入，只证明 Web3 proof layer 可以接入真实钱包。现场如果测试网或钱包弹窗不稳定，我们不让它阻塞主流程。

### 6.2 真实链上交易版：只在彩排成功时展示

前提检查：

- `CONTRACTS.OutreachRecord` 已配置为真实 Nile 合约地址。
- 当前钱包是该合约 authorized recorder。
- 钱包有足够 Nile TRX。
- 你已经在录制前用同一台机器、同一钱包、同一浏览器成功完成过一次交易。

网页上展示：

在 `/admin/outreach` 找到已批准的草稿，点击“生成链上凭证”。

操作：

1. TronLink 弹出交易确认。
2. 确认交易。
3. 页面出现 tx hash、network、explorer link。
4. 点击 explorer link，打开 Nile Tronscan。

口播：

现在我们把外联审批结果锚定到 TRON Nile。链上记录不是邮件正文，也不是联系人信息，而是公共摘要的哈希和审批结果。

这解决的是生态合作中的可信执行问题：赞助方、Grant、黑客松主办方可以验证 campaign 确实执行过，但看不到隐私数据。

如果交易没有成功，现场话术：

测试网交易有波动，所以系统会降级为本地 mock proof。这个降级不会影响 campaign 主流程，因为 ClawTree 的设计是 proof layer 可插拔，不能让链上写入失败阻断运营。

## 7. 真实 SMTP 展示：谨慎使用

不建议现场向真实高校邮箱发送任何邮件。

如果一定要展示真实邮件发送，只能使用你自己控制的测试邮箱：

1. 在 `.env` 中配置 SMTP：

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USER=your-test-sender@example.com
SMTP_PASS=你的_SMTP_密码
DEFAULT_FROM_EMAIL=your-test-sender@example.com
```

2. 启动 Django 前确认这些变量已经加载。
3. 在 Django Admin 中打开对应 `OutreachDraft`。
4. 把 `recipient_email` 改成你自己的测试邮箱。
5. 再回 `/admin/outreach` 点击批准。

口播必须说：

今天这封真实邮件发到我们控制的测试邮箱。生产环境里，真实高校外联必须经过授权、限速、退订和人工审批。

## 8. 现场故障切换

| 问题 | 15 秒内处理 |
|---|---|
| 后端没连上 | 确认终端 A 是否在跑 `python manage.py runserver 127.0.0.1:8000`；不现场修，切 `/demo` |
| 前端读不到后端 | 确认前端启动命令包含 `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api`；不现场修，切 `/demo` |
| LLM 生成很慢 | 说“模型网关延迟，切离线黄金路径保证演示稳定”，进入 `/demo` |
| TronLink 不弹窗 | 展示钱包连接准备已接入，跳过真实交易 |
| 交易失败或回退 mock | 说“测试网波动，proof layer 可降级；隐私 allowlist 和 hash 设计不受影响” |
| SMTP 失败 | 展示 console backend 或 Django 草稿审批，不现场修邮箱 |

## 9. 现场最终推荐路线

最稳、最像成熟项目的路线：

1. 首页 `/`：一句话定位。
2. `/admin`：后端 API 正常、数据统计。
3. `/admin/events`：真实 Django 活动数据、筛选、AI 生成草稿。
4. `/admin/outreach`：审批队列、人工批准、console email。
5. `/admin/outreach`：连接 TronLink，展示 Nile 钱包和余额。
6. 如果彩排成功：生成真实链上 proof；否则跳过交易。
7. `/user/events`：公开端字段隔离。
8. `/admin/proposals`：证据引用、Agent run evidence、商业价值。
9. 回首页：总结“AI 提效、人审控风险、Web3 做可信执行”。

## 10. 现场最重要的 6 句话

1. 今天展示的是连接 Django 后端的 live path，不只是前端 fixture。
2. AI 生成邮件草稿，但不会直接发送；每封外联都必须人工审批。
3. 默认本地用 console email backend，证明发送路径存在，但避免误触达真实高校。
4. 公开用户端不会返回联系人、prompt、邮件正文或内部风险字段。
5. 钱包连接和链上 proof 是可插拔增强；测试网失败不会阻塞 campaign 主流程。
6. ClawTree 的价值不是“炫技上链”，而是让高校和生态 campaign 从发现到执行到复盘都可验证。

