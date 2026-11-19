import { ProviderStatus } from '../types';
import { filterGoogleCloudRawIncidents } from './google-cloud';
// import { validateStatusResult } from '../validation';

/**
 * Status Parsing Utilities
 *
 * AI CONSTRAINTS:
 * - Each function does ONE thing only
 * - MUST return ProviderStatus type
 * - MUST handle all edge cases
 * - MUST validate input data
 */

/**
 * Parse StatusPage.io v2 API response
 *
 * AI CONSTRAINTS:
 * - MUST return one of: 'operational' | 'degraded' | 'down' | 'unknown'
 * - MUST handle missing indicator gracefully
 * - MUST validate response structure
 */
export function parseStatusPageResponse(data: any): ProviderStatus {
  try {
    // Validate basic structure
    if (!data || typeof data !== 'object') {
      return 'unknown';
    }

    const indicator = data.status?.indicator;

    // Map StatusPage indicators to our status types
    switch (indicator) {
      case 'none':
        return 'operational';
      case 'minor':
        return 'degraded';
      // "major" is Statuspage's word for a partial outage; only "critical" is
      // the full one (see normalizeSeverity in platform-parsers.ts).
      case 'major':
        return 'partial_outage';
      case 'critical':
        return 'down';
      default:
        return 'unknown';
    }
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse Instatus summary API response
 *
 * AI CONSTRAINTS:
 * - MUST handle minimal summary payloads
 * - MUST map common status strings to ProviderStatus
 */
export function parseInstatusSummaryResponse(data: any): ProviderStatus {
  try {
    if (!data || typeof data !== 'object') {
      return 'unknown';
    }

    const rawStatus =
      typeof data.page?.status === 'string'
        ? data.page.status
        : typeof data.status === 'string'
          ? data.status
          : typeof data.status?.indicator === 'string'
            ? data.status.indicator
            : undefined;

    if (!rawStatus) {
      return 'unknown';
    }

    const normalized = rawStatus.trim().toLowerCase();

    if (['up', 'operational', 'ok', 'online'].includes(normalized)) {
      return 'operational';
    }

    if (
      normalized.includes('down') ||
      normalized.includes('outage') ||
      normalized.includes('major') ||
      normalized.includes('critical')
    ) {
      return 'down';
    }

    if (
      normalized.includes('issue') ||
      normalized.includes('degrad') ||
      normalized.includes('partial') ||
      normalized.includes('maint')
    ) {
      return 'degraded';
    }

    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse Meta status JSON response
 *
 * AI CONSTRAINTS:
 * - MUST handle array of orgs with services
 * - MUST detect non-operational service statuses
 */
export function parseMetaStatusResponse(data: any): ProviderStatus {
  try {
    if (!Array.isArray(data)) {
      return 'unknown';
    }

    let hasServices = false;
    let hasIssues = false;

    for (const org of data) {
      const services = Array.isArray(org?.services) ? org.services : [];
      for (const service of services) {
        if (typeof service?.status !== 'string') {
          continue;
        }

        hasServices = true;
        const normalized = service.status.trim().toLowerCase();

        if (
          normalized.includes('resolved') ||
          normalized.includes('no known issues') ||
          normalized.includes('no issues') ||
          normalized.includes('operational') ||
          normalized.includes('low disruption')
        ) {
          continue;
        }

        if (
          normalized.includes('outage') ||
          normalized.includes('down') ||
          normalized.includes('critical') ||
          normalized.includes('major')
        ) {
          return 'down';
        }

        if (
          normalized.includes('disruption') ||
          normalized.includes('issue') ||
          normalized.includes('incident') ||
          normalized.includes('degrad') ||
          normalized.includes('partial')
        ) {
          if (normalized.includes('low') || normalized.includes('minor') || normalized.includes('resolved')) {
            continue;
          }
          hasIssues = true;
        }
      }
    }

    if (!hasServices) {
      return 'unknown';
    }

    return hasIssues ? 'degraded' : 'operational';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse Better Stack status page index.json response
 *
 * AI CONSTRAINTS:
 * - MUST read aggregate_state when present
 * - MUST map Better Stack states into ProviderStatus
 */
export function parseBetterstackResponse(data: any): ProviderStatus {
  try {
    if (!data || typeof data !== 'object') {
      return 'unknown';
    }

    const rawStatus =
      typeof data?.data?.attributes?.aggregate_state === 'string'
        ? data.data.attributes.aggregate_state
        : typeof data?.data?.attributes?.status === 'string'
          ? data.data.attributes.status
          : undefined;

    if (!rawStatus) return 'unknown';
    const normalized = rawStatus.trim().toLowerCase();

    if (['operational', 'ok', 'up', 'healthy'].includes(normalized)) {
      return 'operational';
    }

    if (normalized.includes('maintenance') || normalized.includes('maint')) {
      return 'maintenance';
    }

    if (normalized.includes('downtime') || normalized.includes('outage') || normalized.includes('major')) {
      return 'down';
    }

    if (normalized.includes('degrad') || normalized.includes('partial') || normalized.includes('incident')) {
      return 'degraded';
    }

    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse Google Cloud status API response
 *
 * AI CONSTRAINTS:
 * - MUST handle array of incidents
 * - MUST check for active incidents only
 * - MUST validate incident structure
 */
export function parseGoogleCloudResponse(
  data: any,
  options?: { productCatalog?: Map<string, string>; keywords?: string[] }
): ProviderStatus {
  try {
    // Must be an array
    if (!Array.isArray(data)) {
      return 'unknown';
    }

    const filtered = options?.keywords || options?.productCatalog
      ? filterGoogleCloudRawIncidents(data, options?.productCatalog, options?.keywords)
      : data;

    // Check for active incidents with significant impact
    const hasActiveIncidents = filtered.some(
      (incident) =>
        incident &&
        !incident.end && // Incident is ongoing
        incident.status_impact &&
        ['SERVICE_OUTAGE', 'SERVICE_DISRUPTION'].includes(incident.status_impact)
    );

    return hasActiveIncidents ? 'degraded' : 'operational';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse RSS/XML feed (basic availability check)
 *
 * AI CONSTRAINTS:
 * - MUST check for non-empty content
 * - MUST handle text responses
 * - MUST return operational if accessible
 */
export function parseRssFeedResponse(data: any): ProviderStatus {
  try {
    if (typeof data !== 'string') {
      return 'unknown';
    }

    const items = data.match(/<item[\s\S]*?<\/item>/gi) || [];
    if (items.length === 0) {
      return data.length > 0 ? 'operational' : 'unknown';
    }

    const resolvedKeywords = [
      'resolved',
      'completed',
      'closed',
      'mitigated',
      'restored',
      'recovered',
    ];
    const degradedKeywords = [
      'degraded',
      'partial',
      'performance',
      'latency',
      'issue',
      'incident',
      'investigating',
      'identified',
      'monitoring',
      'impact',
    ];
    const downKeywords = [
      'outage',
      'down',
      'unavailable',
      'service disruption',
      'critical',
      'major',
    ];

    let hasDegraded = false;

    for (const item of items) {
      const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descriptionMatch = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const contentMatch = item.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);

      const rawText = [titleMatch?.[1], descriptionMatch?.[1], contentMatch?.[1]]
        .filter(Boolean)
        .join(' ');

      const text = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

      const isResolved = resolvedKeywords.some((keyword) => text.includes(keyword));
      const isDown = downKeywords.some((keyword) => text.includes(keyword));
      const isDegraded = degradedKeywords.some((keyword) => text.includes(keyword));

      if (isDown && !isResolved) {
        return 'down';
      }

      if (isDegraded && !isResolved) {
        hasDegraded = true;
      }
    }

    return hasDegraded ? 'degraded' : 'operational';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse HTML response for status indicators
 *
 * AI CONSTRAINTS:
 * - MUST look for common status keywords
 * - MUST handle HTML content safely
 * - MUST default to operational if no issues found
 */
export function parseHtmlResponse(data: any): ProviderStatus {
  try {
    if (typeof data !== 'string') {
      return 'unknown';
    }

    const html = data.toLowerCase();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ');
    const text = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    const downKeywords = [
      'major outage',
      'service outage',
      'outage',
      'down',
      'unavailable',
    ];
    const degradedKeywords = [
      'degraded',
      'partial outage',
      'service disruption',
      'performance issues',
      'elevated errors',
      'elevated latency',
      'investigating',
      'identified',
      'monitoring',
      'partial disruption',
    ];
    const operationalKeywords = [
      'all systems operational',
      'all services operational',
      'no known issues',
      'no incidents',
      'all systems go',
      'operational',
    ];

    if (downKeywords.some((keyword) => text.includes(keyword))) {
      return 'down';
    }

    if (degradedKeywords.some((keyword) => text.includes(keyword))) {
      return 'degraded';
    }

    return operationalKeywords.some((keyword) => text.includes(keyword))
      ? 'operational'
      : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Determine status from connectivity check results
 *
 * AI CONSTRAINTS:
 * - MUST calculate percentage of successful endpoints
 * - MUST handle empty results array
 * - MUST return appropriate status based on success rate
 */
export function parseConnectivityResults(
  results: Array<{ success: boolean; endpoint: string }>
): ProviderStatus {
  try {
    if (!Array.isArray(results) || results.length === 0) {
      return 'unknown';
    }

    const successfulCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const successRate = successfulCount / totalCount;

    // Determine status based on success rate
    if (successRate === 1.0) {
      return 'operational';
    } else if (successRate >= 0.5) {
      return 'degraded';
    } else if (successRate > 0) {
      return 'degraded';
    } else {
      return 'down';
    }
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Calculate response time with validation
 *
 * AI CONSTRAINTS:
 * - MUST return non-negative number
 * - MUST handle invalid start times
 * - startTime MUST be valid timestamp
 */
export function calculateResponseTime(startTime: number): number {
  try {
    if (typeof startTime !== 'number' || startTime <= 0) {
      return 0;
    }

    const responseTime = Date.now() - startTime;
    return Math.max(0, responseTime);
  } catch (error) {
    return 0;
  }
}

/**
 * Create ISO timestamp string
 *
 * AI CONSTRAINTS:
 * - MUST return valid ISO 8601 string
 * - MUST handle Date creation errors
 * - MUST use current time if no date provided
 */
export function createTimestamp(date?: Date): string {
  try {
    const targetDate = date || new Date();
    return targetDate.toISOString();
  } catch (error) {
    // Fallback to current time
    return new Date().toISOString();
  }
}

/**
 * Validate and sanitize provider ID
 *
 * AI CONSTRAINTS:
 * - MUST return non-empty string
 * - MUST handle null/undefined input
 * - MUST remove invalid characters
 */
export function sanitizeProviderId(id: any): string {
  try {
    if (typeof id !== 'string' || id.length === 0) {
      return 'unknown';
    }

    // Remove invalid characters and convert to lowercase
    return id.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Format provider name safely
 *
 * AI CONSTRAINTS:
 * - MUST return non-empty string
 * - MUST handle null/undefined input
 * - MUST trim whitespace
 */
export function formatProviderName(name: any): string {
  try {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return 'Unknown Provider';
    }

    return name.trim();
  } catch (error) {
    return 'Unknown Provider';
  }
}
