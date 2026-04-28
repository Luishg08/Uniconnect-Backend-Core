/**
 * Interface for message objects in the Decorator pattern.
 * All message implementations (base and decorators) must implement this contract.
 */
export interface IMessage {
  /**
   * Returns the text content of the message.
   */
  getContent(): string;

  /**
   * Returns metadata associated with the message (userId, timestamp, etc.).
   */
  getMetadata(): Record<string, unknown>;

  /**
   * Renders the message as a JSON string with structured data.
   * The JSON structure includes text, mentions, files, and reactions.
   */
  render(): string;
}
