import { NextRequest } from 'next/server';
import { getRequestOrigin } from '@/lib/utils/request';
import { jsonResponse } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const payload = {
    schema_version: 'v1',
    name_for_human: 'AIStatusDashboard',
    name_for_model: 'aistatusdashboard',
    description_for_human: 'Public status, incidents, and AI provider health telemetry.',
    description_for_model:
      'Read-only API for provider status, incidents, metrics, and fallback recommendations. Returns request_id, evidence, and confidence on every call.',
    auth: {
      type: 'none',
    },
    api: {
      type: 'openapi',
      url: `${origin}/openapi.json`,
      is_user_authenticated: false,
    },
    logo_url: `${origin}/logo.png`,
    contact_email: 'support@aistatusdashboard.com',
    legal_info_url: `${origin}/`,
  };
  return jsonResponse(request, payload, { cacheSeconds: 600 });
}
