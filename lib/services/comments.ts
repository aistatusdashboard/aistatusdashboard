import { getDb } from '@/lib/db/firestore';
import { log } from '@/lib/utils/logger';

export interface Comment {
    id: string;
    author: string;
    content: string; // Map to message for frontend
    provider?: string | null;
    createdAt: string;
    approved: boolean;
    ip?: string;
    sessionId?: string;
    likes?: number;
    // Legacy support fields for frontend compatibility
    message?: string;
    type?: string;
    status?: string;
    replies?: Comment[];
}

export class CommentService {
    private readonly COLLECTION = 'comments';
    private toDate(value: any): Date | null {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value?.toDate === 'function') return value.toDate();
        if (typeof value === 'string') {
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        return null;
    }

    async getComments(options: {
        limit?: number;
        offset?: number;
        providerId?: string;
        sessionId?: string;
    } = {}): Promise<Comment[]> {
        try {
            const db = getDb();
            const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 50);
            const offset = Math.min(Math.max(Number(options.offset) || 0, 0), 200);

            const providerId =
                typeof options.providerId === 'string' && options.providerId.trim().length > 0
                    ? options.providerId.trim()
                    : undefined;
            const sessionId =
                typeof options.sessionId === 'string' && options.sessionId.trim().length > 0
                    ? options.sessionId.trim()
                    : undefined;

            const fetchCount = Math.min(limit + offset, 250);

            const approvedQuery = (() => {
                let q: FirebaseFirestore.Query = db
                    .collection(this.COLLECTION)
                    .where('approved', '==', true);
                if (providerId) q = q.where('provider', '==', providerId);
                return q.orderBy('createdAt', 'desc').limit(fetchCount);
            })();

            const pendingQuery = (() => {
                if (!sessionId) return null;
                let q: FirebaseFirestore.Query = db
                    .collection(this.COLLECTION)
                    .where('approved', '==', false)
                    .where('sessionId', '==', sessionId);
                if (providerId) q = q.where('provider', '==', providerId);
                return q.orderBy('createdAt', 'desc').limit(fetchCount);
            })();

            const [approvedSnap, pendingSnap] = await Promise.all([
                approvedQuery.get(),
                pendingQuery ? pendingQuery.get() : Promise.resolve(null),
            ]);

            const docs = [
                ...approvedSnap.docs,
                ...(pendingSnap?.docs || []),
            ];

            const mapDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot): Comment => {
                const data = doc.data();
                const createdAt =
                    typeof data.createdAt?.toDate === 'function'
                        ? data.createdAt.toDate()
                        : typeof data.createdAt === 'string'
                          ? new Date(data.createdAt)
                          : data.createdAt instanceof Date
                            ? data.createdAt
                            : new Date();

                return {
                    id: doc.id,
                    author: data.author,
                    content: data.content,
                    provider: data.provider,
                    createdAt: createdAt.toISOString(),
                    approved: Boolean(data.approved),
                    likes: data.likes || 0,
                    sessionId: data.sessionId,
                    type: data.type,
                    status: data.approved ? 'approved' : 'pending',
                };
            };

            const unique = new Map<string, Comment>();
            docs.forEach((d) => unique.set(d.id, mapDoc(d)));

