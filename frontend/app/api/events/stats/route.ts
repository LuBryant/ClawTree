import { NextResponse } from 'next/server';
import demo from '../../../../data/demo.json';

export async function GET() {
  const total = demo.signals.length;
  return NextResponse.json({
    total, by_category: { AI: 2, Web3: 1, 'AI+Web3': 1 },
    by_type: { 讲座: 2, 黑客松: 1, 论坛: 1, 工作坊: 0, 其他: 0 },
    contacted: 0, uncontacted: total,
  });
}
