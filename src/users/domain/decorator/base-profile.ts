import { IProfile } from './interfaces';

export class BaseProfile implements IProfile {
  constructor(
    private readonly userId: number,
    private readonly username: string,
    private readonly email: string,
  ) {}

  getBasicInfo() {
    return {
      userId: this.userId,
      username: this.username,
      email: this.email,
    };
  }

  getMetadata(): Record<string, unknown> {
    return {
      createdAt: new Date().toISOString(),
    };
  }

  render(): string {
    const { userId, username, email } = this.getBasicInfo();
    return JSON.stringify({ userId, username, email });
  }
}
