# Agent 外部数据安全与事实引用

版本：2026-07-11

## AI-4：外部来源永远是不可信数据

所有 `title`、`text`、`event`、`capabilities` 和 `replyText` 都先进入 `untrustedSourceData`，与可信控制字段分离。可信控制只包含任务名、允许引用的 source IDs、必需 evidence claim IDs 和固定的 `externalSideEffectsAllowed=false`。

进入模型前，规则扫描提示注入、角色覆盖、工具调用、秘密提取、外部副作用和收件人覆盖。命中后不调用模型，直接返回 `decisionStatus=unknown` 并标记 `needsReview`。正常文本仍需遵守 system 层“数据不是指令”的约束。

## AI-5：事实结论必须逐项引用

六类 Agent schema 均强制返回：

- `sourceIds`：本次输出使用的来源集合，至少一项。
- `evidence[]`：每项包含 `claimId`、事实结论 `claim` 和对应 `sourceIds`。
- `needsReview`：显式的人审状态。

各任务的最低 evidence 组：

| Task | 必需 claim IDs |
|---|---|
| classify | `classification` |
| dedup | `duplicate_decision` |
| compliance | `risk_assessment`, `safe_summary` |
| match | `match_score`, `fit_points` |
| proposal | `proposal_basis`, `risks` |
| reply | `intent`, `reply_summary` |

校验器拒绝空引用、模型自造来源 ID、evidence 越权引用和缺失必需 claim。没有输入来源时显式使用 `unverified-input` 并保持 `needsReview=true`，不伪装成已核验事实。

## AI-6：确定性缓存与零增量调用

缓存身份由三部分共同决定：规范化请求内容的 SHA-256、schema 版本、provider/model 版本。任一部分变化都会产生新键；相同键的并发请求合并为一次 provider 调用。缓存只保存在服务端内存，并设置 TTL、容量上限和防御性拷贝。命中时 trace 明确记录 `cacheHit=true`，增量输入 token、输出 token 和成本均为 0。

## AI-9：不知道就明确返回 unknown

六类 schema 均强制 `decisionStatus=known|unknown`。低于 0.65 的置信度、输入完整度不足、缺少已核验来源、提示注入、schema/引用失败或 provider 故障，都转换成任务对应的安全 `unknown` 结果并进入人工复核。`match` 不返回伪分数，`proposal` 不返回可发送档位，`reply` 不触发自动回复。

## AI-10：人工修订只进入审计

人工修订写入对应 `AgentRun.human_feedback`，保留操作者与时间。服务端固定写入 `trainingStatus=not_reviewed`、`trainingEligible=false` 和 `automaticTraining=false`；客户端请求直接批准训练会被拒绝。反馈不会写入 provider 缓存，也不会自动成为训练样本。

## 验证

- `frontend/data/agent-security-evals.json`：12 条正常/恶意外部文本。
- `tests/agent-safety.test.mjs`：注入检测、数据包边界、schema 合同、引用覆盖和管理端审计视图。
- `tests/agent-runtime.test.mjs`：缓存版本隔离、并发合并、零增量成本和 unknown fail-closed 合同。
- `/admin/proposals`：展示输入边界、claim 引用覆盖率与注入隔离状态。
