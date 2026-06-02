import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import { config } from '@/lib/config';

type CasualReportClassification =
  | 'self_test'
  | 'verified_external'
  | 'bot_or_automation'
  | 'indeterminate';

type ClassifyOptions = {
  days?: number;
  knownSelfTestIpPrefixes?: string[];
  knownSelfTestFingerprints?: Array<{ ip: string; userAgent: string }>;
  knownBotUserAgents?: string[];
};

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

export async function classifyRecentCasualReports(options: ClassifyOptions = {}) {
  const db = getDb();
  const days = Number.isFinite(options.days) ? Math.max(1, Number(options.days)) : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const knownSelfTestClientHashes = new Set(
    (options.knownSelfTestFingerprints || []).map((item) => hashToken(`${item.ip}:${item.userAgent}`))
  );
  const knownSelfTestIpPrefixes = new Set(['176.100.0.0/16', ...(options.knownSelfTestIpPrefixes || [])]);
  const knownBotUserAgentHashes = new Set(
    (options.knownBotUserAgents || ['GPTBot/1.0', 'ClaudeBot/1.0', 'PerplexityBot/1.0']).map(hashToken)
  );

  const snapshot = await db
    .collection('casual_reports')
    .where('createdAt', '>=', Timestamp.fromDate(since))
    .orderBy('createdAt', 'desc')
    .get();

  const duplicateTriples = new Map<string, number>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data() as Record<string, any>;
    const triple = `${data.clientHash || 'unknown'}|${data.appId || 'unknown'}|${data.surface || 'unknown'}|${String(data.issue)}`;
    duplicateTriples.set(triple, (duplicateTriples.get(triple) || 0) + 1);
  });

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

    summary[classification] += 1;

    const next = {
      classification,
      isSelfTest,
      ipPrefix: data.ipPrefix || 'unknown',
      userAgentHash: data.userAgentHash || null,
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
