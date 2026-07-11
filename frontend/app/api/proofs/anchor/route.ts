import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import demo from '../../../../data/demo.json';

/** 仅包含公开可上链字段，不包含邮箱/正文/联系人 */
const PRIVACY_FIELDS = [
  'payloadVersion', 'workspaceId', 'draftId', 'universityName', 'eventTitle',
  'approvedBy', 'approvedAt', 'approvalStatus', 'campaignId', 'signalIds',
];

interface ProofPayload {
  payloadVersion: string;
  workspaceId: string;
  draftId: string;
  universityName?: string;
  eventTitle?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalStatus: string;
  signalIds?: string[];
  campaignId?: string;
}

export async function POST(request: NextRequest) {
  let input: {
    // 旧版 Demo 参数
    campaignId?: string;
    workspaceId?: string;
    draftId?: string;
    // 新版外联审批参数
    universityName?: string;
    eventTitle?: string;
    approvedBy?: string;
    approvedAt?: string;
  };

  try { input = await request.json(); } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: '请求必须是合法 JSON', retryable: false } },
      { status: 400 },
    );
  }

  // 判断模式：Demo 模式 vs 外联审批模式
  const isDemoMode = input.campaignId === demo.campaign.id
    && (!input.workspaceId || input.workspaceId === demo.workspace.id)
    && input.draftId?.startsWith('draft-');
  const isOutreachMode = !!(input.draftId && input.universityName);

  if (!isDemoMode && !isOutreachMode) {
    return NextResponse.json(
      { error: { code: 'INVALID_PROOF_INPUT', message: '凭证输入无效，需要 draftId + universityName 或有效 Demo 参数', retryable: false } },
      { status: 400 },
    );
  }

  let publicPayload: ProofPayload;

  if (isDemoMode) {
    publicPayload = {
      payloadVersion: 'clawtree-proof-v1',
      workspaceId: demo.workspace.id,
      draftId: input.draftId!,
      campaignId: demo.campaign.id,
      signalIds: [...demo.campaign.signalIds].sort(),
      approvalStatus: 'simulated_sent',
    };
  } else {
    publicPayload = {
      payloadVersion: 'clawtree-proof-v1',
      workspaceId: input.workspaceId || demo.workspace.id,
      draftId: input.draftId!,
      universityName: input.universityName,
      eventTitle: input.eventTitle,
      approvedBy: input.approvedBy,
      approvedAt: input.approvedAt,
      approvalStatus: 'approved_and_sent',
    };
  }

  // 规范化 JSON（按 key 排序）确保确定性哈希
  const normalized = JSON.stringify(publicPayload, Object.keys(publicPayload).sort());
  const payloadHash = `0x${createHash('sha256').update(normalized).digest('hex')}`;
  const txHash = `0x${createHash('sha256').update(`nile-outreach:${payloadHash}`).digest('hex')}`;

  return NextResponse.json({
    network: 'TRON Nile (mock)',
    payloadHash,
    txHash,
    isMock: true,
    privacyFields: PRIVACY_FIELDS,
    externalSideEffect: false,
    publicPayload,
  });
}
