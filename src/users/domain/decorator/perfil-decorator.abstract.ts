import {
  Asignatura,
  IPerfilEstudiante,
  PerfilRendered,
} from './interfaces/perfil-estudiante.interface';

/**
 * Clase abstracta base para todos los decoradores de perfil.
 * Delega las operaciones de lectura al componente envuelto
 * y obliga a cada decorador concreto a implementar render().
 */
export abstract class PerfilDecoratorAbstract implements IPerfilEstudiante {
  constructor(protected readonly perfil: IPerfilEstudiante) {}

  getNombre(): string {
    return this.perfil.getNombre();
  }

  getCarrera(): string | null {
    return this.perfil.getCarrera();
  }

  getSemestre(): number | null {
    return this.perfil.getSemestre();
  }

  getAsignaturasActivas(): Asignatura[] {
    return this.perfil.getAsignaturasActivas();
  }

  abstract render(): PerfilRendered;
}
