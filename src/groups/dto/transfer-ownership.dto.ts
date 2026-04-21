import { IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferOwnershipDto {
  @ApiProperty({
    description: 'ID del nuevo propietario del grupo',
    example: 5,
  })
  @IsInt()
  @IsPositive()
  new_owner_id: number;
}
