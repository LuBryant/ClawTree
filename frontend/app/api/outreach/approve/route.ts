import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let input: { draftId?: string; approvedBy?: string };
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: '请求必须是合法 JSON', retryable: false } }, { status: 400 });
  }
  if (!input.draftId?.startsWith('draft-') || !input.approvedBy?.trim()) {
    return NextResponse.json({ error: { code: 'APPROVAL_REQUIRED', message: '需要合法草稿和审批人', retryable: false } }, { status: 400 });
  }
  return NextResponse.json({
    draftId: input.draftId, status: 'simulated_sent', approvedBy: input.approvedBy.trim(),
    approvedAt: '2026-07-03T12:00:00+08:00', externalSideEffect: false,
    message: '已记录人工审批；Demo 模式未发送任何邮件。',
  });
}
