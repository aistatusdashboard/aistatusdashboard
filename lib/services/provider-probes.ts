import probeProviders from '@/lib/data/probe_providers.json';
import type { SyntheticProbeEvent } from '@/lib/types/insights';
import { config } from '@/lib/config';
import { log } from '@/lib/utils/logger';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

type ProbeProviderConfig = {
  providerId: string;
  type: 'openai' | 'anthropic' | 'gemini' | 'cohere' | 'azure-openai' | 'bedrock';
  envKey?: string;
  model: string;
  modelEnvKey?: string;
  modelAlias?: string;
  baseUrl?: string;
  baseUrlEnvKey?: string;
  deploymentEnvKey?: string;
  apiVersion?: string;
  regionEnvKey?: string;
  endpoint: string;
  region: string;
  tier: 'free' | 'pro' | 'enterprise' | 'unknown';
  streaming: boolean;
};

type ProbeRunSummary = {
  events: SyntheticProbeEvent[];
  skipped: Array<{ providerId: string; reason: string }>;
  failures: Array<{ providerId: string; error: string }>;
};

const DEFAULT_TIMEOUT_MS = 12000;

function logProbeFailure(providerId: string, status: number, data: unknown) {
  let detail = '';
  try {
    detail = JSON.stringify(data).slice(0, 400);
  } catch {
    detail = String(data).slice(0, 400);
  }
  log('warn', 'Real probe request failed', { providerId, status, detail });
}

const SEMANTIC_PROMPT = 'Output the word READY and nothing else.';
const PROBE_NETWORK_CODES = [
  'fetch failed',
  'network',
  'enotfound',
  'econn',
  'eai_again',
  'dns',
  'tls',
  'socket',
  'certificate',
];

const AWS_REGION_BY_PROBE_REGION: Record<string, string> = {
  'us-east': 'us-east-1',
  'us-west': 'us-west-2',
  'eu-west': 'eu-west-1',
};

const BEDROCK_INFERENCE_PROFILE_MODELS = ['nova'];

function classifyProbeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'unknown');
  const lower = message.toLowerCase();
  if (lower.includes('abort') || lower.includes('timeout')) return 'probe_timeout';
  if (PROBE_NETWORK_CODES.some((code) => lower.includes(code))) return 'probe_network';
  return 'probe_error';
}

function normalizeApiKey(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, '');
  return normalized || null;
}

function describeKey(value: string | undefined) {
  if (!value) {
    return { length: 0, hasWhitespace: false, hasNonAscii: false, nonAsciiCodes: [] as string[] };
  }
  const nonAsciiCodes = Array.from(
    new Set(
      Array.from(value)
        .map((char) => char.charCodeAt(0))
        .filter((code) => code < 0x20 || code > 0x7e)
        .map((code) => `0x${code.toString(16)}`)
    )
  ).slice(0, 6);
  return {
    length: value.length,
    hasWhitespace: /\s/.test(value),
    hasNonAscii: /[^\x20-\x7E]/.test(value),
    nonAsciiCodes,
  };
}

function resolveModel(configEntry: ProbeProviderConfig): string {
  if (configEntry.modelEnvKey && process.env[configEntry.modelEnvKey]) {
    return process.env[configEntry.modelEnvKey] as string;
  }
  return configEntry.model;
}

function resolveEventModel(configEntry: ProbeProviderConfig): string {
  return configEntry.modelAlias || resolveModel(configEntry);
}

function resolveBaseUrl(configEntry: ProbeProviderConfig): string | undefined {
  if (configEntry.baseUrlEnvKey && process.env[configEntry.baseUrlEnvKey]) {
    return process.env[configEntry.baseUrlEnvKey] as string;
  }
  return configEntry.baseUrl;
}

function resolveRegion(configEntry: ProbeProviderConfig): string {
  if (configEntry.regionEnvKey && process.env[configEntry.regionEnvKey]) {
    return process.env[configEntry.regionEnvKey] as string;
  }
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || configEntry.region;
}

function resolveBedrockRegionOverride(regionOverride?: string): string | undefined {
  if (!regionOverride) return undefined;
  return AWS_REGION_BY_PROBE_REGION[regionOverride] || regionOverride;
}

