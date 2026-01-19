import { getDb } from '@/lib/db/firestore';
import { log } from '@/lib/utils/logger';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';

interface SubscriptionData {
    email: string;
    providers: string[];
    confirmed: boolean;
    active: boolean;
    confirmationToken?: string | null; // Allow null for type compatibility
    confirmationTokenExpiry?: Date | Timestamp | null;
    createdAt: Date;
    updatedAt: Date;
}

export class SubscriptionService {
    private readonly COLLECTION = 'emailSubscriptions'; // Matches NotificationService usage
    private readonly CONFIRMATION_EXPIRY_HOURS = 24;
    private readonly ADMIN_ALERT_ENV =
        process.env.ALERT_SIGNUP_NOTIFY_EMAIL ||
        process.env.CONTACT_EMAIL ||
        process.env.NEXT_PUBLIC_CONTACT_EMAIL;

    async subscribe(
        email: string,
        providers: string[],
        options: { siteUrl?: string } = {}
    ): Promise<{ success: boolean; message: string }> {
        try {
            const db = getDb();
            const docRef = db.collection(this.COLLECTION).doc(email);
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data() as SubscriptionData;
                if (data.confirmed) {
                    const existingProviders = Array.isArray(data.providers) ? data.providers : [];
                    const nextProviders = [...new Set([...existingProviders, ...providers])];
                    const addedProviders = providers.filter(
                        (provider) => !existingProviders.includes(provider)
                    );

                    await docRef.update({
                        providers: nextProviders,
                        active: true,
                        updatedAt: new Date()
                    });

                    if (addedProviders.length > 0) {
                        await this.queueAdminSignupEmail(email, nextProviders, {
                            status: 'updated',
                            addedProviders,
                            siteUrl: options.siteUrl
                        });
                    }
                    return { success: true, message: 'Subscription updated' };
                } else {
                    return await this.resendConfirmation(email, options);
                }
            }

            const token = this.generateToken();
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + this.CONFIRMATION_EXPIRY_HOURS);

            const subData: SubscriptionData = {
                email,
                providers,
                confirmed: false,
                active: false,
                confirmationToken: token,
                confirmationTokenExpiry: expiry,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await docRef.set(subData);
            await this.sendConfirmationEmail(email, token, options.siteUrl);
            await this.queueAdminSignupEmail(email, providers, {
                status: 'pending_confirmation',
                siteUrl: options.siteUrl
            });

            return { success: true, message: 'Confirmation email sent' };
        } catch (e) {
            log('error', 'Subscribe failed', { error: e, email });
            return { success: false, message: 'Failed to subscribe' };
        }
    }

    async confirm(token: string): Promise<{ success: boolean; message: string }> {
        try {
            const db = getDb();
            const snapshot = await db.collection(this.COLLECTION)
                .where('confirmationToken', '==', token)
                .limit(1)
                .get();

            if (snapshot.empty) return { success: false, message: 'Invalid token' };

            const doc = snapshot.docs[0];
            const data = doc.data() as SubscriptionData;

            const expiry = data.confirmationTokenExpiry;
            const expiryDate =
                expiry instanceof Date
                    ? expiry
                    : expiry instanceof Timestamp
                      ? expiry.toDate()
                      : typeof (expiry as any)?.toDate === 'function'
                        ? (expiry as any).toDate()
                        : null;

            if (expiryDate && new Date() > expiryDate) {
                return { success: false, message: 'Token expired' };
            }

            await doc.ref.update({
                confirmed: true,
                active: true,
                confirmationToken: null,
                confirmationTokenExpiry: null,
                updatedAt: new Date()
            });

            return { success: true, message: 'Email confirmed' };
        } catch (e) {
            log('error', 'Confirmation failed', { error: e });
            return { success: false, message: 'Confirmation failed' };
        }
    }

    async resendConfirmation(
        email: string,
        options: { siteUrl?: string } = {}
    ): Promise<{ success: boolean; message: string }> {
        try {
            const db = getDb();
            const docRef = db.collection(this.COLLECTION).doc(email);
            const doc = await docRef.get();

            if (!doc.exists) return { success: false, message: 'Subscription not found' };

            const data = doc.data() as SubscriptionData;
            if (data.confirmed) return { success: false, message: 'Already confirmed' };

            const token = this.generateToken();
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + this.CONFIRMATION_EXPIRY_HOURS);

            await docRef.update({
                confirmationToken: token,
                confirmationTokenExpiry: expiry,
                updatedAt: new Date()
            });

            await this.sendConfirmationEmail(email, token, options.siteUrl);
            return { success: true, message: 'Confirmation resent' };
        } catch (e) {
            log('error', 'Resend failed', { error: e });
            return { success: false, message: 'Failed to resend' };
        }
    }

    async unsubscribe(email: string): Promise<{ success: boolean; message: string }> {
        try {
            const db = getDb();
            await db.collection(this.COLLECTION).doc(email).delete();
            return { success: true, message: 'Unsubscribed' };
        } catch (e) {
            log('error', 'Unsubscribe failed', { error: e });
            return { success: false, message: 'Failed to unsubscribe' };
        }
    }

    private generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    private escapeHtml(input: string): string {
        return input
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    private async queueAdminSignupEmail(
        email: string,
        providers: string[],
        options: { status: 'pending_confirmation' | 'updated'; addedProviders?: string[]; siteUrl?: string }
    ) {
        try {
            const adminEmail = this.ADMIN_ALERT_ENV;
            if (!adminEmail) return;

            const siteUrl = options.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
            const safeEmail = this.escapeHtml(email);
            const safeProviders = providers.map((p) => this.escapeHtml(p)).join(', ') || 'All providers';
            const safeAdded =
                options.addedProviders && options.addedProviders.length > 0
                    ? options.addedProviders.map((p) => this.escapeHtml(p)).join(', ')
                    : '—';
            const safeStatus = options.status === 'updated' ? 'Updated subscription' : 'New signup';

            const subject = `Alert signup: ${email}`;
            const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${this.escapeHtml(subject)}</title>
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#111;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px;">${safeStatus}</h2>
      <p style="margin:0 0 12px;"><strong>Email:</strong> ${safeEmail}</p>
      <p style="margin:0 0 12px;"><strong>Providers:</strong> ${safeProviders}</p>
      <p style="margin:0 0 12px;"><strong>Added providers:</strong> ${safeAdded}</p>
      <p style="margin:0 0 24px;color:#666;font-size:12px;">
        Submitted from ${this.escapeHtml(siteUrl)}
      </p>
    </div>
  </body>
</html>`;

            const db = getDb();
            await db.collection('emailQueue').add({
                to: adminEmail,
                subject,
                html,
                status: 'pending',
                createdAt: new Date()
            });
        } catch (error) {
            log('error', 'Failed to queue admin signup email', { error });
        }
    }

    private async sendConfirmationEmail(email: string, token: string, siteUrl?: string) {
        const baseUrl = siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const link = `${baseUrl}/api/email/confirm?token=${token}`;

        // Using emailQueue as per previous architecture
        const db = getDb();
        await db.collection('emailQueue').add({
            to: email,
            template: 'confirmation',
            data: { link },
            status: 'pending',
            createdAt: new Date()
        });
    }
}

export const subscriptionService = new SubscriptionService();
