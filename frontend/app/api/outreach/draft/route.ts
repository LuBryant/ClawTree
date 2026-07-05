import { NextRequest, NextResponse } from 'next/server';
import demo from '../../../../data/demo.json';
import { DEMO_WORKSPACE } from '../../../config/workspaces';

function badRequest(message: string, code = 'INVALID_REQUEST') {
  return NextResponse.json({ error: { code, message, retryable: false } }, { status: 400 });
}

export async function POST(request: NextRequest) {
  let input: { workspaceId?: string; campaignId?: string; targetId?: string };
  try { input = await request.json(); } catch { return badRequest('请求必须是合法 JSON'); }
  if (input.workspaceId && input.workspaceId !== DEMO_WORKSPACE.id) return badRequest('工作区与 Campaign 不匹配', 'WORKSPACE_MISMATCH');
  if (input.campaignId !== demo.campaign.id) return badRequest('未知 campaign', 'CAMPAIGN_NOT_FOUND');
  const target = demo.targets.find((item) => item.id === input.targetId);
  if (!target) return badRequest('未知目标高校', 'TARGET_NOT_FOUND');

  return NextResponse.json({
    id: `draft-${demo.campaign.id}-${target.id}`,
    workspaceId: DEMO_WORKSPACE.id, campaignId: demo.campaign.id, targetId: target.id, status: 'draft',
    subject: `合作邀请｜${demo.campaign.name}`,
    body: `${target.organization}的老师/同学，您好：\n\n我们是${DEMO_WORKSPACE.name}。结合 7 月广州高校行与全球足球赛事的公共讨论，我们计划发起一场“全球足球赛事 × AI：事件驱动市场与数据权益”校园内容单元。\n\n贵组织与本次主题的匹配点是：${target.reasons.slice(0, 2).join('；')}。基于当前工作区已审核的公开能力证据，我们建议先从「${target.recommendedFormat}」开始共创。\n\n如有兴趣，我们可以先用 30 分钟对齐受众、嘉宾和时间。本活动只做财经素养与技术教育：不涉及博彩，不预测比分，不构成投资建议，不承诺收益或结果。\n\n${DEMO_WORKSPACE.outreachSignature}（由 ClawTree 生成的演示草稿，请勿直接发送）`,
    personalization: target.reasons,
    citationIds: [...demo.campaign.signalIds, ...target.evidence.map((item) => item.url)],
    guardrailChecks: {
      sourcesVerified: true, noBetting: true, noScorePrediction: true,
      noInvestmentPromise: true, noReturnPromise: true, noResultGuarantee: true, noPrivateContactUsed: true,
      humanApprovalRequired: true, mockRecipientClearlyMarked: target.contact.isMock,
    },
    externalSideEffect: false,
  });
}
