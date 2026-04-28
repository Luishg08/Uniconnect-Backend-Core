import { IMessage } from './interfaces';

/**
 * Base implementation of IMessage for plain text messages.
 * This is the concrete component in the Decorator pattern.
 */
export class BaseMessage implements IMessage {
  constructor(
    private readonly textContent: string,
    private readonly userId: number,
    private readonly timestamp: Date,
  ) {}

  getContent(): string {
    return this.textContent;
  }

  getMetadata(): Record<string, unknown> {
    return {
      userId: this.userId,
      timestamp: this.timestamp.toISOString(),
    };
  }

  render(): string {
    return JSON.stringify({
      text: this.textContent,
    });
  }
}