            return [...unique.values()]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(offset, offset + limit);
        } catch (error: any) {
            if (error.code === 9 || error.message?.includes('index')) {
                log('warn', 'Index required for comments query, falling back to simple query');
                try {
                    const db = getDb();
                    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 50);
                    const offset = Math.min(Math.max(Number(options.offset) || 0, 0), 200);
                    const providerId =
                        typeof options.providerId === 'string' && options.providerId.trim().length > 0
                            ? options.providerId.trim()
                            : undefined;
                    const sessionId =
                        typeof options.sessionId === 'string' && options.sessionId.trim().length > 0
                            ? options.sessionId.trim()
                            : undefined;

                    const fetchCount = Math.min(limit + offset, 250);

                    const approvedQuery = (() => {
                        let q: FirebaseFirestore.Query = db
                            .collection(this.COLLECTION)
                            .where('approved', '==', true);
                        if (providerId) q = q.where('provider', '==', providerId);
                        return q.limit(fetchCount);
                    })();

                    const pendingQuery = (() => {
                        if (!sessionId) return null;
                        let q: FirebaseFirestore.Query = db
                            .collection(this.COLLECTION)
                            .where('approved', '==', false)
                            .where('sessionId', '==', sessionId);
                        if (providerId) q = q.where('provider', '==', providerId);
                        return q.limit(fetchCount);
                    })();

                    const [approvedSnap, pendingSnap] = await Promise.all([
                        approvedQuery.get(),
                        pendingQuery ? pendingQuery.get() : Promise.resolve(null),
                    ]);

                    const docs = [
                        ...approvedSnap.docs,
                        ...(pendingSnap?.docs || []),
                    ];

                    const mapDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot): Comment => {
                        const data = doc.data();
                        const createdAt =
                            typeof data.createdAt?.toDate === 'function'
                                ? data.createdAt.toDate()
                                : typeof data.createdAt === 'string'
                                  ? new Date(data.createdAt)
                                  : data.createdAt instanceof Date
                                    ? data.createdAt
                                    : new Date();

                        return {
                            id: doc.id,
                            author: data.author,
                            content: data.content,
                            provider: data.provider,
                            createdAt: createdAt.toISOString(),
                            approved: Boolean(data.approved),
                            likes: data.likes || 0,
                            sessionId: data.sessionId,
                            type: data.type,
                            status: data.approved ? 'approved' : 'pending',
                        };
                    };

                    const unique = new Map<string, Comment>();
                    docs.forEach((d) => unique.set(d.id, mapDoc(d)));

                    return [...unique.values()]
                        .sort(
                            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                        )
                        .slice(offset, offset + limit);
                } catch (innerError) {
                    log('error', 'Fallback comments query failed', { innerError });
                }
            }
            log('error', 'Failed to get comments', { error });
            return [];
        }
    }

    async createComment(data: {
        author: string;
        content: string;
        provider?: string;
        ip?: string;
        sessionId?: string;
        type?: string;
    }): Promise<{ id: string } | null> {
        try {
            const db = getDb();
            const docRef = await db.collection(this.COLLECTION).add({
                author: data.author.substring(0, 50),
                content: data.content.substring(0, 500),
                provider: data.provider || null,
                ip: data.ip || 'unknown',
                sessionId: data.sessionId || null,
                type: typeof data.type === 'string' ? data.type.substring(0, 20) : 'general',
                createdAt: new Date(),
                approved: false, // Moderation required
                likes: 0
            });
            return { id: docRef.id };
        } catch (error) {
            log('error', 'Failed to create comment', { error });
            return null;
        }
    }

    async countApprovedSince(since: Date): Promise<number> {
        try {
            const db = getDb();
            const snapshot = await db
                .collection(this.COLLECTION)
                .where('approved', '==', true)
                .where('createdAt', '>=', since)
                .get();
            return snapshot.size;
        } catch (error: any) {
            if (error.code === 9 || error.message?.includes('index')) {
                log('warn', 'Index required for comments count, falling back to scan');
                try {
                    const db = getDb();
                    const snapshot = await db.collection(this.COLLECTION).where('approved', '==', true).get();
                    let count = 0;
                    snapshot.docs.forEach((doc) => {
                        const createdAt = this.toDate(doc.data().createdAt);
                        if (createdAt && createdAt >= since) count += 1;
                    });
                    return count;
                } catch (innerError) {
                    log('error', 'Fallback comments count failed', { innerError });
                }
            }
            log('error', 'Failed to count approved comments', { error });
            return 0;
        }
    }
}

export const commentService = new CommentService();
