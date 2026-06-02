jest.mock('@/lib/db/firestore', () => {
  const add = jest.fn(async () => ({ id: 'report-1' }));
  const create = jest.fn(async () => undefined);

  return {
    __esModule: true,
    getDb: jest.fn(() => ({
      collection: jest.fn((name: string) => {
        if (name === 'casual_report_locks') {
          return {
            doc: jest.fn(() => ({ create })),
          };
        }
        if (name === 'casual_reports') {
          return { add };
        }
        return {};
      }),
    })),
    __mocks: { add, create },
  };
});

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  },
  Timestamp: {
    fromDate: jest.fn((value: Date) => value),
  },
}));

import { submitCasualReport } from '@/lib/services/casual';
const firestoreModule = require('@/lib/db/firestore');

describe('submitCasualReport classification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores self-test classification when the header is present', async () => {
    const headers = new Headers({
      'x-forwarded-for': '176.100.43.12',
      'user-agent': 'curl/8.5.0',
      'x-aistatus-selftest': '1',
    });

    const result = await submitCasualReport({
      appId: 'chatgpt',
      surface: 'text',
      issue: true,
      headers,
    });

    expect(result.ok).toBe(true);
    expect(firestoreModule.__mocks.add).toHaveBeenCalledTimes(1);
    expect(firestoreModule.__mocks.add).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'chatgpt',
        surface: 'text',
        issue: true,
        clientHash: expect.any(String),
        userAgentHash: expect.any(String),
        ipPrefix: '176.100.0.0/16',
        isSelfTest: true,
        classification: 'self_test',
        createdAt: 'SERVER_TIMESTAMP',
      })
    );
  });

  it('defaults to indeterminate and non-self-test without the header', async () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.9',
      'user-agent': 'Mozilla/5.0',
    });

    const result = await submitCasualReport({
      appId: 'chatgpt',
      surface: 'text',
      issue: true,
      headers,
    });

    expect(result.ok).toBe(true);
    expect(firestoreModule.__mocks.add).toHaveBeenCalledWith(
      expect.objectContaining({
        ipPrefix: '203.0.0.0/16',
        isSelfTest: false,
        classification: 'indeterminate',
      })
    );
  });
});
