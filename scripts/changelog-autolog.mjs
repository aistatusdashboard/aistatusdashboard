#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const changelogJsonPath = path.join(repoRoot, 'public', 'changelog.json');
const changelogMdPath = path.join(repoRoot, 'docs', 'changelog.md');

const sha = process.env.DEPLOY_SHA || '';
const subjectRaw = process.env.DEPLOY_SUBJECT || 'Automated deploy';
const cleanSubject = subjectRaw.split('\n')[0].trim();
const shortSha = sha ? sha.slice(0, 7) : '';
const now = new Date();
const day = now.toISOString().slice(0, 10);
const title = shortSha ? `Deploy: ${cleanSubject} (${shortSha})` : `Deploy: ${cleanSubject}`;
const summary = 'Automated changelog entry generated from a successful production deploy workflow.';
const link = sha ? `https://github.com/aistatusdashboard/aistatusdashboard/commit/${sha}` : undefined;

const raw = await fs.readFile(changelogJsonPath, 'utf8');
const payload = JSON.parse(raw);
payload.entries = Array.isArray(payload.entries) ? payload.entries : [];

if (!payload.entries.some((entry) => String(entry.title || '') === title)) {
  payload.entries.unshift({
    date: day,
    title,
    summary,
    ...(link ? { link } : {}),
  });
  payload.generated_at = now.toISOString();
  await fs.writeFile(changelogJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

let md = await fs.readFile(changelogMdPath, 'utf8');
const marker = `- ${title}`;
if (!md.includes(marker)) {
  const sectionHeader = `## ${day}`;
  if (md.includes(sectionHeader)) {
    md = md.replace(sectionHeader, `${sectionHeader}\n- ${title}`);
  } else {
    md = md.replace('# Changelog\n', `# Changelog\n\n${sectionHeader}\n- ${title}\n`);
  }
  await fs.writeFile(changelogMdPath, md, 'utf8');
}
