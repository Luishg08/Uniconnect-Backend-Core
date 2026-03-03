import { IsInt, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendNotificationDto {
    @ApiProperty({ description: 'ID del usuario destinatario' })
    @IsInt()
    id_user: number;

    @ApiProperty({ example: 'Nueva solicitud de conexión', description: 'Mensaje de la notificación' })
    @IsString()
    message: string;

    @ApiProperty({ enum: ['connection_request', 'new_message'], example: 'connection_request' })
    @IsString()
    notification_type: string;

    @ApiPropertyOptional({ description: 'ID de la entidad relacionada (conexión, grupo, etc.)' })
    @IsOptional()
    @IsInt()
    related_entity_id?: number;
}
