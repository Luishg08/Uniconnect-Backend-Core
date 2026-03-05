import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
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

  @Get()
  async getMyConnections(@GetClaim('sub') userId: number) {
    return this.connectionsService.getMyConnections(userId);
  }

  @Post('request')
  async sendConnectionRequest(
    @GetClaim('sub') requesterId: number,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.connectionsService.sendConnectionRequest(
      requesterId,
      dto.adressee_id,
    );
  }

  @Patch(':id/accept')
  async acceptConnection(
    @Param('id') id: string,
    @GetClaim('sub') userId: number,
  ) {
    return this.connectionsService.acceptConnection(+id, userId);
  }

  @Patch(':id/reject')
  async rejectConnection(
    @Param('id') id: string,
    @GetClaim('sub') userId: number,
  ) {
    return this.connectionsService.rejectConnection(+id, userId);
  }
}