function requiresInferenceProfile(modelId: string): boolean {
  return BEDROCK_INFERENCE_PROFILE_MODELS.some((token) => modelId.includes(token));
}

function buildEvent(configEntry: ProbeProviderConfig, latencyMs: number): SyntheticProbeEvent {
  return {
    providerId: configEntry.providerId,
    model: resolveEventModel(configEntry),
    endpoint: configEntry.endpoint,
    region: configEntry.region,
    tier: configEntry.tier,
    streaming: configEntry.streaming,
    timestamp: new Date().toISOString(),
    latencyMs,
  };
}

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

function parseOpenAIUsage(data: any) {
  const usage = data?.usage || {};
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? usage.generated_tokens;
  const totalTokens = usage.total_tokens ?? usage.prompt_tokens;
  return { outputTokens, totalTokens };
}

function parseAnthropicUsage(data: any) {
  const usage = data?.usage || {};
  const outputTokens = usage.output_tokens;
  const totalTokens = usage.input_tokens ? usage.input_tokens + (usage.output_tokens || 0) : undefined;
  return { outputTokens, totalTokens };
}

function parseGeminiUsage(data: any) {
  const meta = data?.usageMetadata || {};
  const outputTokens = meta.candidatesTokenCount;
  const totalTokens = meta.totalTokenCount;
  return { outputTokens, totalTokens };
}

function parseCohereUsage(data: any) {
  const usage = data?.meta?.tokens || {};
  const outputTokens = usage.outputTokens;
  const totalTokens = usage.inputTokens && usage.outputTokens ? usage.inputTokens + usage.outputTokens : undefined;
  return { outputTokens, totalTokens };
}

function parseBedrockUsage(data: any) {
  const usage = data?.usage || {};
  const outputTokens = usage.output_tokens || usage.completion_tokens;
  const totalTokens =
    usage.input_tokens && usage.output_tokens ? usage.input_tokens + usage.output_tokens : usage.total_tokens;
  return { outputTokens, totalTokens };
}

function isSemanticMatch(text: string | undefined) {
  return typeof text === 'string' && text.toLowerCase().includes('ready');
}

function extractOpenAIText(data: any): string | undefined {
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text;
}

function extractAnthropicText(data: any): string | undefined {
  if (Array.isArray(data?.content)) {
    return data.content.map((item: any) => item?.text).filter(Boolean).join(' ');
  }
  return data?.content?.text || data?.completion;
}

function extractGeminiText(data: any): string | undefined {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part: any) => part?.text).filter(Boolean).join(' ');
  return text || data?.candidates?.[0]?.text;
}

function extractCohereText(data: any): string | undefined {
  return data?.text || data?.message || data?.response?.text;
}

function extractBedrockText(data: any): string | undefined {
  if (Array.isArray(data?.content)) {
    return data.content.map((item: any) => item?.text).filter(Boolean).join(' ');
  }
  if (Array.isArray(data?.output?.message?.content)) {
    return data.output.message.content.map((item: any) => item?.text).filter(Boolean).join(' ');
  }
  if (Array.isArray(data?.results)) {
    return data.results.map((item: any) => item?.outputText).filter(Boolean).join(' ');
  }
  return data?.completion || data?.outputText || data?.message;
}

