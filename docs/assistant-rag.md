# TreeFinance AI 客服 / RAG

版本：2026-07-05

## 目标

AI 客服使用 RAG 与模型协作：审核知识库负责事实，模型负责理解中英文意图、处理多轮指代并按当前问题的语言组织答案，不负责创造事实；中文问题只返回中文，英文问题只返回英文。无模型 Key 或上游失败时使用同一知识库的对应语言确定性回答。

## 回答链路

```text
用户问题 + 最近对话 + 老师/学生角色 + 当前问题语言检测
  → 输入长度与角色校验
  → 安全策略（注入、敏感信息、承诺、外部动作）
  → 审核知识检索（owner / 来源 / 核验日期 / 有效期）
  → 公开报名/官网/截止时间类问题：优先智谱 Web Search，不限制内容来源
  → 对智谱结果使用 Reader 读取公开正文，并由 glm-4.7 基于证据生成回答
  → 仅当智谱明确返回额度/余额耗尽业务码时，切换千问 Web Search + Web Extractor
  → 低风险未命中：AI 通用回答或澄清，不强制转人工
  → 过期、冲突、具体合作权益或需要平台确认：拒答或转人工
  → 有 Key：模型仅基于 RAG + Web Search 检索上下文组织答案
  → 无 Key/上游失败：本地 FAQ 或 Web Search 兜底答案
  → 回答 + 引用 + 信息日期 + 模式 + 转人工原因
```

## API 契约

请求只接受 `user` / `assistant` 消息、`teacher` / `student` 角色以及 `zh` / `en` 界面语言。服务端根据最新问题检测回答语言；界面语言只在问题不含可识别文字时兜底。服务端最多向模型提供最近 6 条已校验对话用于意图理解，但平台事实只能来自本次检索到的审核知识。响应字段：

- `answer`：审核上下文支持的答案。
- `mode`：`rag_model`、`ai_model`、`web_search_model`、`web_search_fallback`、`faq_fallback` 或 `policy_refusal`。
- `decision`：`answer`、`refuse` 或 `handoff`。
- `citations`：知识 ID、标题、来源标签、站内链接和核验日期。
- `knowledgeAsOf`：知识包审核日期。
- `handoff`：是否转人工、原因和 `/user/cooperate` 入口。
- `externalSideEffect`：固定为 `false`。

## 安全边界

- 不承诺奖金、算力、投资、嘉宾、曝光、主办身份、回复时间、收益或活动结果。
- 不执行自动发布、自动外联、协议签署或人工确认。
- 不泄露 system prompt、密钥、密码、身份证号或财务信息。
- 足球赛事问题不提供博彩、比分预测、荐股或收益保证。
- 已审核的官方外部来源可作为 RAG 知识引用，例如 HTX Genesis Hackathon 官方 GitBook。动态联网优先使用智谱 Web Search + Reader，智谱搜索不设置 `search_domain_filter`，因此不限制内容来源；仍会在服务端执行 HTTPS、相关性、去重和风险内容校验。
- 智谱搜索成功后使用 `glm-4.7` 基于审核知识、搜索结果和 Reader 正文生成回答。搜索/Reader 工具 API 本身没有模型参数，`glm-4.7` 用于最终证据化回答。
- 只有智谱搜索、Reader 或 `glm-4.7` 回答接口返回官方额度类业务码 `1113`、`1308`、`1310`、`1316–1321` 才会触发千问回退。鉴权失败、普通限流 `1302/1305`、参数错误、超时、5xx 或空结果均不会切换供应商；非额度类 Reader 失败只保留智谱搜索摘要。
- 搜索摘要与网页正文都按外部不可信数据处理，不能改变系统规则、工具权限或审批要求。报名资格、截止时间、奖项、算力、投资、主办身份、提交状态和个人信息处理仍以最终官方页面或人工确认为准。
- 留资前必须明确用途并获得用户勾选同意；当前 Demo 不发送数据。

## 评测

`frontend/data/assistant-evals.json` 包含 47 个中英文老师/学生问答与对抗样本，覆盖 RAG 回答、AI 通用回答、HTX Genesis Hackathon 官方活动问答、公开报名 Web Search、合作流程详答、口语化平台用途、新手使用指南、时效信息、承诺拒答、提示注入、敏感信息和赛事安全边界。

离线 smoke 强制 `ASSISTANT_FORCE_FALLBACK=1`，验证无 Key 时仍返回引用与信息日期，且不显示虚假的模型在线状态。

本地启用模型：

```bash
cp frontend/.env.example frontend/.env.local
# 在 frontend/.env.local 中填写 ZHIPU_API_KEY，联网答案固定使用 glm-4.7
# 可同时填写 DASHSCOPE_API_KEY，作为智谱额度耗尽时的回退
# 未配置智谱 Key 时直接尝试千问；两个 Key 都未配置时退回审核知识库/FAQ
npm run dev
```

智谱主链路：

1. `POST /api/paas/v4/web_search`，使用 `search_pro`、`content_size: high`，不设置域名过滤。
2. 最多选择两个经过 HTTPS、相关性与去重校验的 URL 调用 `POST /api/paas/v4/reader`。
3. `glm-4.7` 仅根据 RAG 与联网证据生成最终回答；Reader 失败时仍可使用搜索摘要。

智谱搜索调用只有在明确额度耗尽时才进入以下千问链路；其他错误 fail closed，避免掩盖配置、鉴权和安全问题。

千问联网请求采用两阶段设计：

1. 原生 DashScope Generation API 使用 `enable_search: true` + `search_strategy: turbo` + `forced_search: true` + `assigned_site_list` + `enable_source: true`；引用只解析 API 返回的 `output.search_info.search_results`，不信任模型自行生成的 URL。
2. 仅将第一阶段返回且通过 URL/站点白名单校验的地址传给 Responses API `web_extractor`；不会为抓取阶段开放新的 Web Search 工具。

该拆分用于同时满足“限定来源站点”和“读取网页正文”。根据千问文档，`assigned_site_list` 仅对 `turbo` 生效，而 Web Extractor 是独立工具能力。

注意：千问的 `assigned_site_list` 表示“只检索这些域名上的页面”，不是选择底层搜索引擎。因此当前配置会严格返回 Bing、Google 等搜索平台自身域名的页面；如果未来目标改为“通过 Bing/Google 搜索任意官方站点”，需要接入对应搜索引擎 API，不能把 `assigned_site_list` 当作搜索引擎选择器。
