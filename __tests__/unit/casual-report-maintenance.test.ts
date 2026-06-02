import crypto from 'crypto';
import { config } from '@/lib/config';
import { summarizeCasualReports } from '@/lib/services/casual-report-maintenance';

function hashToken(value: string) {
  const salt = config.insights.telemetrySalt || 'ai-status-dashboard';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

describe('summarizeCasualReports', () => {
  it('excludes legacy self-test fixture rows from filtered public counts', () => {
    const reports = [
      { appId: 'chatgpt', surface: 'text', issue: true, issueType: null, region: 'global' },
      { appId: 'chatgpt', surface: 'text', issue: true, issueType: null, region: 'global' },
      { appId: 'chatgpt', surface: 'text', issue: true, issueType: null, region: 'global' },
      { appId: 'claude', surface: 'text', issue: true, issueType: 'latency', region: 'US' },
    ];

    const summary = summarizeCasualReports(reports);

    expect(summary.total).toBe(4);
    expect(summary.self_test).toBe(3);
    expect(summary.filtered).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.issueReportsRaw).toBe(4);
    expect(summary.issueReportsFiltered).toBe(1);
  });

  it('treats known internal automation user agents as self-test', () => {
    const summary = summarizeCasualReports([
      {
        appId: 'chatgpt',
        surface: 'text',
        issue: true,
        issueType: null,
        region: 'global',
        userAgentHash: hashToken('curl/8.5.0'),
      },
    ]);

    expect(summary.total).toBe(1);
    expect(summary.self_test).toBe(1);
    expect(summary.filtered).toBe(0);
    expect(summary.pending).toBe(0);
  });
});
