import { IProfile } from './interfaces';

export abstract class ProfileDecorator implements IProfile {
  constructor(protected readonly profile: IProfile) {}

  getBasicInfo() {
    return this.profile.getBasicInfo();
  }

  getMetadata() {
    return this.profile.getMetadata();
  }

  abstract render(): string;
}