async function fetchJson(url: string, options: RequestInit, timeoutMs: number) {
  const { controller, timeout } = withTimeout(timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const latencyMs = Date.now() - start;
    const data = await response.json().catch(() => null);
    return { response, data, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeOpenAICompatible(configEntry: ProbeProviderConfig, apiKey: string) {
  const baseUrl = resolveBaseUrl(configEntry);
  if (!baseUrl) throw new Error('Missing baseUrl');
  const model = resolveModel(configEntry);
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const payload = {
    model,
    messages: [{ role: 'user', content: SEMANTIC_PROMPT }],
    max_tokens: 16,
    temperature: 0,
  };
  const { response, data, latencyMs } = await fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    config.monitoring.defaultTimeout || DEFAULT_TIMEOUT_MS
  );

  const event = buildEvent(configEntry, latencyMs);
  if (!response.ok) {
    logProbeFailure(configEntry.providerId, response.status, data);
    event.errorCode = `http-${response.status}`;
    if (response.status === 429) event.http429Rate = 1;
    if (response.status >= 500) event.http5xxRate = 1;
    return { event };
  }

  const { outputTokens, totalTokens } = parseOpenAIUsage(data);
  const text = extractOpenAIText(data);
  if (!isSemanticMatch(text)) {
    event.errorCode = 'semantic_mismatch';
  }
  const tokens = outputTokens ?? totalTokens;
  if (tokens) {
    event.tokensPerSec = tokens / Math.max(latencyMs / 1000, 0.1);
  }
  return { event };
}

async function probeAnthropic(configEntry: ProbeProviderConfig, apiKey: string) {
  const baseUrl = resolveBaseUrl(configEntry);
  if (!baseUrl) throw new Error('Missing baseUrl');
  const model = resolveModel(configEntry);
  const url = `${baseUrl.replace(/\/$/, '')}/messages`;
  const payload = {
    model,
    max_tokens: 16,
    temperature: 0,
    messages: [{ role: 'user', content: SEMANTIC_PROMPT }],
  };
  const { response, data, latencyMs } = await fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    config.monitoring.defaultTimeout || DEFAULT_TIMEOUT_MS
  );

  const event = buildEvent(configEntry, latencyMs);
  if (!response.ok) {
    logProbeFailure(configEntry.providerId, response.status, data);
    event.errorCode = `http-${response.status}`;
    if (response.status === 429) event.http429Rate = 1;
    if (response.status >= 500) event.http5xxRate = 1;
    return { event };
  }

  const { outputTokens, totalTokens } = parseAnthropicUsage(data);
  const text = extractAnthropicText(data);
  if (!isSemanticMatch(text)) {
    event.errorCode = 'semantic_mismatch';
  }
  const tokens = outputTokens ?? totalTokens;
  if (tokens) {
    event.tokensPerSec = tokens / Math.max(latencyMs / 1000, 0.1);
  }
  return { event };
}

async function probeGemini(configEntry: ProbeProviderConfig, apiKey: string) {
  const baseUrl = resolveBaseUrl(configEntry);
  if (!baseUrl) throw new Error('Missing baseUrl');
  const model = resolveModel(configEntry);
  const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: SEMANTIC_PROMPT }] }],
    generationConfig: {
      maxOutputTokens: 16,
      temperature: 0,
    },
  };
  const { response, data, latencyMs } = await fetchJson(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    config.monitoring.defaultTimeout || DEFAULT_TIMEOUT_MS
  );

  const event = buildEvent(configEntry, latencyMs);
  if (!response.ok) {
    logProbeFailure(configEntry.providerId, response.status, data);
    event.errorCode = `http-${response.status}`;
    if (response.status === 429) event.http429Rate = 1;
    if (response.status >= 500) event.http5xxRate = 1;
    return { event };
  }

  const { outputTokens, totalTokens } = parseGeminiUsage(data);
  const text = extractGeminiText(data);
  if (!isSemanticMatch(text)) {
    event.errorCode = 'semantic_mismatch';
  }
  const tokens = outputTokens ?? totalTokens;
  if (tokens) {
    event.tokensPerSec = tokens / Math.max(latencyMs / 1000, 0.1);
  }
  return { event };
}

async function probeCohere(configEntry: ProbeProviderConfig, apiKey: string) {
  const baseUrl = resolveBaseUrl(configEntry);
  if (!baseUrl) throw new Error('Missing baseUrl');
  const model = resolveModel(configEntry);
  const url = `${baseUrl.replace(/\/$/, '')}/chat`;
  const payload = {
    model,
    message: SEMANTIC_PROMPT,
    max_tokens: 16,
    temperature: 0,
  };
  const { response, data, latencyMs } = await fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    config.monitoring.defaultTimeout || DEFAULT_TIMEOUT_MS
  );

  const event = buildEvent(configEntry, latencyMs);
  if (!response.ok) {
    logProbeFailure(configEntry.providerId, response.status, data);
    event.errorCode = `http-${response.status}`;
    if (response.status === 429) event.http429Rate = 1;
    if (response.status >= 500) event.http5xxRate = 1;
    return { event };
  }

  const { outputTokens, totalTokens } = parseCohereUsage(data);
  const text = extractCohereText(data);
  if (!isSemanticMatch(text)) {
    event.errorCode = 'semantic_mismatch';
  }
  const tokens = outputTokens ?? totalTokens;
  if (tokens) {
    event.tokensPerSec = tokens / Math.max(latencyMs / 1000, 0.1);
  }
  return { event };
}

