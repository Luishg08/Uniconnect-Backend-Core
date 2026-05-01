import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GroupInvitationsService } from './group-invitations.service';
import { CreateGroupInvitationDto } from './dto/create-group-invitation.dto';
import { RespondGroupInvitationDto } from './dto/respond-group-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetClaim } from '../auth/decorators/get-token-claim.decorator';

@ApiTags('group-invitations')
@Controller('group-invitations')
export class GroupInvitationsController {
  constructor(
    private readonly groupInvitationsService: GroupInvitationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Enviar invitación a un grupo (solo admin)' })
  @ApiResponse({ status: 201, description: 'Invitación enviada exitosamente.' })
  @ApiResponse({ status: 403, description: 'Solo administradores pueden invitar.' })
  sendInvitation(@Body() createDto: CreateGroupInvitationDto) {
    return this.groupInvitationsService.sendInvitation(createDto);
  }

  @Get('pending/:userId')
  @ApiOperation({ summary: 'Obtener invitaciones pendientes del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de invitaciones pendientes.' })
  getPendingInvitations(@Param('userId', ParseIntPipe) userId: number) {
    return this.groupInvitationsService.getPendingInvitations(userId);
  }

  @Get('sent/:userId')
  @ApiOperation({ summary: 'Obtener invitaciones enviadas por el usuario' })
  @ApiResponse({ status: 200, description: 'Lista de invitaciones enviadas.' })
  getSentInvitations(@Param('userId', ParseIntPipe) userId: number) {
    return this.groupInvitationsService.getSentInvitations(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/respond')
  @ApiOperation({ summary: 'Responder a una invitación (aceptar o rechazar)' })
  @ApiResponse({ status: 200, description: 'Respuesta procesada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Invitación no encontrada.' })
  respondToInvitation(
    @Param('id', ParseIntPipe) id: number,
    @GetClaim('sub') userId: number,
    @Body() respondDto: RespondGroupInvitationDto,
  ) {

    // Convert userId to number if it's a string
    const numericUserId = typeof userId === 'string' 
      ? parseInt(userId, 10) 
      : userId;

    // Validate conversion was successful
    if (isNaN(numericUserId) || numericUserId <= 0) {
      console.error('[GroupInvitations] Invalid user ID from JWT token', {
        originalUserId: userId,
        convertedUserId: numericUserId,
      });
      throw new BadRequestException('Invalid user ID from JWT token. Must be a positive integer.');
    }

    try {
      return this.groupInvitationsService.respondToInvitation(
        id,
        numericUserId,
        respondDto,
      );
    } catch (error) {
      console.error('[GroupInvitations] Error responding to invitation', {
        invitationId: id,
        userId: numericUserId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Cancelar una invitación (solo quien la envió)' })
  @ApiResponse({ status: 200, description: 'Invitación cancelada.' })
  @ApiResponse({ status: 403, description: 'Sin permiso para cancelar.' })
  cancelInvitation(
    @Param('id', ParseIntPipe) id: number,
    @GetClaim('sub') userId: number,
  ) {

    // Convert userId to number if it's a string
    const numericUserId = typeof userId === 'string' 
      ? parseInt(userId, 10) 
      : userId;

    // Validate conversion was successful
    if (isNaN(numericUserId) || numericUserId <= 0) {
      console.error('[GroupInvitations] Invalid user ID from JWT token', {
        originalUserId: userId,
        convertedUserId: numericUserId,
      });
      throw new BadRequestException('Invalid user ID from JWT token. Must be a positive integer.');
    }

    try {
      return this.groupInvitationsService.cancelInvitation(id, numericUserId);
    } catch (error) {
      console.error('[GroupInvitations] Error canceling invitation', {
        invitationId: id,
        userId: numericUserId,
        error: error.message,
      });
      throw error;
    }
  }
}
