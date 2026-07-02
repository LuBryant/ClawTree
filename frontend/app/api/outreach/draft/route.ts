import { NextRequest, NextResponse } from 'next/server';
import demo from '../../../../data/demo.json';

function badRequest(message: string, code = 'INVALID_REQUEST') {
  return NextResponse.json({ error: { code, message, retryable: false } }, { status: 400 });
}

export async function POST(request: NextRequest) {
  let input: { campaignId?: string; targetId?: string };
  try { input = await request.json(); } catch { return badRequest('请求必须是合法 JSON'); }
  if (input.campaignId !== demo.campaign.id) return badRequest('未知 campaign', 'CAMPAIGN_NOT_FOUND');
  const target = demo.targets.find((item) => item.id === input.targetId);
  if (!target) return badRequest('未知目标高校', 'TARGET_NOT_FOUND');

  return NextResponse.json({
    id: `draft-${demo.campaign.id}-${target.id}`,
    campaignId: demo.campaign.id, targetId: target.id, status: 'draft',
    subject: `合作邀请｜${demo.campaign.name}`,
    body: `${target.organization}的老师/同学，您好：\n\n我们是大树财经。结合 7 月广州高校行与近期世界杯事件驱动财经讨论，我们计划发起一场“世界杯 × AI：事件驱动市场与数据权益”校园内容单元。\n\n贵组织与本次主题的匹配点是：${target.reasons.slice(0, 2).join('；')}。我们希望共同探讨校园圆桌、X Space 或 AI 数据工作坊中的一种轻量合作形式。\n\n如有兴趣，我们可以先用 30 分钟对齐受众、嘉宾和时间。本活动只做财经素养与技术教育，不构成投资建议。\n\n大树财经高校行团队（演示草稿，请勿直接发送）`,
    personalization: target.reasons,
    citationIds: demo.campaign.signalIds,
    guardrailChecks: {
      sourcesVerified: true, noInvestmentPromise: true, noPrivateContactUsed: true,
      humanApprovalRequired: true, mockRecipientClearlyMarked: target.contact.isMock,
    },
    externalSideEffect: false,
  });
}
