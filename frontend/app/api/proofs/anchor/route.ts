import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import demo from '../../../../data/demo.json';

export async function POST(request: NextRequest) {
  let input: { campaignId?: string; draftId?: string };
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: '请求必须是合法 JSON', retryable: false } }, { status: 400 });
  }
  if (input.campaignId !== demo.campaign.id || !input.draftId?.startsWith('draft-')) {
    return NextResponse.json({ error: { code: 'INVALID_PROOF_INPUT', message: '凭证输入无效', retryable: false } }, { status: 400 });
  }
  const publicPayload = {
    payloadVersion: 'clawtree-proof-v1', campaignId: demo.campaign.id, draftId: input.draftId,
    signalIds: [...demo.campaign.signalIds].sort(), approvalStatus: 'simulated_sent',
  };
  const payloadHash = `0x${createHash('sha256').update(JSON.stringify(publicPayload)).digest('hex')}`;
  const txHash = `0x${createHash('sha256').update(`mock-nile:${payloadHash}`).digest('hex')}`;
  return NextResponse.json({
    network: 'TRON Nile (mock)', payloadHash, txHash, isMock: true,
    privacyFields: Object.keys(publicPayload), externalSideEffect: false,
  });
}
