import { NextRequest, NextResponse } from 'next/server';
import demo from '../../../data/demo.json';

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

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')?.toLowerCase() || '';
  const filtered = events.filter((event) => !search || `${event.title}${event.description}`.toLowerCase().includes(search));
  return NextResponse.json({ count: filtered.length, next: null, previous: null, results: filtered });
}
