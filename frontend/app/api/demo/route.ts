import { NextResponse } from 'next/server';
import demo from '../../../data/demo.json';

export async function GET() {
  return NextResponse.json(demo, { headers: { 'cache-control': 'no-store' } });
}
