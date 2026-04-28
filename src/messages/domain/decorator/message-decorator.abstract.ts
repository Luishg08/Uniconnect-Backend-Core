import { IMessage } from './interfaces';

/**
 * Abstract decorator class that implements IMessage and wraps another IMessage.
 * Concrete decorators extend this class to add specific capabilities.
 */
export abstract class MessageDecorator implements IMessage {
  constructor(protected readonly message: IMessage) {}

  getContent(): string {
    return this.message.getContent();
  }

  getMetadata(): Record<string, unknown> {
    return this.message.getMetadata();
  }

  abstract render(): string;
}
