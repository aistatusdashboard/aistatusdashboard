import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest, { params }: { params: { series_id: string } }) {
  const now = new Date().toISOString();
  return NextResponse.json(
    {
      series_id: params.series_id,
      generated_at: now,
      values: [],
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    }
  );
}
