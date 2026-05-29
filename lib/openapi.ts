import { listProviders, listProviderRegions, listProviderSurfaces, listProviderModels } from '@/lib/services/public-data';

function unique(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function buildEnums() {
  const providers = listProviders().map((provider) => provider.id).sort();
  const surfaces = unique(
    providers.flatMap((provider) => listProviderSurfaces(provider))
  );
  const regions = unique(
    providers.flatMap((provider) => listProviderRegions(provider))
  );
  const models = unique(
    providers.flatMap((provider) => listProviderModels(provider).map((model) => model.id))
  );

  return {
    providers,
    surfaces,
    regions,
    models,
  };
}

const METRIC_ENUM = [
  'latency_p50_ms',
  'latency_p95_ms',
  'latency_p99_ms',
  'first_token_latency_ms',
  'http_429_rate',
  'http_5xx_rate',
  'tokens_per_sec',
  'stream_disconnect_rate',
];

export function buildOpenApiSpec(version: '3.0.0' | '3.1.0') {
  const enums = buildEnums();

  const baseInfo = {
    title: 'AIStatusDashboard Public API',
    version: '1.0.0',
    description:
      'Read-only API for provider status, incidents, metrics, and recommendations. All responses include request_id, generated_at, evidence, and confidence.',
  };

  const servers = [
    {
      url: 'https://aistatusdashboard.com/api/public/v1',
      description: 'Production',
    },
  ];

  const components = {
    schemas: {
      Evidence: {
        type: 'object',
        properties: {
          source_url: { type: 'string', format: 'uri' },
          metric_window: {
            type: 'object',
            properties: {
              since: { type: 'string', format: 'date-time' },
              until: { type: 'string', format: 'date-time' },
            },
          },
          ids: { type: 'array', items: { type: 'string' } },
          note: { type: 'string' },
        },
      },
      ResponseEnvelope: {
        type: 'object',
        required: ['request_id', 'generated_at', 'evidence', 'confidence', 'data'],
        properties: {
          request_id: { type: 'string' },
          generated_at: { type: 'string', format: 'date-time' },
          evidence: { type: 'array', items: { $ref: '#/components/schemas/Evidence' } },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          data: { type: 'object' },
        },
      },
      Provider: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: enums.providers },
          name: { type: 'string' },
          display_name: { type: 'string' },
          category: { type: 'string' },
          status_url: { type: 'string', format: 'uri' },
          status_page_url: { type: 'string', format: 'uri' },
        },
      },
      StatusSummary: {
        type: 'object',
        properties: {
          window_seconds: { type: 'number' },
          lens: { type: 'string' },
          all_systems_operational: { type: 'boolean' },
          totals: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              operational: { type: 'number' },
              degraded: { type: 'number' },
              down: { type: 'number' },
              maintenance: { type: 'number' },
              unknown: { type: 'number' },
            },
          },
          providers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                provider_id: { type: 'string', enum: enums.providers },
                name: { type: 'string' },
                display_name: { type: 'string' },
                status: { type: 'string' },
                description: { type: 'string' },
                last_updated: { type: 'string', format: 'date-time' },
                active_incident_count: { type: 'number' },
                active_maintenance_count: { type: 'number' },
                degraded_component_count: { type: 'number' },
                source: { type: 'string' },
              },
            },
          },
        },
      },
      CasualStatus: {
        type: 'object',
        properties: {
          app_id: { type: 'string' },
          app_name: { type: 'string' },
          provider_id: { type: 'string', enum: enums.providers },
          overall_status: { type: 'string' },
          headline: { type: 'string' },
          symptoms: { type: 'array', items: { type: 'string' } },
          actions: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
          updated_at: { type: 'string', format: 'date-time' },
          surfaces: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                status: { type: 'string' },
                headline: { type: 'string' },
                symptoms: { type: 'array', items: { type: 'string' } },
                actions: { type: 'array', items: { type: 'string' } },
                confidence: { type: 'number' },
                updated_at: { type: 'string', format: 'date-time' },
                evidence: { type: 'array', items: { type: 'object' } },
              },
            },
          },
          is_it_just_me: {
            type: 'object',
            properties: {
              window_minutes: { type: 'number' },
              reports: { type: 'number' },
              likely_global: { type: 'boolean' },
              baseline_per_10m: { type: 'number' },
              top_regions: { type: 'array', items: { type: 'object' } },
              note: { type: 'string' },
            },
          },
          history: { type: 'object' },
          evidence: { type: 'array', items: { type: 'object' } },
        },
      },
      HealthMatrix: {
        type: 'object',
        properties: {
          provider_id: { type: 'string', enum: enums.providers },
          window_seconds: { type: 'number' },
          lens: { type: 'string' },
          tiles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                providerId: { type: 'string' },
                model: { type: 'string', enum: enums.models },
                endpoint: { type: 'string', enum: enums.surfaces },
                region: { type: 'string', enum: enums.regions },
                tier: { type: 'string' },
                streaming: { type: 'boolean' },
                latencyP50: { type: 'number' },
                latencyP95: { type: 'number' },
                latencyP99: { type: 'number' },
                http5xxRate: { type: 'number' },
                http429Rate: { type: 'number' },
                tokensPerSec: { type: 'number' },
                streamDisconnectRate: { type: 'number' },
                signal: { type: 'string' },
                confidence: { type: 'string' },
                evidence: { type: 'object' },
              },
            },
          },
        },
      },
      Incident: {
        type: 'object',
        properties: {
          incident_id: { type: 'string' },
          providerId: { type: 'string', enum: enums.providers },
          id: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string' },
          severity: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          resolvedAt: { type: 'string', format: 'date-time' },
          impactedRegions: { type: 'array', items: { type: 'string' } },
          impactedModels: { type: 'array', items: { type: 'string' } },
          rawUrl: { type: 'string', format: 'uri' },
          permalink: { type: 'string' },
          updates: { type: 'array', items: { type: 'object' } },
        },
      },
      MetricSeries: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: METRIC_ENUM },
          provider_id: { type: 'string', enum: enums.providers },
          surface: { type: 'string', enum: enums.surfaces },
          model: { type: 'string', enum: enums.models },
          region: { type: 'string', enum: enums.regions },
          tier: { type: 'string' },
          streaming: { type: 'boolean' },
          since: { type: 'string', format: 'date-time' },
          until: { type: 'string', format: 'date-time' },
          granularity_seconds: { type: 'number' },
          series: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                value: { type: 'number', nullable: true },
                sample_count: { type: 'number' },
                sources: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      FallbackPlan: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          jsonPolicy: { type: 'object' },
          evidence: { type: 'object' },
        },
      },
      Policy: {
        type: 'object',
        properties: {
          policy_id: { type: 'string' },
          summary: { type: 'string' },
          objective: { type: 'string' },
          rules: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  } as any;

  const paths = {
    '/providers': {
      get: {
        operationId: 'listProviders',
        summary: 'List providers',
        description: 'Return the list of provider IDs with display names and status URLs.',
        responses: {
          200: {
            description: 'Providers list',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    {
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/Provider' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/providers/{provider}/surfaces': {
      get: {
        operationId: 'listProviderSurfaces',
        summary: 'List provider surfaces',
        parameters: [
          {
            name: 'provider',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: enums.providers },
          },
        ],
        responses: {
          200: {
            description: 'Provider surfaces',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    {
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            provider_id: { type: 'string' },
                            surfaces: { type: 'array', items: { type: 'string', enum: enums.surfaces } },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/providers/{provider}/regions': {
      get: {
        operationId: 'listProviderRegions',
        summary: 'List provider regions',
        parameters: [
          {
            name: 'provider',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: enums.providers },
          },
        ],
        responses: {
          200: {
            description: 'Provider regions',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    {
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            provider_id: { type: 'string' },
                            regions: { type: 'array', items: { type: 'string', enum: enums.regions } },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/providers/{provider}/models': {
      get: {
        operationId: 'listProviderModels',
        summary: 'List provider models',
        parameters: [
          {
            name: 'provider',
            in: 'path',
            required: true,
            schema: { type: 'string', enum: enums.providers },
          },
        ],
        responses: {
          200: {
            description: 'Provider models',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    {
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            provider_id: { type: 'string' },
                            models: { type: 'array', items: { type: 'object' } },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/casual/status': {
      get: {
        operationId: 'getCasualStatus',
        summary: 'Get casual-mode status summary for a consumer app.',
        parameters: [
          { name: 'app', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'window_minutes', in: 'query', required: false, schema: { type: 'number' } },
        ],
        responses: {
          200: {
            description: 'Casual status payload',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    { properties: { data: { $ref: '#/components/schemas/CasualStatus' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/casual/reports': {
      post: {
        operationId: 'postCasualReport',
        summary: 'Submit an anonymous casual-mode user report.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['app', 'surface', 'issue'],
                properties: {
                  app: { type: 'string' },
                  surface: { type: 'string' },
                  issue: { type: 'boolean' },
                  issueType: { type: 'string' },
                  region: { type: 'string' },
                  clientType: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Report accepted or rate-limited',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    {
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            ok: { type: 'boolean' },
                            message: { type: 'string', nullable: true },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/embed/{provider}.json': {
      get: {
        operationId: 'getEmbedStatusJson',
        summary: 'Minimal embed status payload for a provider/app.',
        servers: [{ url: 'https://aistatusdashboard.com' }],
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Embed JSON payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string' },
                    provider_id: { type: 'string' },
                    status: { type: 'string' },
                    headline: { type: 'string' },
                    updated_at: { type: 'string', format: 'date-time' },
                    casual_url: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/embed/{provider}.svg': {
      get: {
        operationId: 'getEmbedStatusSvg',
        summary: 'SVG embed badge for a provider/app.',
        servers: [{ url: 'https://aistatusdashboard.com' }],
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'SVG badge',
            content: {
              'image/svg+xml': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/embed/{provider}.js': {
      get: {
        operationId: 'getEmbedStatusScript',
        summary: 'JavaScript embed snippet for a provider/app.',
        servers: [{ url: 'https://aistatusdashboard.com' }],
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Embed script',
            content: {
              'application/javascript': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/status/summary': {
      get: {
        operationId: 'getStatusSummary',
        summary: 'Get status summary',
        parameters: [
          { name: 'provider', in: 'query', schema: { type: 'string', enum: enums.providers } },
          { name: 'lens', in: 'query', schema: { type: 'string', enum: ['official', 'observed', 'synthetic', 'crowd', 'my_org'] } },
          { name: 'surface', in: 'query', schema: { type: 'string', enum: enums.surfaces } },
          { name: 'region', in: 'query', schema: { type: 'string', enum: enums.regions } },
          { name: 'model', in: 'query', schema: { type: 'string', enum: enums.models } },
          { name: 'window_seconds', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          200: {
            description: 'Status summary',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    { properties: { data: { $ref: '#/components/schemas/StatusSummary' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/status/health-matrix': {
      get: {
        operationId: 'getHealthMatrix',
        summary: 'Get health matrix',
        parameters: [
          { name: 'provider', in: 'query', required: true, schema: { type: 'string', enum: enums.providers } },
          { name: 'lens', in: 'query', schema: { type: 'string', enum: ['observed', 'synthetic', 'crowd', 'my_org'] } },
          { name: 'window_seconds', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          200: {
            description: 'Health matrix',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    { properties: { data: { $ref: '#/components/schemas/HealthMatrix' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/incidents': {
      get: {
        operationId: 'listIncidents',
        summary: 'Search incidents',
        parameters: [
          { name: 'provider', in: 'query', schema: { type: 'string', enum: enums.providers } },
          { name: 'severity', in: 'query', schema: { type: 'string' } },
          { name: 'active_only', in: 'query', schema: { type: 'boolean' } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'until', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'region', in: 'query', schema: { type: 'string', enum: enums.regions } },
          { name: 'model', in: 'query', schema: { type: 'string', enum: enums.models } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          200: {
            description: 'Incident list',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    {
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            incidents: { type: 'array', items: { $ref: '#/components/schemas/Incident' } },
                            next_cursor: { type: 'string', nullable: true },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/incidents/{incident_id}': {
      get: {
        operationId: 'getIncident',
        summary: 'Fetch incident',
        parameters: [
          { name: 'incident_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Incident detail',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    { properties: { data: { $ref: '#/components/schemas/Incident' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/metrics': {
      get: {
        operationId: 'queryMetrics',
        summary: 'Query metrics',
        parameters: [
          { name: 'metric', in: 'query', required: true, schema: { type: 'string', enum: METRIC_ENUM } },
          { name: 'provider', in: 'query', schema: { type: 'string', enum: enums.providers } },
          { name: 'surface', in: 'query', schema: { type: 'string', enum: enums.surfaces } },
          { name: 'model', in: 'query', schema: { type: 'string', enum: enums.models } },
          { name: 'region', in: 'query', schema: { type: 'string', enum: enums.regions } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'until', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'granularity_seconds', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          200: {
            description: 'Metric series',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    { properties: { data: { $ref: '#/components/schemas/MetricSeries' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/recommendations/fallback_plan': {
      post: {
        operationId: 'getFallbackPlan',
        summary: 'Generate fallback plan',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  provider: { type: 'string', enum: enums.providers },
                  model: { type: 'string', enum: enums.models },
                  endpoint: { type: 'string', enum: enums.surfaces },
                  region: { type: 'string', enum: enums.regions },
                  tier: { type: 'string' },
                  streaming: { type: 'boolean' },
                  signal: { type: 'string' },
                  latency_p50_ms: { type: 'number' },
                  latency_p95_ms: { type: 'number' },
                  latency_p99_ms: { type: 'number' },
                  http_5xx_rate: { type: 'number' },
                  http_429_rate: { type: 'number' },
                  tokens_per_sec: { type: 'number' },
                  stream_disconnect_rate: { type: 'number' },
                },
                required: ['model', 'endpoint', 'region'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Fallback plan',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    { properties: { data: { $ref: '#/components/schemas/FallbackPlan' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/policy/generate': {
      post: {
        operationId: 'generatePolicy',
        summary: 'Generate routing policy',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  provider: { type: 'string', enum: enums.providers },
                  model: { type: 'string', enum: enums.models },
                  endpoint: { type: 'string', enum: enums.surfaces },
                  region: { type: 'string', enum: enums.regions },
                  tier: { type: 'string' },
                  streaming: { type: 'boolean' },
                  objective: { type: 'string' },
                },
                required: ['model', 'endpoint', 'region'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Policy',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ResponseEnvelope' },
                    { properties: { data: { $ref: '#/components/schemas/Policy' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
  } as any;

  return {
    openapi: version,
    info: baseInfo,
    servers,
    paths,
    components,
  };
}
