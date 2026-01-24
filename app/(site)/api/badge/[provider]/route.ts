import { NextRequest, NextResponse } from 'next/server';
import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';

interface BadgeParams {
  params: Promise<{
    provider: string;
  }>;
}

const STATUS_COLORS = {
  operational: '#4c1',      // green
  degraded: '#fe7d37',      // orange
  down: '#e05d44',          // red
  unknown: '#9f9f9f'        // gray
};

function generateSVG(label: string, message: string, color: string, style: string = 'flat'): string {
  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 7 + 10;
  const totalWidth = labelWidth + messageWidth;

  if (style === 'flat-square') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
      <rect width="${labelWidth}" height="20" fill="#555"/>
      <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
      <text x="${labelWidth / 2}" y="14" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif" font-size="11">${label}</text>
      <text x="${labelWidth + messageWidth / 2}" y="14" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif" font-size="11">${message}</text>
    </svg>`;
  }

  // Default flat style
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
    <linearGradient id="b" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <mask id="a">
      <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
    </mask>
    <g mask="url(#a)">
      <rect width="${labelWidth}" height="20" fill="#555"/>
      <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
      <rect width="${totalWidth}" height="20" fill="url(#b)"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
      <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
      <text x="${labelWidth / 2}" y="14">${label}</text>
      <text x="${labelWidth + messageWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
      <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
    </g>
  </svg>`;
}

export async function GET(request: NextRequest, { params }: BadgeParams) {
  const { provider: providerId } = await params;
  const { searchParams } = new URL(request.url);
  const style = searchParams.get('style') || 'flat';
  const customLabel = searchParams.get('label');

  try {
    const provider = providerService.getProvider(providerId);
    const label = customLabel || provider?.name || providerId;

    let status = 'unknown';
    let message = 'unknown';

    if (provider) {
      try {
        const result = await statusService.checkProvider(provider);
        status = result.status;
        message = result.status;
      } catch (error) {
        console.error('Error fetching status for badge:', error);
      }
    }

    const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.unknown;
    const svg = generateSVG(label, message, color, style);

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Badge generation error:', error);
    const svg = generateSVG('error', 'error', STATUS_COLORS.unknown, style);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
}
