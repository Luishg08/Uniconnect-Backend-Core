import { Injectable, Logger } from '@nestjs/common';
import { ISubject, IObserver } from '../../../messages/domain/observer/interfaces';
import { StudyGroupEvent } from './study-group-event.interface';

/**
 * Concrete implementation of ISubject for study group events.
 * Manages a list of observers and notifies them when group events occur.
 */
@Injectable()
export class StudyGroupSubject implements ISubject<StudyGroupEvent> {
  private readonly observers: IObserver<StudyGroupEvent>[] = [];
  private readonly logger = new Logger(StudyGroupSubject.name);

  /**
   * Attach an observer to receive study group event notifications.
   * Prevents duplicate attachments.
   *
   * @param observer - The observer to attach
   */
  attach(observer: IObserver<StudyGroupEvent>): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      this.logger.log(
        `Observer attached. Total observers: ${this.observers.length}`,
      );
    }
  }

  /**
   * Detach an observer from receiving study group event notifications.
   *
   * @param observer - The observer to detach
   */
  detach(observer: IObserver<StudyGroupEvent>): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
      this.logger.log(
        `Observer detached. Total observers: ${this.observers.length}`,
      );
    }
  }

  /**
   * Notify all attached observers with the study group event data.
   * Isolates errors - if one observer fails, others still receive notifications.
   *
   * @param event - The study group event to send to observers
   */
  notify(event: StudyGroupEvent): void {
    this.logger.log(
      `Notifying ${this.observers.length} observers of event: ${event.type} for user ${event.targetUserId}`,
    );

    for (const observer of this.observers) {
      try {
        observer.update(event);
      } catch (error) {
        this.logger.error(
          `Observer notification failed: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Get the current number of attached observers.
   * Useful for testing and debugging.
   */
  getObserverCount(): number {
    return this.observers.length;
  }
}
