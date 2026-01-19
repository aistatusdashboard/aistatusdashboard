#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
      process.env[key] = value.replace(/\\n/g, '\n');
    }
  });
}

function readArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function readArgValues(args, name) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
}

function getCreatedAtIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function preview(text, max = 140) {
  if (!text) return '';
  const sanitized = String(text).replace(/\s+/g, ' ').trim();
  return sanitized.length > max ? `${sanitized.slice(0, max - 3)}...` : sanitized;
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
      const serviceAccount = JSON.parse(serviceAccountKey);
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

async function listPending({ providerId, limit, json }) {
  const db = admin.firestore();
  let query = db.collection('comments').where('approved', '==', false);
  if (providerId) query = query.where('provider', '==', providerId);
  const snap = await query.limit(limit).get();

  const rows = snap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      author: data.author || 'Anonymous',
      provider: data.provider || 'global',
      createdAt: getCreatedAtIso(data.createdAt),
      content: data.content || data.message || '',
      status: data.approved ? 'approved' : 'pending',
    };
  });

  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log('No pending comments found.');
    return;
  }

  console.log(`Pending comments (${rows.length}):`);
  rows.forEach((row) => {
    console.log(
      `- ${row.id} | ${row.author} | ${row.provider} | ${row.createdAt || 'unknown'} | ${preview(
        row.content
      )}`
    );
  });
}

async function approveComments(ids, apply) {
  if (!apply) {
    console.error('Refusing to approve without --apply --confirm.');
    process.exit(1);
  }
  const db = admin.firestore();
  const batch = db.batch();
  ids.forEach((id) => {
    const ref = db.collection('comments').doc(id);
    batch.update(ref, { approved: true, updatedAt: new Date() });
  });
  await batch.commit();
  console.log(`Approved ${ids.length} comment(s).`);
}

async function rejectComments(ids, apply) {
  if (!apply) {
    console.error('Refusing to delete without --apply --confirm.');
    process.exit(1);
  }
  const db = admin.firestore();
  const batch = db.batch();
  ids.forEach((id) => {
    const ref = db.collection('comments').doc(id);
    batch.delete(ref);
  });
  await batch.commit();
  console.log(`Deleted ${ids.length} comment(s).`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const confirm = args.includes('--confirm') || args.includes('--yes');
  const providerId = readArgValue(args, '--provider') || null;
  const limitArg = readArgValue(args, '--limit');
  const limit = limitArg ? Math.max(parseInt(limitArg, 10) || 0, 1) : 25;
  const envFile =
    readArgValue(args, '--env') || process.env.ENV_FILE || path.resolve(process.cwd(), '.env.local');
  const json = args.includes('--json');

  const approveIds = readArgValues(args, '--approve');
  const rejectIds = readArgValues(args, '--reject');

  if (apply && !confirm) {
    console.error('Refusing to modify without --confirm (dry-run by default).');
    process.exit(1);
  }

  loadEnvFile(envFile);
  await initFirebase();

  if (approveIds.length > 0) {
    await approveComments(approveIds, apply);
    return;
  }

  if (rejectIds.length > 0) {
    await rejectComments(rejectIds, apply);
    return;
  }

  await listPending({ providerId, limit, json });
  console.log('Tip: approve with --approve <id> --apply --confirm');
}

main().catch((err) => {
  console.error(`Moderation failed: ${err.message}`);
  process.exit(1);
});
