import { NextResponse } from 'next/server';
import { publicEvents } from '../../../lib/public-data';

export async function GET() {
  const results = publicEvents.map((event) => ({
    id: event.id,
    title: event.title,
    city: event.city,
    startsAt: event.startsAt,
    sourceUrl: event.sourceUrl,
    sourceLabel: event.sourceLabel,
    status: event.status,
    credibility: event.credibility,
    tags: event.tags,
    registrationUrl: event.registrationUrl,
    publicNote: event.publicNote,
  }));

  return NextResponse.json(
    { count: results.length, results, externalSideEffect: false },
    { headers: { 'cache-control': 'no-store' } },
  );
}
