import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
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
    return this.connectionsService.acceptConnectionRequest(+id, userId);
  }

  @Patch(':id/reject')
  async rejectConnectionRequest(
    @Param('id') id: string,
    @GetClaim('sub') userId: number,
  ) {
    return this.connectionsService.rejectConnectionRequest(+id, userId);
  }
}