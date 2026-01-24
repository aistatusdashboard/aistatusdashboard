#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
    if (trimmed.startsWith('{') || trimmed.startsWith('-----BEGIN')) {
      break;
    }
    if (trimmed.includes('\\')) {
      try {
        output = JSON.parse(`"${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
        continue;
      } catch (err) {
        break;
      }
    }
    break;
  }
  return output;
}

function loadEnvFile(filePath) {
  if (!filePath) return;
  if (!fs.existsSync(filePath)) return;
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
        key === 'FIREBASE_SERVICE_ACCOUNT_KEY'
          ? normalized
          : normalized.replace(/\\n/g, '\n');
    }
  });
}

function readArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatRow(row) {
  const providers = row.providers?.length ? row.providers.join(', ') : 'All providers';
  return `${row.email} | ${row.confirmed ? 'confirmed' : 'pending'} | ${row.createdAt || 'unknown'} | ${providers}`;
}

async function initFirebase() {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!serviceAccountKey && (!privateKey || !clientEmail || !projectId)) {
    console.error(
      'Firebase credentials missing. Provide FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL + FIREBASE_PROJECT_ID.'
    );
    process.exit(1);
  }

  if (!admin.apps.length) {
    if (serviceAccountKey) {
      const serviceAccount = parseServiceAccountKey(serviceAccountKey);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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
}

function parseServiceAccountKey(rawValue) {
  let value = rawValue;
  for (let i = 0; i < 6; i += 1) {
    if (typeof value !== 'string') break;
    const trimmed = value.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }
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
      } catch (err) {
        break;
      }
    }
    break;
  }
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    return JSON.parse(value.trim());
  }
  throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format');
}

async function listSignups({ days, limit, status, json }) {
  const db = admin.firestore();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const runQuery = async () => {
    let query = db.collection('emailSubscriptions');
    if (status !== 'all') {
      query = query.where('confirmed', '==', status === 'confirmed');
    }
    query = query.where('createdAt', '>=', since).orderBy('createdAt', 'desc').limit(limit);
    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  };

  let rows = [];
  try {
    rows = await runQuery();
  } catch (error) {
    const msg = error?.message || '';
    if (error?.code === 9 || msg.includes('index')) {
      const snap = await db.collection('emailSubscriptions').limit(500).get();
      rows = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
      rows = rows
        .filter((row) => {
          if (status !== 'all' && Boolean(row.confirmed) !== (status === 'confirmed')) return false;
          const createdAt = toDate(row.createdAt);
          return createdAt ? createdAt >= since : false;
        })
        .sort((a, b) => {
          const aDate = toDate(a.createdAt)?.getTime() || 0;
          const bDate = toDate(b.createdAt)?.getTime() || 0;
          return bDate - aDate;
        })
        .slice(0, limit);
    } else {
      throw error;
    }
  }

  const formatted = rows.map((row) => ({
    email: row.email || row.id,
    providers: Array.isArray(row.providers) ? row.providers : [],
    confirmed: Boolean(row.confirmed),
    active: Boolean(row.active),
    createdAt: toDate(row.createdAt)?.toISOString() || null,
    updatedAt: toDate(row.updatedAt)?.toISOString() || null,
  }));

  if (json) {
    console.log(JSON.stringify(formatted, null, 2));
    return;
  }

  if (formatted.length === 0) {
    console.log('No alert signups found for the selected window.');
    return;
  }

  console.log(`Alert signups (last ${days} days):`);
  formatted.forEach((row) => {
    console.log(formatRow(row));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = readArgValue(args, '--limit');
  const daysArg = readArgValue(args, '--days');
  const status = (readArgValue(args, '--status') || 'all').toLowerCase();
  const envFile =
    readArgValue(args, '--env') || process.env.ENV_FILE || path.resolve(process.cwd(), '.env.local');
  const json = args.includes('--json');

  const limit = limitArg ? Math.max(parseInt(limitArg, 10) || 0, 1) : 25;
  const days = daysArg ? Math.max(parseInt(daysArg, 10) || 0, 1) : 7;

  if (!['all', 'confirmed', 'pending'].includes(status)) {
    console.error('Invalid --status. Use all|confirmed|pending.');
    process.exit(1);
  }

  loadEnvFile(envFile);
  await initFirebase();
  await listSignups({ days, limit, status, json });
}

main().catch((err) => {
  console.error(`Signup list failed: ${err.message}`);
  process.exit(1);
});
