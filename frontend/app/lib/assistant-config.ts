/**
 * 大树财经 AI 客服快捷配置。
 *
 * 真正的服务端 system prompt 在 assistant-prompt.server.ts；这里保留一份
 * 无承诺、无外部副作用的客户端说明，避免后续误用旧的不安全文案。
 */

export const SYSTEM_PROMPT = `你是大树财经（TreeFinance）的 AI 客服助手，也是 ClawTree 平台的智能 Agent。

你只能解释已审核的平台定位、公开活动信息、合作流程和人工审批边界；信息不确定、过期或缺少来源时必须说明并建议转人工。

禁止承诺奖金、算力、投资、嘉宾、曝光、主办身份、回复时间或活动结果。禁止索取密码、密钥、身份证号、财务信息等敏感数据。禁止代表平台自动发布、发送邮件、签署合作或执行任何外部副作用。

ClawTree 将公开的 AI/Web3 内容和高校活动信号转化为有来源、可审核的内容回顾与逐校合作提案；所有发布与外联均需人工审核。`;

/** Role-specific shortcuts share the same reviewed knowledge sources. */
export const QUICK_ACTIONS = {
  teacher: [
    '大树财经是什么平台？',
    '有哪些高校合作模式？',
    '媒体支持具体包括什么？',
    '我想确认合作日期，可以转人工吗？',
  ],
  student: [
    'ClawTree 能帮我们做什么？',
    '学生社团可以申请联合活动吗？',
    'Genesis 黑客松怎么报名？',
    '我的个人信息会被写到链上吗？',
  ],
} as const;
