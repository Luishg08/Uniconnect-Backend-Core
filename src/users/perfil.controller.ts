import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PerfilService } from './perfil.service';

@ApiTags('Perfil')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  /**
   * CA #5: GET /perfil/:id
   * Retorna únicamente el perfil base (nombre, carrera, semestre, asignaturas activas).
   * Sin costo computacional extra: no consulta estadísticas ni insignias.
   *
   * CA #4: GET /perfil/:id?vista=completa
   * Aplica todos los decoradores en cadena:
   * PerfilBase → PerfilConEstadisticas → PerfilConInsignias.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'US-D02: Obtener perfil del estudiante con patrón Decorator',
    description:
      'Sin query param retorna PerfilBase. Con ?vista=completa aplica ' +
      'PerfilConEstadisticas y PerfilConInsignias sobre el perfil base.',
  })
  @ApiQuery({
    name: 'vista',
    required: false,
    enum: ['completa'],
    description: 'Usa "completa" para obtener el perfil enriquecido con estadísticas e insignias',
  })
  async getPerfil(
    @Param('id', ParseIntPipe) id: number,
    @Query('vista') vista?: string,
  ) {
    if (vista === 'completa') {
      return this.perfilService.getPerfilCompleto(id);
    }
    return this.perfilService.getPerfil(id);
  }
}
