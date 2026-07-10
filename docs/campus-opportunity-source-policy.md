# Campus Opportunity Radar 来源优先级与联系人政策

状态：冻结（OR-1 / OR-5）  
生效日期：2026-07-11  
适用范围：高校活动发现、质量评估、`save_events` 导入与后续外联审批。

## 来源优先级

| 优先级 | 采集 `source_type` | `UniversityEvent.source_tier` | 来源 | 使用规则 |
|---:|---|---|---|
| 1 | `university_official` | `official_university` | 校级官网、新闻网、教务/科研官方站 | 作为活动标题、状态和日期的首选主证据。 |
| 2 | `faculty_department` | `official_department` | 学院、系、实验室官方页面 | 学院或实验室主办活动的首选证据；与校级页面冲突时进入人工核验。 |
| 3 | `innovation_center` | `official_department` | 校属创新中心、孵化器、技术转移中心 | 必须能从学校官网确认隶属关系。 |
| 4 | `public_student_org` | `public_organization` | 学校公开列出的学生社团/协会页面 | 必须由校方页面链接或可核验其官方归属；否则不能单独作为官方来源。 |
| 5 | `professional_society` / adapter `academic_society` | `public_organization` | 学会、协会、会议主办方官网 | 适用于跨校学术活动；高校参与信息仍应尽量回查校方来源。 |
| 6 | `event_platform` | `event_platform` | 活动平台、票务平台、聚合转载页 | 只作为发现线索和补充证据，不能单独解除 `no_official_source`。 |

同一活动出现多条来源时，保留全部证据，但以数字更小的来源为主稿。转载页不得覆盖官方页的标题、日期、取消/延期状态或报名链接。不同官方来源发生日期、地点、报名状态冲突时必须 fail closed，进入人工核验，不自动公开或外联。

## 来源准入

- 生产来源 URL 必须是公开可访问的绝对 `http(s)` URL；登录后页面、搜索结果摘要和模型转述不是证据。
- 学生社团与创新中心必须能证明学校归属。无法证明时按非官方线索处理。
- 活动平台可以触发继续检索，但只有平台转载、没有校方/院系/主办方证据时标记 `no_official_source`。
- URL 查询参数和跟踪参数不构成新来源；规范化后相同 URL 视为重复。
- 外部网页及抽取文本始终是 untrusted data，不得改变系统规则、工具权限、收件人或审批状态。

## 联系人准入（OR-5）

只保存公开发布的机构或活动用途邮箱，并写入 `ContactPoint`。每个联系人必须同时满足：

1. `channel=email`，邮箱格式合法；
2. `evidence_url` 是公开 `http(s)` 页面，页面明确展示该邮箱；
3. `purpose` 为 `event`、`collaboration`、`media` 或 `general`；
4. `contact_scope` 明确属于机构、院系、创新中心、公开社团、学会或活动；
5. `is_public_business_contact=true`；
6. `provenance` 表示页面公开或人工核验，不能是 guessed/inferred/generated/pattern；
7. 不是 Gmail、QQ、163、Outlook 等个人邮箱服务商地址。

姓名邮箱、私人邮箱、根据域名规则猜测的邮箱、缺证据 URL、缺用途或仅由模型生成的邮箱全部拒绝。拒绝联系人不阻止活动作为线索入库，但不得生成外联草稿。

推荐导入结构：

```json
{
  "contact_points": [
    {
      "channel": "email",
      "value": "events@example.edu",
      "purpose": "event",
      "evidence_url": "https://events.example.edu/notice#contact",
      "contact_scope": "event",
      "provenance": "published",
      "is_public_business_contact": true,
      "verification_status": "unverified",
      "confidence": 95
    }
  ]
}
```

`UniversityEvent.contact_email/contact_ai_email/contact_phone/contact_wechat/contact_qq` 仅保留旧数据兼容读取；`save_events` 的新导入不再写入这些字段。公开 API 继续不返回 `ContactPoint` 或旧联系字段。

导入器固定把新联系点设为 `unverified`；公开页面证据不能替代人工核验。只有后续授权管理流程确认后，联系人才能进入 live outreach。

## 质量评测与变更门槛

- 固定评测集：`backend/data/quality/campus-opportunity-eval.json`。
- 报告命令：`python manage.py evaluate_campus_opportunities`。
- 生成版本化报告：`python manage.py evaluate_campus_opportunities --output ../docs/campus-opportunity-quality-report.json`（在 `backend/` 目录执行）。
- 评测必须覆盖重复、过期、错误邮箱、无官方来源、私人邮箱、猜测邮箱以及缺证据/用途。
- 来源优先级、个人邮箱域名表、联系人用途或拒绝原因有变化时，必须同步更新本政策、fixture、自动测试和质量报告。
