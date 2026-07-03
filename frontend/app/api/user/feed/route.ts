import { NextResponse } from 'next/server';
import { publicSignals } from '../../../lib/public-data';

export async function GET() {
  const results = publicSignals.map((signal) => ({
    id: signal.id,
    kind: signal.kind,
    title: signal.title,
    summary: signal.summary,
    publisher: signal.publisher,
    url: signal.url,
    publishedAt: signal.publishedAt,
    fetchedAt: signal.fetchedAt,
    verification: signal.verification,
    confidence: signal.confidence,
    tags: signal.tags,
    boundary: signal.boundary,
  }));

  return NextResponse.json(
    { count: results.length, results, externalSideEffect: false },
    { headers: { 'cache-control': 'no-store' } },
  );
}
