import { NextResponse } from 'next/server';

import intelligence from '../../../../data/champion-intelligence.json';
import { answerGroundedCopilot } from '../../../lib/champion-intelligence.mjs';

type CopilotRequest = { query?: unknown };

export async function POST(request: Request) {
  let payload: CopilotRequest;
  try {
    payload = await request.json() as CopilotRequest;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  if (typeof payload.query !== 'string' || !payload.query.trim() || payload.query.length > 400) {
    return NextResponse.json({ error: 'INVALID_QUERY' }, { status: 400 });
  }

  const result = answerGroundedCopilot(intelligence, payload.query.trim());
  const sourceById = new Map(intelligence.graph.nodes
    .filter((node) => node.type === 'source')
    .map((node) => [node.id, node]));
  const citations = result.citations.map((sourceId: string) => {
    const source = sourceById.get(sourceId);
    return source ? {
      id: source.id,
      label: source.label,
      url: 'url' in source ? source.url : null,
      checkedAt: 'checkedAt' in source ? source.checkedAt : null,
    } : { id: sourceId };
  });

  return NextResponse.json({
    ...result,
    citations,
    dataMode: intelligence.meta.dataMode,
    externalSideEffect: false,
  }, { headers: { 'cache-control': 'no-store' } });
}
