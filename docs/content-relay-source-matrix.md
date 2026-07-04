# TreeFinance Content Relay 来源与授权矩阵

更新时间：2026-07-04

目标：让评委和运营能快速判断哪些内容可以自动采集、哪些只能人工导入、哪些只允许链接引用。任何真实发布仍需人工审核。

| 来源 | 当前接入方式 | 自动化边界 | 媒体处理 | 发布要求 | 状态 |
|---|---|---|---|---|---|
| TreeFinance X / @TreefinanceCN | run_content_relay 离线黄金集；生产可替换为 X API connector | API key 仅服务端环境变量；无 key 使用 fixture adapter；每日预算与游标记录在 IngestionRun | 默认 link_only，不复制图片/视频，除非另有授权 | 必须保留 source URL、发布时间、抓取时间、审核状态 | 工程 Done，真实 API 授权待负责人确认 |
| 合作媒体公开网页 | 手动/fixture 导入为 website source | 只抓公开事实摘要，不绕过付费墙、不复制全文 | 默认链接引用；图片/视频不下载 | 中高风险内容必须编辑改写并保留 diff | Review |
| 微信公众号 | 暂不自动抓取 | 仅接受授权导出、RSS/官方 API 或人工投递；未确认前不做爬虫 | 未授权图片不复制；必要时只放原文链接 | 需内容负责人确认转载/引用边界 | Deferred |
| 高校活动公开页 | OpenClaw JSON 经 save_events 导入，并写 IngestionRun | 仅保存公开机构/活动联系证据；公开端不展示联系人 | 活动海报默认不复制 | 活动来源、核验时间、质量状态必须可见 | Done for import audit |

工程约束：

- 所有外部页面内容都作为 untrusted data，不得作为工具指令执行。
- /user 只展示审核后的摘要、来源和时间，不展示联系人、内部评分、原文风险片段或 prompt。
- 高风险主题只能进入教育化摘要；禁止博彩、荐股、收益承诺和结果保证。
- 重复运行同一 fixture 只增加 duplicate 计数，不重复创建发布内容。
