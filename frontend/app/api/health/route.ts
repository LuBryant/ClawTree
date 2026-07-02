import { NextResponse } from 'next/server';
import demo from '../../../data/demo.json';

export async function GET() {
  return NextResponse.json({
    status: 'ok', service: 'clawtree', mode: demo.meta.mode,
    fixtureVersion: demo.meta.version, externalSideEffects: false,
  });
}
