import { Injectable, Logger } from '@nestjs/common';
import { ISubject, IObserver } from './interfaces';
import { MessageDto } from '../../dto/message.dto';

/**
 * Concrete implementation of ISubject for chat messages.
 * Manages a list of observers and notifies them when messages are processed.
 */
@Injectable()
export class ChatSubject implements ISubject<MessageDto> {
  private readonly observers: IObserver<MessageDto>[] = [];
  private readonly logger = new Logger(ChatSubject.name);

  /**
   * Attach an observer to receive message notifications.
   * 
   * @param observer - The observer to attach
   */
  attach(observer: IObserver<MessageDto>): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      this.logger.log(`Observer attached. Total observers: ${this.observers.length}`);
    }
  }

  /**
   * Detach an observer from receiving message notifications.
   * 
   * @param observer - The observer to detach
   */
  detach(observer: IObserver<MessageDto>): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
      this.logger.log(`Observer detached. Total observers: ${this.observers.length}`);
    }
  }

  /**
   * Notify all attached observers with the message data.
   * Clears observers after notification (one-time use pattern).
   * 
   * @param data - The message data to send to observers
   */
  notify(data: MessageDto): void {
    this.logger.log(`Notifying ${this.observers.length} observers with message: ${data.id_message}`);
    
    for (const observer of this.observers) {
      try {
        observer.update(data);
      } catch (error) {
        this.logger.error(`Observer notification failed: ${error.message}`, error.stack);
      }
    }
    
    // Clear observers after notification (one-time use pattern)
    this.observers.length = 0;
    this.logger.log('All observers cleared after notification');
  }

  /**
   * Get the current number of attached observers.
   * Useful for testing and debugging.
   */
  getObserverCount(): number {
    return this.observers.length;
  }
}
