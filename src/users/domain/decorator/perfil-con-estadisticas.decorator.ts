import { EstadisticasEstudiante, IPerfilEstudiante, PerfilRendered } from './interfaces/perfil-estudiante.interface';
import { PerfilDecoratorAbstract } from './perfil-decorator.abstract';

/**
 * Decorador CA #2: añade estadísticas de actividad al perfil base.
 * Enriquece el render con:
 *   - gruposCreados: grupos de los que el estudiante es owner
 *   - gruposParticipa: grupos en los que tiene membresía activa
 *   - mensajesEnviados: total de mensajes enviados en grupos
 */
export class PerfilConEstadisticas extends PerfilDecoratorAbstract {
  private readonly estadisticas: EstadisticasEstudiante;

  constructor(perfil: IPerfilEstudiante, estadisticas: EstadisticasEstudiante) {
    super(perfil);
    this.estadisticas = estadisticas;
  }

  render(): PerfilRendered {
    const base = this.perfil.render();
    return {
      ...base,
      estadisticas: this.estadisticas,
    };
  }
}
