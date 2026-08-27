import { persistenceService } from '@/lib/services/persistence';
import { subscriptionService } from '@/lib/services/subscriptions';
import { getDb } from '@/lib/db/firestore';

jest.mock('@/lib/db/firestore', () => ({
    getDb: jest.fn(),
}));

describe('Advanced Services', () => {
    let mockDb: any;
    let mockCollection: any;
    let mockDoc: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDoc = {
            get: jest.fn(),
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };
        mockCollection = {
            doc: jest.fn(() => mockDoc),
            add: jest.fn(),
            where: jest.fn(() => mockCollection),
            orderBy: jest.fn(() => mockCollection),
            limit: jest.fn(() => mockCollection),
            get: jest.fn(),
        };
        mockDb = {
            collection: jest.fn(() => mockCollection),
        };
        (getDb as jest.Mock).mockReturnValue(mockDb);
    });

    describe('PersistenceService', () => {
        it('should save status results', async () => {
            const result = { id: 'openai', name: 'OpenAI', status: 'operational' as const, responseTime: 100, lastChecked: new Date().toISOString() };
            await persistenceService.saveStatus(result);
            expect(mockCollection.add).toHaveBeenCalled();
        });

        it('should fetch history', async () => {
            mockCollection.get.mockResolvedValue({
                docs: [{ data: () => ({ status: 'operational', checkedAt: { toDate: () => new Date() }, id: 'openai', name: 'OpenAI', responseTime: 100 }) }]
            });
            const history = await persistenceService.getHistory({ providerId: 'openai' });
            expect(history).toBeDefined();
            expect(history.length).toBe(1);
        });
    });


    describe('SubscriptionService', () => {
        it('should create a new subscription', async () => {
            mockDoc.get.mockResolvedValue({ exists: false });
            const result = await subscriptionService.subscribe('test@example.com', ['openai']);
            expect(result.success).toBe(true);
            expect(mockDoc.set).toHaveBeenCalled();
        });

        it('should confirm a subscription', async () => {
            mockCollection.get.mockResolvedValue({
                empty: false,
                docs: [{
                    data: () => ({ confirmationTokenExpiry: new Date(Date.now() + 100000) }),
                    ref: mockDoc
                }]
            });
            const result = await subscriptionService.confirm('token');
            expect(result.success).toBe(true);
            expect(mockDoc.update).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true }));
        });
    });
});
