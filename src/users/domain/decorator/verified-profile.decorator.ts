import { IProfile } from './interfaces';
import { ProfileDecorator } from './profile-decorator.abstract';

export class VerifiedProfileDecorator extends ProfileDecorator {
  constructor(
    profile: IProfile,
    private readonly verifiedAt: Date,
    private readonly verifiedBy: string,
  ) {
    super(profile);
  }

  render(): string {
    const baseData = JSON.parse(this.profile.render());
    return JSON.stringify({
      ...baseData,
      verified: true,
      verifiedAt: this.verifiedAt.toISOString(),
      verifiedBy: this.verifiedBy,
    });
  }
}
