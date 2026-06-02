import { summarizeCasualReports } from '@/lib/services/casual-report-maintenance';

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
});
