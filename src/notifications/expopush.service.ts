import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  async sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title,
          body,
          data,
        }),
      });

      const result = await response.json();

      if (result.data?.status !== 'ok') {
        this.logger.warn(`Error enviando push a ${token}`, result);
      }
    } catch (error) {
      this.logger.error(`Error enviando notificación Expo`, error);
    }
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    if (!tokens.length) return;

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    }));

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    } catch (error) {
      this.logger.error('Error enviando múltiples notificaciones Expo', error);
    }
  }
}