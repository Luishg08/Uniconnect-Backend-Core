import { MessageDecorator } from './message-decorator.abstract';
import { IMessage } from './interfaces';

interface Reaction {
  emoji: string;
  count: number;
  users: number[];
}

/**
 * Decorator that adds emoji reaction capabilities to messages.
 */
export class ReactionMessageDecorator extends MessageDecorator {
  constructor(
    message: IMessage,
    private readonly reactions: Reaction[],
  ) {
    super(message);
  }

  render(): string {
    const baseRender = JSON.parse(this.message.render());
    return JSON.stringify({
      ...baseRender,
      reactions: this.reactions,
    });
  }
}
