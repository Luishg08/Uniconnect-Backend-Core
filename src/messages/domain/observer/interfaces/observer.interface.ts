/**
 * Observer interface for Observer pattern.
 * Receives notifications from subjects.
 * 
 * @template T - Type of data received from subject
 */
export interface IObserver<T> {
  /**
   * Update method called by subject when notifying.
   * @param data - Data received from subject
   */
  update(data: T): void;
}
