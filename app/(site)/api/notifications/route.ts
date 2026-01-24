import { NextRequest, NextResponse } from 'next/server';

/**
 * NOTIFICATIONS API PROXY
 *
 * This route proxies requests to Firebase Functions to avoid CORS issues
 * during local development while maintaining the same API interface.
 */

const FIREBASE_FUNCTIONS_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net';

async function proxyToFirebase(request: NextRequest, method: string): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const firebaseUrl = `${FIREBASE_FUNCTIONS_BASE}/api/notifications${url.search}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Copy relevant headers from the original request
    const userAgent = request.headers.get('user-agent');
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // For POST requests, include the body
    if (method === 'POST' && request.body) {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(firebaseUrl, fetchOptions);
    const data = await response.text();

    // Return the response with CORS headers
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Proxy error',
        message: 'Failed to connect to Firebase Functions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyToFirebase(request, 'GET');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyToFirebase(request, 'POST');
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 