async function probeAzureOpenAI(configEntry: ProbeProviderConfig, apiKey: string) {
  const baseUrl = resolveBaseUrl(configEntry);
  if (!baseUrl) throw new Error('Missing baseUrl');
  const deployment = configEntry.deploymentEnvKey ? process.env[configEntry.deploymentEnvKey] : undefined;
  if (!deployment) throw new Error('Missing deployment');
  const apiVersion = configEntry.apiVersion || '2024-02-15-preview';
  const url = `${baseUrl.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const payload = {
    messages: [{ role: 'user', content: SEMANTIC_PROMPT }],
    max_tokens: 16,
    temperature: 0,
  };
  const { response, data, latencyMs } = await fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    config.monitoring.defaultTimeout || DEFAULT_TIMEOUT_MS
  );

  const event = buildEvent(configEntry, latencyMs);
  if (!response.ok) {
    logProbeFailure(configEntry.providerId, response.status, data);
    event.errorCode = `http-${response.status}`;
    if (response.status === 429) event.http429Rate = 1;
    if (response.status >= 500) event.http5xxRate = 1;
    return { event };
  }

  const { outputTokens, totalTokens } = parseOpenAIUsage(data);
  const text = extractOpenAIText(data);
  if (!isSemanticMatch(text)) {
    event.errorCode = 'semantic_mismatch';
  }
  const tokens = outputTokens ?? totalTokens;
  if (tokens) {
    event.tokensPerSec = tokens / Math.max(latencyMs / 1000, 0.1);
  }
  return { event };
}

async function probeBedrock(configEntry: ProbeProviderConfig, regionOverride?: string) {
  const region = regionOverride || resolveRegion(configEntry);
  const model = resolveModel(configEntry);
  const client = new BedrockRuntimeClient({ region });

  let payload: any = null;
  if (model.includes('anthropic') || model.includes('claude')) {
    payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 16,
      messages: [{ role: 'user', content: [{ type: 'text', text: SEMANTIC_PROMPT }] }],
    };
  } else if (model.includes('nova')) {
    payload = {
      messages: [{ role: 'user', content: [{ text: SEMANTIC_PROMPT }] }],
      inferenceConfig: {
        maxTokens: 16,
        temperature: 0,
      },
    };
  } else if (model.includes('titan')) {
    payload = {
      inputText: SEMANTIC_PROMPT,
      textGenerationConfig: {
        maxTokenCount: 16,
        temperature: 0,
      },
    };
  } else {
    payload = { prompt: SEMANTIC_PROMPT, max_tokens: 16 };
  }

  const encoder = new TextEncoder();
  const start = Date.now();
  const response = await client.send(
    new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: encoder.encode(JSON.stringify(payload)),
    })
  );
  const latencyMs = Date.now() - start;

  const decoder = new TextDecoder();
  const data = response.body ? JSON.parse(decoder.decode(response.body)) : null;

  const event = buildEvent(configEntry, latencyMs);
  const text = extractBedrockText(data);
  if (!isSemanticMatch(text)) {
    event.errorCode = 'semantic_mismatch';
  }
  const { outputTokens, totalTokens } = parseBedrockUsage(data);
  const tokens = outputTokens ?? totalTokens;
  if (tokens) {
    event.tokensPerSec = tokens / Math.max(latencyMs / 1000, 0.1);
  }
  return { event };
}

export async function runRealProviderProbes(options?: { regionOverride?: string }): Promise<ProbeRunSummary> {
  const configs = (probeProviders as { providers: ProbeProviderConfig[] }).providers || [];
  const events: SyntheticProbeEvent[] = [];
  const skipped: Array<{ providerId: string; reason: string }> = [];
  const failures: Array<{ providerId: string; error: string }> = [];
  const regionOverride = options?.regionOverride;

  for (const entry of configs) {
    const rawKey = entry.envKey ? process.env[entry.envKey] : undefined;
    const apiKey = normalizeApiKey(rawKey);
    const eventRegion =
      entry.type === 'bedrock'
        ? resolveBedrockRegionOverride(regionOverride) || regionOverride || null
        : regionOverride || null;
    try {
      let result;
      switch (entry.type) {
        case 'openai':
          if (!entry.envKey || !rawKey) {
            skipped.push({ providerId: entry.providerId, reason: `Missing ${entry.envKey}` });
            continue;
          }
          if (!apiKey) {
            log('warn', 'Invalid probe key', { providerId: entry.providerId, envKey: entry.envKey, ...describeKey(rawKey) });
            skipped.push({ providerId: entry.providerId, reason: `Invalid ${entry.envKey}` });
            continue;
          }
          result = await probeOpenAICompatible(entry, apiKey as string);
          break;
        case 'anthropic':
          if (!entry.envKey || !rawKey) {
            skipped.push({ providerId: entry.providerId, reason: `Missing ${entry.envKey}` });
            continue;
          }
          if (!apiKey) {
            log('warn', 'Invalid probe key', { providerId: entry.providerId, envKey: entry.envKey, ...describeKey(rawKey) });
            skipped.push({ providerId: entry.providerId, reason: `Invalid ${entry.envKey}` });
            continue;
          }
          result = await probeAnthropic(entry, apiKey as string);
          break;
        case 'gemini':
          if (!entry.envKey || !rawKey) {
            skipped.push({ providerId: entry.providerId, reason: `Missing ${entry.envKey}` });
            continue;
          }
          if (!apiKey) {
            log('warn', 'Invalid probe key', { providerId: entry.providerId, envKey: entry.envKey, ...describeKey(rawKey) });
            skipped.push({ providerId: entry.providerId, reason: `Invalid ${entry.envKey}` });
            continue;
          }
          result = await probeGemini(entry, apiKey as string);
          break;
        case 'cohere':
          if (!entry.envKey || !rawKey) {
            skipped.push({ providerId: entry.providerId, reason: `Missing ${entry.envKey}` });
            continue;
          }
          if (!apiKey) {
            log('warn', 'Invalid probe key', { providerId: entry.providerId, envKey: entry.envKey, ...describeKey(rawKey) });
            skipped.push({ providerId: entry.providerId, reason: `Invalid ${entry.envKey}` });
            continue;
          }
          result = await probeCohere(entry, apiKey as string);
          break;
        case 'azure-openai':
          if (!entry.envKey || !rawKey) {
            skipped.push({ providerId: entry.providerId, reason: `Missing ${entry.envKey}` });
            continue;
          }
          if (!apiKey) {
            log('warn', 'Invalid probe key', { providerId: entry.providerId, envKey: entry.envKey, ...describeKey(rawKey) });
            skipped.push({ providerId: entry.providerId, reason: `Invalid ${entry.envKey}` });
            continue;
          }
          result = await probeAzureOpenAI(entry, apiKey as string);
          break;
        case 'bedrock':
          try {
            const resolvedModel = resolveModel(entry);
            if (regionOverride && requiresInferenceProfile(resolvedModel) && regionOverride !== 'us-east') {
              skipped.push({
                providerId: entry.providerId,
                reason: `Bedrock requires inference profile in ${regionOverride}`,
              });
              continue;
            }
            const awsRegionOverride = resolveBedrockRegionOverride(regionOverride);
            result = await probeBedrock(entry, awsRegionOverride);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            if (/credential|accessdenied|unrecognizedclient/i.test(message)) {
              skipped.push({ providerId: entry.providerId, reason: `AWS credentials not available` });
              continue;
            }
            throw error;
          }
          break;
        default:
          skipped.push({ providerId: entry.providerId, reason: `Unsupported type ${entry.type}` });
          continue;
      }

      if (result?.event) {
        if (eventRegion) {
          result.event.region = eventRegion;
        }
        events.push(result.event);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      failures.push({ providerId: entry.providerId, error: message });
      const event = buildEvent(entry, config.monitoring.defaultTimeout || DEFAULT_TIMEOUT_MS);
      if (eventRegion) {
        event.region = eventRegion;
      }
      event.errorCode = classifyProbeError(error);
      events.push(event);
    }
  }

  return { events, skipped, failures };
}
