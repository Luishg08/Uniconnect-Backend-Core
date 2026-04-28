import { MessageDecorator } from './message-decorator.abstract';
import { IMessage } from './interfaces';

interface Mention {
  userId: number;
  displayName: string;
  position: number;
}

/**
 * Decorator that adds user mention capabilities to messages.
 */
export class MentionMessageDecorator extends MessageDecorator {
  constructor(
    message: IMessage,
    private readonly mentions: Mention[],
  ) {
    super(message);
  }

  render(): string {
    const baseRender = JSON.parse(this.message.render());
    return JSON.stringify({
      ...baseRender,
      mentions: this.mentions,
    });
  }
}
