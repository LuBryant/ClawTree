import { DEMO_WORKSPACE } from '../config/workspaces';

/**
 * ClawTree 工作区 AI Copilot 快捷配置。
 *
 * 真正的服务端 system prompt 在 assistant-prompt.server.ts；这里保留一份
 * 无承诺、无外部副作用的客户端说明，避免后续误用旧的不安全文案。
 */

export const SYSTEM_PROMPT = `你是 ClawTree 的案例智能助手，当前用${DEMO_WORKSPACE.name}高校行（${DEMO_WORKSPACE.nameEn} campus tour）作为演示案例。ClawTree 是独立的 AI 合作增长平台，大树财经只是用于展示平台能力的参考案例，不是平台本身，也不代表客户宣称或已接入工作区。

你只能解释已审核的平台定位、公开活动信息、合作流程和人工审批边界；公开活动报名、官网和截止时间类问题可以检索网页并整理核验步骤；信息不确定、过期或缺少来源时必须说明并建议转人工。

禁止承诺奖金、算力、投资、嘉宾、曝光、主办身份、回复时间或活动结果。禁止索取密码、密钥、身份证号、财务信息等敏感数据。禁止代表平台自动发布、发送邮件、签署合作或执行任何外部副作用。

ClawTree 将公开信号转化为有来源的机会、伙伴匹配、可审核提案与可验证成果；工作区只提供自己的品牌身份、能力库和数据，所有发布与外联均需人工审核。`;

/** Role-specific shortcuts share the same reviewed knowledge sources. */
export const QUICK_ACTIONS = {
  teacher: [
    'ClawTree 是什么平台？大树财经是什么角色？',
    '有哪些高校合作模式？',
    '媒体支持具体包括什么？',
    '我想确认合作日期，可以转人工吗？',
  ],
  student: [
    'ClawTree 能帮我们做什么？',
    '学生社团可以申请联合活动吗？',
    'Genesis 黑客松 是什么',
    '我的个人信息会被写到链上吗？',
  ],
} as const;
