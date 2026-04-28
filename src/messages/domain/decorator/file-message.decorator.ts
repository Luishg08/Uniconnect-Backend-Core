import { MessageDecorator } from './message-decorator.abstract';
import { IMessage } from './interfaces';

interface FileAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

/**
 * Decorator that adds file attachment capabilities to messages.
 */
export class FileMessageDecorator extends MessageDecorator {
  constructor(
    message: IMessage,
    private readonly files: FileAttachment[],
  ) {
    super(message);
  }

  render(): string {
    const baseRender = JSON.parse(this.message.render());
    return JSON.stringify({
      ...baseRender,
      files: this.files,
    });
  }
}
