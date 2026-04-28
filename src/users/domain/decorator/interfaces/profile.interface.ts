export interface IProfile {
  getBasicInfo(): { userId: number; username: string; email: string };
  getMetadata(): Record<string, unknown>;
  render(): string;
}
