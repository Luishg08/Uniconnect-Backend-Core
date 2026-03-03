import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class ExpoPushService implements OnModuleInit {
    private readonly logger = new Logger(ExpoPushService.name);

    onModuleInit() {
        if (admin.apps.length === 0) {
            const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

            if (!serviceAccountJson) {
                this.logger.warn('FIREBASE_SERVICE_ACCOUNT no está definida. Expo Push desactivado.');
                return;
            }

            try {
                const serviceAccount = JSON.parse(serviceAccountJson);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                this.logger.log('Firebase Admin inicializado correctamente');
            } catch (error) {
                this.logger.error('Error al inicializar Firebase Admin', error);
            }
        }
    }

    /**
     * Envía una notificación push a un solo token Expo Push.
     */
    async sendToToken(
        token: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<void> {
        if (admin.apps.length === 0) return;

        try {
            await admin.messaging().send({
                token,
                notification: { title, body },
                data: data ?? {},
                android: {
                    priority: 'high',
                    notification: { sound: 'default' },
                },
                apns: {
                    payload: {
                        aps: { sound: 'default', badge: 1 },
                    },
                },
            });
        } catch (error) {
            // Token inválido o expirado — lo omitimos silenciosamente
            this.logger.warn(`Token Expo Push inválido o error al enviar: ${token}`, error?.message);
        }
    }

    /**
     * Envía una notificación push a múltiples tokens Expo Push.
     */
    async sendToTokens(
        tokens: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<void> {
        if (admin.apps.length === 0 || tokens.length === 0) return;

        const sends = tokens.map((token) => this.sendToToken(token, title, body, data));
        await Promise.allSettled(sends);
    }
}
