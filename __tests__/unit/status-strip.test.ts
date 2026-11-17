/** @jest-environment node */
import { buildStrip, levelForDay, levelForOfficial, STRIP_DAYS } from '@/lib/services/status-strip';

describe('status strip', () => {
  it('records the same word the app page shows for the provider\'s status', () => {
    const now = Date.parse('2026-11-17T10:00:00Z');
    const fresh = now - 5 * 60 * 1000;
    expect(levelForOfficial('operational', fresh, now)).toBe('up');
    // The page treats scheduled maintenance as up, so the bar does too.
    expect(levelForOfficial('maintenance', fresh, now)).toBe('up');
    expect(levelForOfficial('degraded', fresh, now)).toBe('wobbly');
    expect(levelForOfficial('partial_outage', fresh, now)).toBe('wobbly');
    expect(levelForOfficial('major_outage', fresh, now)).toBe('down');
    expect(levelForOfficial('unknown', fresh, now)).toBe('unknown');
    // A status we have not managed to re-read for two hours is not a reading.
    expect(levelForOfficial('operational', now - 3 * 60 * 60 * 1000, now)).toBe('unknown');
    expect(levelForOfficial('operational', NaN, now)).toBe('unknown');
  });

  it('colours a day by the worst status the provider reported', () => {
    expect(levelForDay({ up: 280, wobbly: 6, down: 2 })).toBe('down');
    expect(levelForDay({ up: 280, wobbly: 6 })).toBe('wobbly');
    expect(levelForDay({ up: 288 })).toBe('up');
  });

  it('never colours a day from failed reads alone', () => {
    expect(levelForDay({ unknown: 40 })).toBe('nodata');
    expect(levelForDay(undefined)).toBe('nodata');
    // Unknown readings alongside real ones are ignored, not treated as trouble.
    expect(levelForDay({ up: 200, unknown: 88 })).toBe('up');
  });

  it('returns 30 days oldest-first, with gaps as no data and minutes from 5-minute samples', () => {
    const now = new Date('2026-11-17T10:00:00Z');
    const strip = buildStrip(
      { days: { '2026-11-17': { openai: { up: 100, wobbly: 3 } }, '2026-11-15': { openai: { down: 2, up: 286 } }, '2026-11-16': { anthropic: { up: 288 } } } },
      'openai',
      now
    );
    expect(strip).toHaveLength(STRIP_DAYS);
    expect(strip[0].date).toBe('2026-10-19');
    expect(strip[STRIP_DAYS - 1]).toEqual({ date: '2026-11-17', level: 'wobbly', wobblyMinutes: 15, downMinutes: 0 });
    expect(strip[STRIP_DAYS - 2].level).toBe('nodata');
    expect(strip[STRIP_DAYS - 3]).toMatchObject({ date: '2026-11-15', level: 'down', downMinutes: 10 });
  });
});
