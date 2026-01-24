import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    config: {
      firebaseProject: config.firebase.projectId ? 'configured' : 'missing',
    },
    responseTime: Date.now() - startTime
  };

  return NextResponse.json(health, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    },
  });
}
