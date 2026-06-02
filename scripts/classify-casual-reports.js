#!/usr/bin/env node

const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function normalizeEnvValue(value) {
  let output = value;
  for (let i = 0; i < 4; i += 1) {
    const trimmed = output.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      output = trimmed.slice(1, -1);
      continue;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('-----BEGIN')) break;
    if (trimmed.includes('\\')) {
      try {
        output = JSON.parse(`"${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
        continue;
      } catch {
        break;
      }
    }
    break;
  }
  return output;
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      const normalized = normalizeEnvValue(value);
      process.env[key] =
        key === 'FIREBASE_SERVICE_ACCOUNT_KEY' ? normalized : normalized.replace(/\\n/g, '\n');
    }
  });
}

function parseServiceAccountKey(rawValue) {
  let value = rawValue;
  for (let i = 0; i < 6; i += 1) {
    if (typeof value !== 'string') break;
    const trimmed = value.trim();
    if (trimmed.startsWith('{')) return JSON.parse(trimmed);
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      value = trimmed.slice(1, -1);
      continue;
    }
    if (trimmed.includes('\\')) {
      try {
        value = JSON.parse(`"${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
        continue;
      } catch {
        break;
      }
    }
    break;
  }
  throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format');
}

async function initFirebase() {
  loadEnvFile(path.resolve(process.cwd(), '.env.production.local'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!serviceAccountKey && (!privateKey || !clientEmail || !projectId)) {
    throw new Error(
      'Firebase credentials missing. Provide FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL + FIREBASE_PROJECT_ID.'
    );
  }

  if (!admin.apps.length) {
    if (serviceAccountKey) {
      admin.initializeApp({ credential: admin.credential.cert(parseServiceAccountKey(serviceAccountKey)) });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
    }
  }

  return admin.firestore();
}

function hashToken(value) {
  const salt = process.env.TELEMETRY_SALT || 'ai-status-dashboard';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

function csvEnv(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getCurrentCurlFingerprint() {
  try {
    const ip = execSync('curl -s https://api.ipify.org', { encoding: 'utf8' }).trim();
    const versionLine = execSync('curl --version | head -n1', { encoding: 'utf8' }).trim();
    const version = versionLine.split(/\s+/)[1];
    if (!ip || !version) return null;
    return {
      ip,
      userAgent: `curl/${version}`,
      clientHash: hashToken(`${ip}:curl/${version}`),
    };
  } catch {
    return null;
  }
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function classifyByFixtureShape(data, duplicateCount) {
  return (
    duplicateCount >= 3 &&
    data.appId === 'chatgpt' &&
    data.surface === 'text' &&
    data.issue === true &&
    !data.issueType &&
    (!data.region || data.region === 'global')
  );
}

async function main() {
  const db = await initFirebase();
  const days = Number.parseInt(process.argv[2] || '7', 10) || 7;
  const apply = process.argv.includes('--apply');
  const since = admin.firestore.Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const snapshot = await db.collection('casual_reports').where('createdAt', '>=', since).orderBy('createdAt', 'asc').get();

  const currentCurl = getCurrentCurlFingerprint();
  const selfTestClientHashes = new Set(csvEnv('KNOWN_SELF_TEST_CLIENT_HASHES'));
  if (currentCurl?.clientHash) selfTestClientHashes.add(currentCurl.clientHash);

  const selfTestIpPrefixes = new Set(['176.100.0.0/16', ...csvEnv('KNOWN_SELF_TEST_IP_PREFIXES')]);
  const botUserAgentHashes = new Set(
    [
      'GPTBot/1.0',
      'ClaudeBot/1.0',
      'PerplexityBot/1.0',
      'anthropic-ai',
      'CCBot/2.0',
    ].map(hashToken)
  );
  for (const ua of csvEnv('KNOWN_BOT_USER_AGENTS')) {
    botUserAgentHashes.add(hashToken(ua));
  }

  const duplicateTriples = new Map();
  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
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

  const updates = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    const triple = `${data.clientHash || 'unknown'}|${data.appId || 'unknown'}|${data.surface || 'unknown'}|${String(data.issue)}`;
    let classification = data.classification || 'indeterminate';
    let isSelfTest = data.isSelfTest === true;

    if (isSelfTest || classification === 'self_test') {
      classification = 'self_test';
      isSelfTest = true;
    } else if (data.clientHash && selfTestClientHashes.has(data.clientHash)) {
      classification = 'self_test';
      isSelfTest = true;
    } else if (data.ipPrefix && selfTestIpPrefixes.has(data.ipPrefix)) {
      classification = 'self_test';
      isSelfTest = true;
    } else if (classifyByFixtureShape(data, duplicateTriples.get(triple) || 0)) {
      classification = 'self_test';
      isSelfTest = true;
    } else if (data.userAgentHash && botUserAgentHashes.has(data.userAgentHash)) {
      classification = 'bot_or_automation';
    } else if ((duplicateTriples.get(triple) || 0) >= 3) {
      classification = 'bot_or_automation';
    } else {
      classification = 'indeterminate';
      isSelfTest = false;
    }

    increment(summary, classification);

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
      updates.push({ id: doc.id, next });
    }
  });

  if (apply && updates.length) {
    while (updates.length) {
      const batch = db.batch();
      for (const item of updates.splice(0, 400)) {
        batch.update(db.collection('casual_reports').doc(item.id), item.next);
        summary.updated += 1;
      }
      await batch.commit();
    }
  }

  console.log(
    JSON.stringify(
      {
        window_days: days,
        total_records: summary.total,
        self_test: summary.self_test,
        verified_external: summary.verified_external,
        bot_or_automation: summary.bot_or_automation,
        indeterminate: summary.indeterminate,
        updated: summary.updated,
        derived_current_curl: currentCurl
          ? { ip: currentCurl.ip, userAgent: currentCurl.userAgent, clientHash: currentCurl.clientHash }
          : null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
