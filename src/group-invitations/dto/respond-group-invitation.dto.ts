import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RespondGroupInvitationDto {
  @ApiProperty({
    description: 'Respuesta a la invitación: accepted o rejected',
    example: 'accepted',
    enum: ['accepted', 'rejected'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['accepted', 'rejected'])
  status: 'accepted' | 'rejected';
}
