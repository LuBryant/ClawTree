# TreeFinance AI 客服 / RAG

版本：2026-07-04

## 目标

AI 客服只回答审核知识库支持的平台、案例、合作和资源边界问题。模型负责组织语言，不负责创造事实；无模型 Key 或上游失败时使用同一知识库确定性回答。

## 回答链路

```text
用户问题 + 老师/学生角色
  → 输入长度与角色校验
  → 安全策略（注入、敏感信息、承诺、外部动作）
  → 审核知识检索（owner / 来源 / 核验日期 / 有效期）
  → 未知、过期、冲突：拒答或转人工
  → 有 Key：模型仅基于检索上下文组织答案
  → 无 Key/上游失败：本地 FAQ 答案
  → 回答 + 引用 + 信息日期 + 模式 + 转人工原因
```

## API 契约

请求只接受 `user` / `assistant` 消息和 `teacher` / `student` 角色。响应字段：

- `answer`：审核上下文支持的答案。
- `mode`：`rag_model`、`faq_fallback` 或 `policy_refusal`。
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
- 留资前必须明确用途并获得用户勾选同意；当前 Demo 不发送数据。

## 评测

`frontend/data/assistant-evals.json` 包含 32 个老师/学生问答与对抗样本，覆盖正常回答、未知转人工、时效信息、承诺拒答、提示注入、敏感信息和赛事安全边界。

离线 smoke 强制 `ASSISTANT_FORCE_FALLBACK=1`，验证无 Key 时仍返回引用与信息日期，且不显示虚假的模型在线状态。
