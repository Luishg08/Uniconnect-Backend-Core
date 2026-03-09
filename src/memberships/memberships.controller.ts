import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  /**
   * POST /memberships
   * Crear una nueva membresía (agregar usuario a grupo)
   */
  @Post()
  create(@Body() createMembershipDto: CreateMembershipDto) {
    return this.membershipsService.create(createMembershipDto);
  }

  /**
   * GET /memberships
   * Obtener todas las membresías
   */
  @Get()
  findAll() {
    return this.membershipsService.findAll();
  }

  /**
   * GET /memberships/:id
   * Obtener una membresía por su ID
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.membershipsService.findOne(id);
  }

  /**
   * GET /memberships/user/:id_user
   * Obtener todas las membresías de un usuario
   */
  @Get('user/:id_user')
  findByUser(@Param('id_user', ParseIntPipe) id_user: number) {
    return this.membershipsService.findByUser(id_user);
  }

  /**
   * GET /memberships/group/:id_group
   * Obtener todas las membresías de un grupo
   */
  @Get('group/:id_group')
  findByGroup(@Param('id_group', ParseIntPipe) id_group: number) {
    return this.membershipsService.findByGroup(id_group);
  }

  /**
   * PATCH /memberships/:id
   * Actualizar una membresía
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMembershipDto: UpdateMembershipDto,
  ) {
    return this.membershipsService.update(id, updateMembershipDto);
  }

  /**
   * PATCH /memberships/:id/toggle-admin
   * Promover/degradar un usuario a admin
   */
  @Patch(':id/toggle-admin')
  toggleAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { is_admin: boolean },
  ) {
    return this.membershipsService.toggleAdmin(id, body.is_admin);
  }

  /**
   * DELETE /memberships/:id
   * Eliminar una membresía (remover usuario del grupo)
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.membershipsService.remove(id);
  }
}
