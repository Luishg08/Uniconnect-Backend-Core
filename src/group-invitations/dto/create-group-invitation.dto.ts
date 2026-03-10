import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGroupInvitationDto {
  @ApiProperty({
    description: 'ID del grupo al que se invita',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  id_group: number;

  @ApiProperty({
    description: 'ID del usuario que envía la invitación (debe ser admin)',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  inviter_id: number;

  @ApiProperty({
    description: 'ID del usuario que recibe la invitación',
    example: 2,
  })
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  invitee_id: number;
}
