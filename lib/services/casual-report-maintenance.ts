import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import { config } from '@/lib/config';

export type CasualReportClassification =
  | 'self_test'
  | 'verified_external'
  | 'bot_or_automation'
  | 'indeterminate';

type ClassifyOptions = {
  days?: number;
  secondsAgo?: number;
  knownSelfTestIpPrefixes?: string[];
  knownSelfTestFingerprints?: Array<{ ip: string; userAgent: string }>;
  knownBotUserAgents?: string[];
};

type CasualReportRecord = Record<string, any>;

function hashToken(value: string) {
  const salt = config.insights.telemetrySalt || 'ai-status-dashboard';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

function classifyByFixtureShape(data: Record<string, any>, duplicateCount: number) {
  return (
    duplicateCount >= 3 &&
    data.appId === 'chatgpt' &&
    data.surface === 'text' &&
    data.issue === true &&
    !data.issueType &&
    (!data.region || data.region === 'global')
  );
}

function buildDuplicateTriples(records: CasualReportRecord[]) {
  const duplicateTriples = new Map<string, number>();
  records.forEach((data) => {
    const triple = `${data.clientHash || 'unknown'}|${data.appId || 'unknown'}|${data.surface || 'unknown'}|${String(data.issue)}`;
    duplicateTriples.set(triple, (duplicateTriples.get(triple) || 0) + 1);
  });
  return duplicateTriples;
}

function buildKnownSets(options: ClassifyOptions = {}) {
  const knownSelfTestClientHashes = new Set(
    (options.knownSelfTestFingerprints || []).map((item) => hashToken(`${item.ip}:${item.userAgent}`))
  );
  const knownSelfTestIpPrefixes = new Set(['176.100.0.0/16', ...(options.knownSelfTestIpPrefixes || [])]);
  const knownBotUserAgentHashes = new Set(
    (options.knownBotUserAgents || ['GPTBot/1.0', 'ClaudeBot/1.0', 'PerplexityBot/1.0']).map(hashToken)
  );

  return {
    knownSelfTestClientHashes,
    knownSelfTestIpPrefixes,
    knownBotUserAgentHashes,
  };
}

export function classifyStoredCasualReport(
  data: CasualReportRecord,
  duplicateCount: number,
  options: ClassifyOptions = {}
) {
  const { knownSelfTestClientHashes, knownSelfTestIpPrefixes, knownBotUserAgentHashes } = buildKnownSets(options);
  let classification = (data.classification || 'indeterminate') as CasualReportClassification;
  let isSelfTest = data.isSelfTest === true;

  if (classification === 'verified_external') {
    isSelfTest = false;
  } else if (
    isSelfTest ||
    classification === 'self_test' ||
    (data.clientHash && knownSelfTestClientHashes.has(data.clientHash)) ||
    (data.ipPrefix && knownSelfTestIpPrefixes.has(data.ipPrefix)) ||
    classifyByFixtureShape(data, duplicateCount)
  ) {
    classification = 'self_test';
    isSelfTest = true;
  } else if (
    (data.userAgentHash && knownBotUserAgentHashes.has(data.userAgentHash)) ||
    duplicateCount >= 3
  ) {
    classification = 'bot_or_automation';
    isSelfTest = false;
  } else {
    classification = 'indeterminate';
    isSelfTest = false;
  }

  return {
    classification,
    isSelfTest,
    ipPrefix: data.ipPrefix || 'unknown',
    userAgentHash: data.userAgentHash || null,
  };
}

export function summarizeCasualReports(records: CasualReportRecord[], options: ClassifyOptions = {}) {
  const duplicateTriples = buildDuplicateTriples(records);
  const summary = {
    total: records.length,
    filtered: 0,
    pending: 0,
    issueReportsFiltered: 0,
    issueReportsRaw: 0,
    self_test: 0,
    verified_external: 0,
    bot_or_automation: 0,
    indeterminate: 0,
  };

  records.forEach((data) => {
    const triple = `${data.clientHash || 'unknown'}|${data.appId || 'unknown'}|${data.surface || 'unknown'}|${String(data.issue)}`;
    const duplicateCount = duplicateTriples.get(triple) || 0;
    const classified = classifyStoredCasualReport(data, duplicateCount, options);

    summary[classified.classification] += 1;
    if (data.issue === true) {
      summary.issueReportsRaw += 1;
    }
    if (!classified.isSelfTest) {
      summary.filtered += 1;
      if (classified.classification === 'indeterminate') {
        summary.pending += 1;
      }
      if (data.issue === true) {
        summary.issueReportsFiltered += 1;
      }
    }
  });

  return summary;
}

async function loadRecentCasualReportDocs(secondsAgo: number) {
  const db = getDb();
  const since = new Date(Date.now() - secondsAgo * 1000);
  try {
    return await db
      .collection('casual_reports')
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .orderBy('createdAt', 'desc')
      .get();
  } catch (error: any) {
    if (error?.code === 9 || error?.message?.includes('index')) {
      const fallback = await db.collection('casual_reports').limit(5000).get();
      const docs = fallback.docs.filter((doc) => {
        const ts = doc.data()?.createdAt?.toDate?.()?.getTime?.() || 0;
        return ts >= since.getTime();
      });
      return { docs, size: docs.length };
    }
    throw error;
  }
}

export async function summarizeRecentCasualReports(options: ClassifyOptions = {}) {
  const secondsAgo =
    Number.isFinite(options.secondsAgo) && Number(options.secondsAgo) > 0
      ? Number(options.secondsAgo)
      : (Number.isFinite(options.days) ? Math.max(1, Number(options.days)) : 7) * 24 * 60 * 60;
  const snapshot = await loadRecentCasualReportDocs(secondsAgo);
  const records = snapshot.docs.map((doc) => doc.data() as CasualReportRecord);
  return summarizeCasualReports(records, options);
}

export async function classifyRecentCasualReports(options: ClassifyOptions = {}) {
  const db = getDb();
  const days = Number.isFinite(options.days) ? Math.max(1, Number(options.days)) : 7;
  const snapshot = await loadRecentCasualReportDocs(days * 24 * 60 * 60);
  const duplicateTriples = buildDuplicateTriples(snapshot.docs.map((doc) => doc.data() as CasualReportRecord));

  const summary = {
    total: snapshot.size,
    self_test: 0,
    verified_external: 0,
    bot_or_automation: 0,
    indeterminate: 0,
    updated: 0,
  };

  let batch = db.batch();
  let batchCount = 0;
  const sampleRows: Array<{
    id: string;
    appId: string | null;
    surface: string | null;
    issue: boolean;
    classification: CasualReportClassification;
    isSelfTest: boolean;
    createdAt: string | null;
  }> = [];

  for (const doc of snapshot.docs) {
    const data = (doc.data() || {}) as Record<string, any>;
    const triple = `${data.clientHash || 'unknown'}|${data.appId || 'unknown'}|${data.surface || 'unknown'}|${String(data.issue)}`;
    const duplicateCount = duplicateTriples.get(triple) || 0;
    const classified = classifyStoredCasualReport(data, duplicateCount, options);
    const { classification, isSelfTest } = classified;

    summary[classification] += 1;

    const next = {
      classification: classified.classification,
      isSelfTest: classified.isSelfTest,
      ipPrefix: classified.ipPrefix,
      userAgentHash: classified.userAgentHash,
    };

    const changed =
      data.classification !== next.classification ||
      data.isSelfTest !== next.isSelfTest ||
      data.ipPrefix !== next.ipPrefix ||
      data.userAgentHash !== next.userAgentHash;

    if (changed) {
      batch.update(doc.ref, next);
      batchCount += 1;
      summary.updated += 1;
      if (batchCount === 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (sampleRows.length < 10) {
      sampleRows.push({
        id: doc.id.slice(-8),
        appId: data.appId || null,
        surface: data.surface || null,
        issue: data.issue === true,
        classification,
        isSelfTest,
        createdAt:
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : null,
      });
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return {
    windowDays: days,
    ...summary,
    sample: sampleRows,
  };
}
