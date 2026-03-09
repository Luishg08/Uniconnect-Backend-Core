export class CreateMembershipDto {
  id_user: number;
  id_group: number;
  is_admin?: boolean;
  joined_at?: Date;
}
