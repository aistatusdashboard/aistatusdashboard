export type EmailTemplateId = 'confirmation' | 'status_change';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderEmailTemplate(
  template: string,
  data: Record<string, any>
): { subject: string; html: string; text: string } | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const safeSiteUrl = escapeHtml(siteUrl);

  const shell = (title: string, body: string, footer: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.55;color:#111;">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
      <div style="background:#fff;border:1px solid #e6e8ef;border-radius:14px;padding:26px 24px;">
        ${body}
      </div>
      <p style="margin:18px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
        ${footer}
      </p>
    </div>
  </body>
</html>`;

  if (template === 'confirmation') {
    const link = typeof data.link === 'string' ? data.link : `${siteUrl}/`;
    const safeLink = escapeHtml(link);
    const apps = Array.isArray(data.apps) ? (data.apps as unknown[]).map(String).filter(Boolean) : [];
    const listed = apps.length === 0 ? 'your AI apps' : apps.length <= 3 ? joinNames(apps) : `${apps.length} AI apps`;
    const subject = apps.length === 1 ? `Confirm your ${apps[0]} alerts` : 'Confirm your AI status alerts';

    const html = shell(
      subject,
      `<h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;">One click and you're set</h1>
      <p style="margin:0 0 18px;font-size:16px;color:#374151;">
        You asked to be emailed when <strong>${escapeHtml(listed)}</strong> is having problems — and when it's back.
        Confirm your address to switch the alerts on.
      </p>
      <p style="margin:0 0 22px;">
        <a href="${safeLink}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-weight:600;padding:13px 20px;border-radius:10px;">
          Turn on alerts
        </a>
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        Didn't sign up? Ignore this and nothing happens. The link works for 7 days.
      </p>`,
      `Sent because someone entered this address at <a href="${safeSiteUrl}" style="color:#6b7280;">${safeSiteUrl.replace(/^https?:\/\//, '')}</a>.
       If the button doesn't work, paste this into your browser:<br />${safeLink}`
    );
    const text = [
      `One click and you're set.`,
      ``,
      `You asked to be emailed when ${listed} is having problems — and when it's back.`,
      `Confirm your address to switch the alerts on:`,
      link,
      ``,
      `Didn't sign up? Ignore this and nothing happens. The link works for 7 days.`,
      `— ${siteUrl}`,
    ].join('\n');
    return { subject, html, text };
  }

  if (template === 'status_change') {
    const providerName = typeof data.providerName === 'string' ? data.providerName : 'A provider';
    const currentStatus = typeof data.currentStatus === 'string' ? data.currentStatus : 'changed';
    const appUrl = typeof data.appUrl === 'string' && data.appUrl ? data.appUrl : siteUrl;
    const unsubscribeUrl = typeof data.unsubscribeUrl === 'string' ? data.unsubscribeUrl : '';
    const safeAppUrl = escapeHtml(appUrl);
    const safeUnsub = escapeHtml(unsubscribeUrl);
    const safeName = escapeHtml(providerName);

    const phrase = statusPhrase(currentStatus);
    const subject = `${providerName} ${phrase.subject}`;
    const html = shell(
      subject,
      `<p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${phrase.color};font-weight:700;">${escapeHtml(phrase.label)}</p>
      <h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;">${safeName} ${escapeHtml(phrase.subject)}</h1>
      <p style="margin:0 0 18px;font-size:16px;color:#374151;">${escapeHtml(phrase.body(providerName))}</p>
      <p style="margin:0 0 6px;">
        <a href="${safeAppUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:10px;">
          See what's affected
        </a>
      </p>`,
      `You're getting this because you asked for ${safeName} alerts at <a href="${safeSiteUrl}" style="color:#6b7280;">${safeSiteUrl.replace(/^https?:\/\//, '')}</a>.
       ${unsubscribeUrl ? `<a href="${safeUnsub}" style="color:#6b7280;">Unsubscribe</a> in one click.` : ''}`
    );
    const text = [
      `${providerName} ${phrase.subject}`,
      ``,
      phrase.body(providerName),
      `See what's affected: ${appUrl}`,
      ``,
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : '',
    ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
    return { subject, html, text };
  }

  return null;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function statusPhrase(status: string): {
  label: string;
  subject: string;
  color: string;
  body: (name: string) => string;
} {
  switch (status) {
    case 'down':
    case 'major_outage':
      return {
        label: 'Outage',
        subject: 'is down',
        color: '#b3261e',
        body: (name) => `${name} is having a real outage right now, not just a slow moment. It is probably not you. We'll email again when it's back.`,
      };
    case 'degraded':
    case 'partial_outage':
      return {
        label: 'Having issues',
        subject: 'is having issues',
        color: '#8a6d00',
        body: (name) => `${name} is partly broken — some things may fail or feel slow. It is probably not you. We'll email again when it's back to normal.`,
      };
    case 'maintenance':
      return {
        label: 'Maintenance',
        subject: 'is in maintenance',
        color: '#8a6d00',
        body: (name) => `${name} is doing planned maintenance, so some features may be off for a while.`,
      };
    default:
      return {
        label: 'Back to normal',
        subject: 'is back up',
        color: '#0a7d46',
        body: (name) => `${name} is working normally again. If it still misbehaves for you, a refresh or a new chat usually clears it.`,
      };
  }
}
