import { IPerfilEstudiante, Insignia, PerfilRendered } from './interfaces/perfil-estudiante.interface';
import { PerfilDecoratorAbstract } from './perfil-decorator.abstract';

/**
 * Decorador CA #3: añade insignias desbloqueadas al perfil.
 * Las insignias se calculan en el servicio a partir de hitos del sistema
 * (grupos creados, mensajes enviados, semestre, etc.).
 */
export class PerfilConInsignias extends PerfilDecoratorAbstract {
  constructor(
    perfil: IPerfilEstudiante,
    private readonly insignias: Insignia[],
  ) {
    super(perfil);
  }

  render(): PerfilRendered {
    const base = this.perfil.render();
    return {
      ...base,
      insignias: this.insignias,
    };
  }
}
