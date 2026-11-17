/** @jest-environment node */
import { summarizePulse } from '@/lib/services/live-pulse';

const at = (iso: string, status: string, activeIncidentCount = 0) => ({ providerId: status + iso, status, lastUpdated: iso, activeIncidentCount });

describe('live pulse', () => {
  it('reports the most recent time any official status was read', () => {
    const pulse = summarizePulse([at('2026-11-17T10:00:00.000Z', 'operational'), at('2026-11-17T10:05:00.000Z', 'operational')]);
    expect(pulse).toEqual({ status: 'operational', lastUpdated: '2026-11-17T10:05:00.000Z' });
  });

  it('keeps the old precedence: open incident, then down, degraded, maintenance, operational', () => {
    const t = '2026-11-17T10:00:00.000Z';
    expect(summarizePulse([at(t, 'operational', 1), at(t, 'major_outage')]).status).toBe('degraded');
    expect(summarizePulse([at(t, 'operational'), at(t, 'major_outage')]).status).toBe('down');
    expect(summarizePulse([at(t, 'operational'), at(t, 'partial_outage')]).status).toBe('degraded');
    expect(summarizePulse([at(t, 'operational'), at(t, 'maintenance')]).status).toBe('maintenance');
    expect(summarizePulse([at(t, 'unknown')]).status).toBe('unknown');
    expect(summarizePulse([])).toEqual({ status: 'unknown', lastUpdated: null });
  });
});
