import { IObserver } from './observer.interface';

/**
 * Subject interface for Observer pattern.
 * Manages a list of observers and notifies them of state changes.
 *
 * @template T - Type of data to be notified to observers
 */
export interface ISubject<T> {
  /**
   * Attach an observer to receive notifications.
   * @param observer - Observer to attach
   */
  attach(observer: IObserver<T>): void;

  /**
   * Detach an observer from receiving notifications.
   * @param observer - Observer to detach
   */
  detach(observer: IObserver<T>): void;

  /**
   * Notify all attached observers with data.
   * @param data - Data to send to observers
   */
  notify(data: T): void;
}
