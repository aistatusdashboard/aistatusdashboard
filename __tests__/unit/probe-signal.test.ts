import { isOutageEvidence, isProbeMisconfiguration, isUnverifiable } from '@/lib/services/probe-signal';

// The three classes must be disjoint: a failure is the provider's, ours, or
// says nothing — never two of those at once, and never silently none.
describe('probe failure classification', () => {
  const cases: Array<[string | undefined, 'outage' | 'ours' | 'neutral' | 'ok']> = [
    [undefined, 'ok'],
    ['http-500', 'outage'],
    ['http-503', 'outage'],
    ['timeout', 'outage'],
    ['network', 'outage'],
    ['dns', 'outage'],
    ['semantic_mismatch', 'outage'],
    ['http-400', 'ours'], // Anthropic: credit balance too low
    ['http-401', 'ours'],
    ['http-403', 'ours'],
    ['http-404', 'ours'], // our URL is wrong
    ['http-429', 'ours'], // Mistral: rate-limited key
    ['bot_wall', 'neutral'],
  ];

  it.each(cases)('%s → %s', (code, expected) => {
    const got = !code
      ? 'ok'
      : isOutageEvidence(code)
        ? 'outage'
        : isProbeMisconfiguration(code)
          ? 'ours'
          : isUnverifiable(code)
            ? 'neutral'
            : 'UNCLASSIFIED';
    expect(got).toBe(expected);
  });

  it('classes never overlap', () => {
    for (const [code] of cases) {
      if (!code) continue;
      const hits = [isOutageEvidence(code), isProbeMisconfiguration(code), isUnverifiable(code)].filter(Boolean).length;
      expect(hits).toBe(1);
    }
  });
});
