import { Test, TestingModule } from '@nestjs/testing';
import { StudyGroupSubject } from '../study-group-subject';
import { IObserver } from '../../../../messages/domain/observer/interfaces';
import { StudyGroupEvent } from '../study-group-event.interface';

describe('StudyGroupSubject', () => {
  let studyGroupSubject: StudyGroupSubject;
  let mockObserver1: IObserver<StudyGroupEvent>;
  let mockObserver2: IObserver<StudyGroupEvent>;

  const makeEvent = (overrides: Partial<StudyGroupEvent> = {}): StudyGroupEvent => ({
    type: 'JOIN_REQUEST',
    payload: { id_group: 100, group_name: 'Test Group' },
    targetUserId: 1,
    timestamp: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudyGroupSubject],
    }).compile();

    studyGroupSubject = module.get<StudyGroupSubject>(StudyGroupSubject);

    mockObserver1 = { update: jest.fn() };
    mockObserver2 = { update: jest.fn() };
  });

  describe('attach', () => {
    it('should attach observer to the subject', () => {
      studyGroupSubject.attach(mockObserver1);
      expect(studyGroupSubject.getObserverCount()).toBe(1);
    });

    it('should not attach duplicate observers', () => {
      studyGroupSubject.attach(mockObserver1);
      studyGroupSubject.attach(mockObserver1);
      expect(studyGroupSubject.getObserverCount()).toBe(1);
    });

    it('should attach multiple different observers', () => {
      studyGroupSubject.attach(mockObserver1);
      studyGroupSubject.attach(mockObserver2);
      expect(studyGroupSubject.getObserverCount()).toBe(2);
    });
  });

  describe('detach', () => {
    it('should detach observer from the subject', () => {
      studyGroupSubject.attach(mockObserver1);
      studyGroupSubject.detach(mockObserver1);
      expect(studyGroupSubject.getObserverCount()).toBe(0);
    });

    it('should handle detaching non-existent observer', () => {
      studyGroupSubject.detach(mockObserver1);
      expect(studyGroupSubject.getObserverCount()).toBe(0);
    });

    it('should detach only the specified observer', () => {
      studyGroupSubject.attach(mockObserver1);
      studyGroupSubject.attach(mockObserver2);
      studyGroupSubject.detach(mockObserver1);
      expect(studyGroupSubject.getObserverCount()).toBe(1);
    });
  });

  describe('notify', () => {
    it('should notify all attached observers', () => {
      studyGroupSubject.attach(mockObserver1);
      studyGroupSubject.attach(mockObserver2);

      const event = makeEvent({ type: 'JOIN_REQUEST', targetUserId: 1 });
      studyGroupSubject.notify(event);

      expect(mockObserver1.update).toHaveBeenCalledWith(event);
      expect(mockObserver2.update).toHaveBeenCalledWith(event);
    });

    it('should notify correct number of observers', () => {
      studyGroupSubject.attach(mockObserver1);
      studyGroupSubject.attach(mockObserver2);

      studyGroupSubject.notify(makeEvent({ type: 'MEMBER_ACCEPTED' }));

      expect(mockObserver1.update).toHaveBeenCalledTimes(1);
      expect(mockObserver2.update).toHaveBeenCalledTimes(1);
    });

    it('should handle observer errors gracefully', () => {
      const errorObserver: IObserver<StudyGroupEvent> = {
        update: jest.fn().mockImplementation(() => {
          throw new Error('Observer error');
        }),
      };

      studyGroupSubject.attach(errorObserver);
      studyGroupSubject.attach(mockObserver1);

      expect(() => studyGroupSubject.notify(makeEvent({ type: 'MEMBER_REJECTED' }))).not.toThrow();
      expect(mockObserver1.update).toHaveBeenCalledTimes(1);
    });

    it('should handle empty observer list', () => {
      expect(() => studyGroupSubject.notify(makeEvent({ type: 'ADMIN_TRANSFER_REQUESTED' }))).not.toThrow();
    });

    it('should notify with MEMBER_LEFT event when a user leaves a group', () => {
      studyGroupSubject.attach(mockObserver1);

      const event = makeEvent({
        type: 'MEMBER_LEFT',
        payload: { id_group: 42, group_name: 'Calculo I', member_id: 7, member_name: 'Ana Torres' },
        targetUserId: 5,
      });

      studyGroupSubject.notify(event);

      expect(mockObserver1.update).toHaveBeenCalledWith(event);
    });

    it('should notify with MEMBER_REMOVED event when a member is kicked', () => {
      studyGroupSubject.attach(mockObserver1);

      const event = makeEvent({
        type: 'MEMBER_REMOVED',
        payload: { id_group: 42, group_name: 'Calculo I' },
        targetUserId: 7,
      });

      studyGroupSubject.notify(event);

      expect(mockObserver1.update).toHaveBeenCalledWith(event);
    });

    it('should notify the correct targetUserId for MEMBER_LEFT', () => {
      studyGroupSubject.attach(mockObserver1);

      const ownerId = 10;
      const event = makeEvent({
        type: 'MEMBER_LEFT',
        payload: { id_group: 1, group_name: 'Grupo A', member_id: 3, member_name: 'Luis' },
        targetUserId: ownerId,
      });

      studyGroupSubject.notify(event);

      const received = (mockObserver1.update as jest.Mock).mock.calls[0][0] as StudyGroupEvent;
      expect(received.targetUserId).toBe(ownerId);
      expect(received.type).toBe('MEMBER_LEFT');
    });

    it('should notify the removed member as targetUserId for MEMBER_REMOVED', () => {
      studyGroupSubject.attach(mockObserver1);

      const removedUserId = 99;
      const event = makeEvent({
        type: 'MEMBER_REMOVED',
        payload: { id_group: 1, group_name: 'Grupo A' },
        targetUserId: removedUserId,
      });

      studyGroupSubject.notify(event);

      const received = (mockObserver1.update as jest.Mock).mock.calls[0][0] as StudyGroupEvent;
      expect(received.targetUserId).toBe(removedUserId);
      expect(received.type).toBe('MEMBER_REMOVED');
    });

    it('should continue notifying remaining observers if one fails on MEMBER_REMOVED', () => {
      const failingObserver: IObserver<StudyGroupEvent> = {
        update: jest.fn().mockImplementation(() => { throw new Error('fail'); }),
      };

      studyGroupSubject.attach(failingObserver);
      studyGroupSubject.attach(mockObserver1);

      expect(() => studyGroupSubject.notify(makeEvent({ type: 'MEMBER_REMOVED' }))).not.toThrow();
      expect(mockObserver1.update).toHaveBeenCalledTimes(1);
    });
  });
});
