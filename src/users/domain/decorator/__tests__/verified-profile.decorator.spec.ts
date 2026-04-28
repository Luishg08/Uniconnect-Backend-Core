import { BaseProfile } from '../base-profile';
import { VerifiedProfileDecorator } from '../verified-profile.decorator';

describe('VerifiedProfileDecorator', () => {
  const userId = 1;
  const username = 'johndoe';
  const email = 'john@example.com';
  const verifiedAt = new Date('2026-04-27T12:00:00Z');
  const verifiedBy = 'admin@example.com';

  let baseProfile: BaseProfile;
  let decoratedProfile: VerifiedProfileDecorator;

  beforeEach(() => {
    baseProfile = new BaseProfile(userId, username, email);
    decoratedProfile = new VerifiedProfileDecorator(
      baseProfile,
      verifiedAt,
      verifiedBy,
    );
  });

  describe('getBasicInfo', () => {
    it('should delegate to wrapped profile', () => {
      const info = decoratedProfile.getBasicInfo();
      expect(info.userId).toBe(userId);
      expect(info.username).toBe(username);
      expect(info.email).toBe(email);
    });
  });

  describe('render', () => {
    it('should include verified field in JSON', () => {
      const rendered = decoratedProfile.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.verified).toBe(true);
      expect(parsed.verifiedAt).toBe(verifiedAt.toISOString());
      expect(parsed.verifiedBy).toBe(verifiedBy);
    });

    it('should preserve base profile fields', () => {
      const rendered = decoratedProfile.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.userId).toBe(userId);
      expect(parsed.username).toBe(username);
      expect(parsed.email).toBe(email);
    });
  });
});
