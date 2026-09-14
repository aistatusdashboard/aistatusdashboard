import nodemailer from 'nodemailer';
import { config } from '@/lib/config';
import { log } from '@/lib/utils/logger';

export class EmailUtils {
    private static transporter: nodemailer.Transporter;

    private static isLoopbackHost(host: string): boolean {
        const h = host.toLowerCase();
        return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1';
    }

    private static init() {
        if (this.transporter) return;

        const ignoreTls =
            process.env.SMTP_IGNORE_TLS === 'true' || this.isLoopbackHost(config.email.smtp.host);

        this.transporter = nodemailer.createTransport({
            host: config.email.smtp.host,
            port: config.email.smtp.port,
            secure: config.email.smtp.secure,
            ...(ignoreTls ? { ignoreTLS: true } : {}),
            ...(config.email.smtp.user && config.email.smtp.password
                ? {
                      auth: {
                          user: config.email.smtp.user,
                          pass: config.email.smtp.password,
                      },
                  }
                : {}),
            // Keep retries/timeouts sane for serverless environments
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 15_000,
        });
    }

    static async sendEmail(
        to: string,
        subject: string,
        html: string,
        options: { text?: string; unsubscribeUrl?: string } = {}
    ): Promise<boolean> {
        if (!config.email.enabled) {
            log('warn', 'Email disabled', { to, subject });
            return false;
        }

        this.init();
        if (!this.transporter) {
            log('error', 'Email transporter not initialized (missing credentials)');
            return false;
        }

        try {
            // A plain-text part and one-click unsubscribe headers are what
            // Gmail/Yahoo expect from a sender; without them alert mail is
            // far likelier to be filed as spam — and so are the confirmations.
            const headers: Record<string, string> = {};
            if (options.unsubscribeUrl) {
                headers['List-Unsubscribe'] = `<${options.unsubscribeUrl}>`;
                headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
            }
            await this.transporter.sendMail({
                from: config.email.from,
                to,
                subject,
                html,
                text: options.text,
                headers,
            });
            return true;
        } catch (error) {
            log('error', 'Failed to send email', { error, to });
            return false;
        }
    }
}
