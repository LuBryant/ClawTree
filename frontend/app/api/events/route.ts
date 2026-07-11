import { NextRequest, NextResponse } from 'next/server';
import demo from '../../../data/demo.json';

const PAGE_SIZE = 12;

const events = demo.signals.map((signal, index) => ({
  id: index + 1, title: signal.title,
  university: signal.kind === 'campus' ? '广州高校行' : '大树财经生态',
  event_date: signal.publishedAt.slice(0, 10), event_end_date: null,
  location: signal.tags.includes('广州') ? '广州 / 混合' : '线上',
  description: signal.summary, source_url: signal.url, source_name: signal.publisher,
  has_public_contact: false,
  category: signal.tags.includes('AI×Web3') ? 'AI+Web3' : signal.tags.includes('Web3') ? 'Web3' : 'AI',
  event_type: signal.kind === 'hackathon' ? '黑客松' : signal.kind === 'campus' ? '论坛' : '讲座',
  registration_url: '', is_contacted: false, score: Math.round(signal.confidence * 10),
  created_at: signal.fetchedAt,
}));

type FixtureEvent = (typeof events)[number];
type Ordering = 'event_date' | '-event_date' | 'created_at' | '-created_at';

const ORDERINGS = new Set<Ordering>([
  'event_date',
  '-event_date',
  'created_at',
  '-created_at',
]);

function compareEvents(a: FixtureEvent, b: FixtureEvent, ordering: Ordering) {
  const descending = ordering.startsWith('-');
  const field = ordering.endsWith('event_date') ? 'event_date' : 'created_at';
  const comparison = (a[field] || '').localeCompare(b[field] || '');
  return (descending ? -comparison : comparison) || a.id - b.id;
}

function pageUrl(request: NextRequest, page: number) {
  const url = request.nextUrl.clone();
  url.searchParams.set('page', String(page));
  return url.toString();
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const search = params.get('search')?.trim().toLowerCase() || '';
  const category = params.get('category')?.trim() || '';
  const eventType = params.get('event_type')?.trim() || '';
  const requestedOrdering = params.get('ordering') || '-created_at';
  const ordering = ORDERINGS.has(requestedOrdering as Ordering)
    ? requestedOrdering as Ordering
    : '-created_at';
  const requestedPage = Number.parseInt(params.get('page') || '1', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const filtered = events
    .filter((event) => {
      const searchable = [
        event.title,
        event.description,
        event.university,
        event.source_name,
      ].join(' ').toLowerCase();
      return (!search || searchable.includes(search))
        && (!category || event.category === category)
        && (!eventType || event.event_type === eventType);
    })
    .sort((a, b) => compareEvents(a, b, ordering));

  const start = (page - 1) * PAGE_SIZE;
  const results = filtered.slice(start, start + PAGE_SIZE);
  const hasNext = start + PAGE_SIZE < filtered.length;

  return NextResponse.json({
    count: filtered.length,
    next: hasNext ? pageUrl(request, page + 1) : null,
    previous: page > 1 ? pageUrl(request, page - 1) : null,
    results,
  });
}
