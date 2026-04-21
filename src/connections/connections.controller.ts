import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetClaim } from 'src/auth/decorators/get-token-claim.decorator';
import { CreateConnectionDto } from './dto/create-connection';

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}


  @Get('pending')
  async getPendingRequests(@GetClaim('sub') userId: number) {
    return this.connectionsService.getPendingRequests(userId);
  }

  @Get('status/:userId')
  async getConnectionStatus(
    @GetClaim('sub') currentUserId: number,
    @Param('userId') userId: string,
  ) {
    return this.connectionsService.getConnectionStatus(currentUserId, +userId);
  }

  @Post('request')
  async sendConnectionRequest(
    @GetClaim('sub') requesterId: number,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.connectionsService.sendConnectionRequest(
      requesterId,
      dto.addressee_id,
    );
  }

  @Patch(':id/accept')
  async acceptConnectionRequest(
    @Param('id') id: string,
    @GetClaim('sub') userId: number,
  ) {
    try {
      const connectionId = parseInt(id, 10);
      
      if (isNaN(connectionId)) {
        throw new BadRequestException('ID de conexión inválido');
      }

      return await this.connectionsService.acceptConnectionRequest(connectionId, userId);
    } catch (error) {
      console.error('❌ [ConnectionsController.acceptConnectionRequest] Error:', {
        id,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  @Patch(':id/reject')
  async rejectConnectionRequest(
    @Param('id') id: string,
    @GetClaim('sub') userId: number,
  ) {
    try {
      const connectionId = parseInt(id, 10);
      
      if (isNaN(connectionId)) {
        throw new BadRequestException('ID de conexión inválido');
      }

      return await this.connectionsService.rejectConnectionRequest(connectionId, userId);
    } catch (error) {
      console.error('❌ [ConnectionsController.rejectConnectionRequest] Error:', {
        id,
        userId,
        error: error.message,
      });
      throw error;
    }
  }
}