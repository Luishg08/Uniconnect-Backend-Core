import { BaseProfile } from '../base-profile';

describe('BaseProfile', () => {
  const userId = 1;
  const username = 'johndoe';
  const email = 'john@example.com';
  let profile: BaseProfile;

  beforeEach(() => {
    profile = new BaseProfile(userId, username, email);
  });

  describe('getBasicInfo', () => {
    it('should return userId, username, and email', () => {
      const info = profile.getBasicInfo();
      expect(info.userId).toBe(userId);
      expect(info.username).toBe(username);
      expect(info.email).toBe(email);
    });
  });

  describe('render', () => {
    it('should return JSON with basic fields only', () => {
      const rendered = profile.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.userId).toBe(userId);
      expect(parsed.username).toBe(username);
      expect(parsed.email).toBe(email);
    });

    it('should NOT include verified field', () => {
      const rendered = profile.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.verified).toBeUndefined();
      expect(parsed.verifiedAt).toBeUndefined();
      expect(parsed.verifiedBy).toBeUndefined();
    });
  });
});
