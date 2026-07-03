import { NextResponse } from 'next/server';
import { publicRecaps } from '../../../lib/public-data';

export async function GET() {
  const results = publicRecaps.map((recap) => ({
    id: recap.id,
    slug: recap.slug,
    title: recap.title,
    summary: recap.summary,
    sourceUrl: recap.sourceUrl,
    publishedAt: recap.publishedAt,
    fetchedAt: recap.fetchedAt,
    tags: recap.tags,
    editorialStatus: recap.editorialStatus,
    editorNote: recap.editorNote,
  }));

  return NextResponse.json(
    { count: results.length, results, externalSideEffect: false },
    { headers: { 'cache-control': 'no-store' } },
  );
}
