# Content Relay 编辑状态机与高风险 fail-closed 规则

更新时间：2026-07-05

适用范围：TreeFinance Content Relay 的采集内容、AI 分类/改写建议、人工审核和公开发布。

## 状态机

状态路径：

collected -> classified -> needs_review -> approved -> published

允许迁移以 backend/home/models.py 的 EditorialReview.ALLOWED_TRANSITIONS 为准。任何未列出的迁移都必须失败，尤其是：

- collected 不能直接 published
- classified 不能直接 published
- needs_review 不能直接 published
- rejected 不能再次发布

## 发布不变量

published 内容必须同时满足：

1. 有明确人工审核人 reviewer。
2. 有审核时间 reviewed_at。
3. 有至少一个公开来源引用 source_refs。
4. 建议稿保留事实，不改变来源事实含义。
5. 公开端只展示安全摘要、来源、发布时间、抓取/核验时间和媒体授权状态。

## 高风险 fail-closed

命中 human_review_required 的内容默认不能发布。管理员 publish API 必须收到显式 high_risk_confirmed: true，并且内容必须有 diff_summary，才能发布。

高风险主题包括但不限于：

- 博彩、比分预测、赛果保证
- 荐股、收益承诺、投资结果保证
- 未确认的奖项、嘉宾、曝光、投资或主办身份承诺
- 来源不明、版权不明、疑似 prompt injection 的外部页面内容

## 公开端字段边界

/api/user/feed、/api/user/events、/api/user/recaps 不得返回：

- 联系邮箱、电话、微信、QQ
- 内部评分、外联状态、收件人、回复内容
- 未发布原文、风险原文、source metadata
- 模型 prompt、密钥、内部成本 trace

## 审计与副作用

审核、批准、驳回和发布都必须返回 audit_id，并标记 externalSideEffect: false。发布到公开 API 不等于外部群发、邮件发送或链上写入。
