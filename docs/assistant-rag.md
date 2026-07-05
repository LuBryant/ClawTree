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
  → 公开报名/官网/截止时间类问题：安全 Web Search（优先官方页面，结果作为外部证据）
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
- 已审核的官方外部来源可作为 RAG 知识引用，例如 HTX Genesis Hackathon 官方 GitBook；公开网页搜索结果只作为外部线索。报名资格、截止时间、奖项、算力、投资、主办身份、提交状态和个人信息处理仍以官方页面或人工确认为准。
- 留资前必须明确用途并获得用户勾选同意；当前 Demo 不发送数据。

## 评测

`frontend/data/assistant-evals.json` 包含 47 个中英文老师/学生问答与对抗样本，覆盖 RAG 回答、AI 通用回答、HTX Genesis Hackathon 官方活动问答、公开报名 Web Search、合作流程详答、口语化平台用途、新手使用指南、时效信息、承诺拒答、提示注入、敏感信息和赛事安全边界。

离线 smoke 强制 `ASSISTANT_FORCE_FALLBACK=1`，验证无 Key 时仍返回引用与信息日期，且不显示虚假的模型在线状态。

本地启用模型：

```bash
cp frontend/.env.example frontend/.env.local
# 在 frontend/.env.local 中填写 DEEPSEEK_API_KEY
# 可选：填写 BRAVE_SEARCH_API_KEY 以获得更稳定的网页搜索；未填写时使用无 Key 搜索兜底
npm run dev
```
