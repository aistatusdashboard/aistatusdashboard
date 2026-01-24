import { NextRequest, NextResponse } from 'next/server';
import { statusService } from '@/lib/services/status';
import { providerService } from '@/lib/services/providers';
import { log } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const providerId = request.nextUrl.searchParams.get('provider');

    if (providerId) {
      const provider = providerService.getProvider(providerId);
      if (!provider) {
        return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
      }

      const result = await statusService.checkProvider(provider);
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        count: 1,
        data: [result],
      });
    }

    const providers = providerService.getProviders();
    const results = await statusService.checkAll(providers);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      count: results.length,
      data: results
    });
  } catch (error) {
    log('error', 'Status API failed', { error });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
