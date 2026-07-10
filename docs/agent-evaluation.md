# Agent Offline Evaluation

`frontend/data/agent-golden-evals.json` 是 Agent/AI 的版本化离线回归集。当前版本包含 30 条样本，覆盖 `classify`、`dedup`、`compliance`、`match`、`proposal`、`reply` 六类固定 Schema，并包含 7 条信息不足、语义模糊或意图未知的低置信反例。

## Run

```bash
npm run eval:agents
```

命令不访问网络、数据库或模型供应商，读取冻结的候选输出指标投影并生成 `docs/agent-evaluation-report.json`。`prediction` 只保留评价所需字段，不替代完整 Agent JSON Schema。`evaluateAgentGolden()` 也可直接接收替换过 `prediction` 的同结构对象，用于比较新的模型、规则或人工标注批次；黄金 `input` 和 `expected` 不应随候选实现一起修改。

## Metric definitions

| Metric | Definition | Gate |
|---|---|---:|
| Classification micro F1 | 对每个 `(case, label)` 计算多标签 TP/FP/FN 后汇总 | >= 0.90 |
| Dedup precision / recall | `isDuplicate` 二分类的 precision 与 recall | 各 >= 0.90 |
| Citation claim coverage | 必需 claim 中至少绑定一个输入允许 source ID 的比例 | 100% |
| Citation source validity | evidence 引用中属于输入允许 source ID 的比例 | 报告项 |
| Proposal acceptance accuracy | 候选 accept/reject 与黄金人工结论的一致率 | >= 0.90 |
| Proposal guardrail pass | 三项 guardrail 为真、无禁止承诺且仍需人工审批 | 100% |
| Low-confidence review recall | 低置信反例中正确标记 `needsReview=true` 的比例 | 100% |
| Low-confidence unknown disposition | 低置信反例显式返回 `decisionStatus=unknown`，且不强制给分类、去重、风险、分数或回复结论 | 100% |

报告同时输出 classification macro F1 / exact match、compliance macro F1 / high-risk recall、match acceptance accuracy / score MAE、reply macro F1，以及各任务样本数。

## Dataset policy

- 每条样本 ID 唯一，并明确记录 dataset version、Schema version 和 `asOf` 日期。
- 分类标签必须来自固定 Agent Schema；dedup 正负样本都必须存在；reply 覆盖 positive/question/decline/ooo/unknown。
- `evidence[].sourceIds` 只能引用该条 `input.sourceIds`，引用未知来源会降低 coverage 并使门禁失败。
- proposal 的 acceptance 与 guardrail 分开评价，禁止用“拒绝所有提案”换取安全分。
- 新增能力或修复低置信行为时追加新版本；不得覆盖历史报告来隐藏回归。
