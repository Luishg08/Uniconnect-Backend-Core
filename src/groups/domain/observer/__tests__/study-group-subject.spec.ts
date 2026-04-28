import { Test, TestingModule } from '@nestjs/testing';
import { StudyGroupSubject } from '../study-group-subject';
import { IObserver } from '../../../../messages/domain/observer/interfaces';
import { StudyGroupEvent } from '../study-group-event.interface';

describe('StudyGroupSubject', () => {
  let studyGroupSubject: StudyGroupSubject;
  let mockObserver1: IObserver<StudyGroupEvent>;
  let mockObserver2: IObserver<StudyGroupEvent>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudyGroupSubject],
    }).compile();

    studyGroupSubject = module.get<StudyGroupSubject>(StudyGroupSubject);

    mockObserver1 = {
      update: jest.fn(),
    };

    mockObserver2 = {
      update: jest.fn(),
    };
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

      const event: StudyGroupEvent = {
        type: 'JOIN_REQUEST',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'John Doe',
        timestamp: new Date(),
      };

      studyGroupSubject.notify(event);

      expect(mockObserver1.update).toHaveBeenCalledWith(event);
      expect(mockObserver2.update).toHaveBeenCalledWith(event);
    });

    it('should notify correct number of observers', () => {
      studyGroupSubject.attach(mockObserver1);
      studyGroupSubject.attach(mockObserver2);

      const event: StudyGroupEvent = {
        type: 'MEMBER_ACCEPTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Admin',
        timestamp: new Date(),
      };

      studyGroupSubject.notify(event);

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

      const event: StudyGroupEvent = {
        type: 'MEMBER_REJECTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Admin',
        timestamp: new Date(),
      };

      expect(() => studyGroupSubject.notify(event)).not.toThrow();
      expect(mockObserver1.update).toHaveBeenCalledWith(event);
    });

    it('should handle empty observer list', () => {
      const event: StudyGroupEvent = {
        type: 'ADMIN_TRANSFER_REQUESTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Owner',
        timestamp: new Date(),
      };

      expect(() => studyGroupSubject.notify(event)).not.toThrow();
    });
  });
});
