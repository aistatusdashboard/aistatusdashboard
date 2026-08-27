import { Provider, StatusResult, ProviderStatus } from '@/lib/types';
import { log } from '@/lib/utils/logger';
import { config } from '@/lib/config';
import {
    parseInstatusSummaryResponse,
    parseGoogleCloudResponse,
    parseHtmlResponse,
    parseMetaStatusResponse,
    parseRssFeedResponse,
    parseStatusPageResponse,
    parseBetterstackResponse,
} from '@/lib/utils/status-parsers';
import { getGcpProductCatalog } from '@/lib/services/gcp-product-catalog';
import { GOOGLE_AI_KEYWORDS } from '@/lib/utils/google-cloud';

export class StatusService {
    private cache = new Map<string, { result: StatusResult; expires: number }>();

    async checkProvider(provider: Provider): Promise<StatusResult> {
        const cached = this.getCached(provider.id);
        if (cached) return cached;

        const startTime = Date.now();
        let lastError: string | undefined;

        for (let attempt = 0; attempt <= config.monitoring.defaultRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    provider.timeout || config.monitoring.defaultTimeout
                );

                const response = await fetch(provider.statusUrl, {
                    signal: controller.signal,
                    cache: 'no-store',
                    headers: { 'User-Agent': 'AI-Status-Dashboard/1.0' },
                });

                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                let { status, details } = await this.parseStatus(provider, response);
                if (status === 'unknown') {
                    // Never coerce an unverifiable read into "operational" — an honest
                    // "unknown" beats a false green on a status product.
                    const note = response.ok
                        ? 'Unverified: status page did not provide a clear signal'
                        : `Unverified: status endpoint returned HTTP ${response.status}`;
                    details = details ? `${details} | ${note}` : note;
                }
                const result: StatusResult = {
                    id: provider.id,
                    name: provider.name,
                    displayName: provider.displayName || provider.name,
                    aliases: provider.aliases,
                    status,
                    responseTime,
                    lastChecked: new Date().toISOString(),
                    statusPageUrl: provider.statusPageUrl,
                    ...(details ? { details } : {}),
                };

                this.setCached(provider.id, result);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';
                if (attempt < config.monitoring.defaultRetries) {
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
                }
            }
        }

        return {
            id: provider.id,
            name: provider.name,
            displayName: provider.displayName || provider.name,
            aliases: provider.aliases,
            status: 'unknown',
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
            error: lastError,
            details: 'Unverified: status endpoint unreachable',
            statusPageUrl: provider.statusPageUrl,
        };
    }

    async checkAll(providers: Provider[]): Promise<StatusResult[]> {
        const results = await Promise.allSettled(
            providers.map((p) => this.checkProvider(p))
        );

        return results.map((r, index) => {
            if (r.status === 'fulfilled') return r.value;
            const p = providers[index];
            return {
                id: p.id,
                name: p.name,
                displayName: p.displayName || p.name,
                aliases: p.aliases,
                status: 'unknown',
                responseTime: 0,
                lastChecked: new Date().toISOString(),
                error: r.reason,
                statusPageUrl: p.statusPageUrl,
            };
        });
    }

    private async parseStatus(
        provider: Provider,
        response: Response
    ): Promise<{ status: ProviderStatus; details?: string }> {
        const contentType = response.headers.get('content-type') || '';
        const format = provider.format?.toLowerCase() || '';
        const looksLikeJson =
            contentType.includes('application/json') || provider.statusUrl.endsWith('.json');

        const readJson = async () => {
            try {
                return await response.clone().json();
            } catch {
                return null;
            }
        };

        if (
            format === 'google-cloud' ||
            format === 'statuspage' ||
            format === 'instatus' ||
            format === 'meta' ||
            format === 'betterstack'
        ) {
            const data = await readJson();
            if (!data) {
                const text = await response.clone().text().catch(() => '');
                const parsed = parseHtmlResponse(text);
                if (parsed !== 'unknown') {
                    return { status: parsed };
                }
                if (provider.statusPageUrl) {
                    try {
                        const htmlResponse = await fetch(provider.statusPageUrl, { cache: 'no-store' });
                        const htmlText = await htmlResponse.text();
                        const htmlParsed = parseHtmlResponse(htmlText);
                        if (htmlParsed !== 'unknown') {
                            return { status: htmlParsed };
                        }
                    } catch {
                        // ignore html fallback failures
                    }
                }
                return { status: 'unknown' };
            }

            if (format === 'google-cloud') {
                const catalog =
                    provider.id === 'google-ai' ? await getGcpProductCatalog() : undefined;
                const status = parseGoogleCloudResponse(data, {
                    productCatalog: catalog,
                    keywords: provider.id === 'google-ai' ? GOOGLE_AI_KEYWORDS : undefined,
                });
                return {
                    status,
                };
            }

            if (format === 'instatus') {
                const status = parseInstatusSummaryResponse(data);
                const rawStatus =
                    typeof data?.page?.status === 'string'
                        ? data.page.status
                        : typeof data?.status === 'string'
                            ? data.status
                            : undefined;

                return {
                    status,
                    details: rawStatus ? `status:${rawStatus}` : undefined,
                };
            }

            if (format === 'meta') {
                const metaOrg = Array.isArray(data)
                    ? data.find((org: any) =>
                          String(org?.name || '').toLowerCase().includes('meta')
                      )
                    : null;
                const status = parseMetaStatusResponse(metaOrg ? [metaOrg] : data);
                return {
                    status,
                };
            }

            if (format === 'betterstack') {
                const status = parseBetterstackResponse(data);
                const aggregate =
                    typeof data?.data?.attributes?.aggregate_state === 'string'
                        ? data.data.attributes.aggregate_state
                        : undefined;
                return {
                    status,
                    details: aggregate ? `aggregate:${aggregate}` : undefined,
                };
            }

            const status = parseStatusPageResponse(data);
            const indicator = data?.status?.indicator;
            const description =
                typeof data?.status?.description === 'string' ? data.status.description : undefined;

            return {
                status,
                details:
                    typeof indicator === 'string'
                        ? `indicator:${indicator}${description ? ` (${description})` : ''}`
                        : description,
            };
        }

        if (format === 'rss') {
            try {
                const text = await response.clone().text();
                const parsed = parseRssFeedResponse(text);
                return { status: parsed };
            } catch {
                return { status: 'unknown' };
            }
        }

        if (format === 'html') {
            try {
                const text = await response.clone().text();
                const parsed = parseHtmlResponse(text);
                return { status: parsed };
            } catch {
                return { status: 'unknown' };
            }
        }

            if (looksLikeJson) {
            try {
                const data = await response.clone().json();
                const status =
                    provider.id === 'google-ai'
                        ? parseGoogleCloudResponse(data, {
                              productCatalog: await getGcpProductCatalog(),
                              keywords: GOOGLE_AI_KEYWORDS,
                          })
                        : parseStatusPageResponse(data);

                const indicator = data?.status?.indicator;
                const description =
                    typeof data?.status?.description === 'string' ? data.status.description : undefined;

                return {
                    status,
                    details:
                        typeof indicator === 'string'
                            ? `indicator:${indicator}${description ? ` (${description})` : ''}`
                            : description,
                };
            } catch {
                const text = await response.clone().text().catch(() => '');
                const parsed = parseHtmlResponse(text);
                if (parsed !== 'unknown') {
                    return { status: parsed };
                }
                return { status: 'unknown' };
            }
        }

        try {
            const text = await response.clone().text();
            const parsed = parseHtmlResponse(text);
            return { status: parsed };
        } catch {
            return { status: 'unknown' };
        }
    }

    private getCached(id: string): StatusResult | null {
        const item = this.cache.get(id);
        if (item && Date.now() < item.expires) return item.result;
        return null;
    }

    private setCached(id: string, result: StatusResult) {
        this.cache.set(id, {
            result,
            expires: Date.now() + config.monitoring.cacheTTL,
        });
    }
}

export const statusService = new StatusService();
