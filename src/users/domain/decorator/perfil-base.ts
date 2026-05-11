import {
  Asignatura,
  IPerfilEstudiante,
  PerfilRendered,
} from './interfaces/perfil-estudiante.interface';

/**
 * Componente base del patrón Decorator.
 * Contiene únicamente los datos esenciales del estudiante:
 * nombre, carrera, semestre y asignaturas activas.
 * No incurre en ningún costo computacional adicional.
 */
export class PerfilBase implements IPerfilEstudiante {
  constructor(
    private readonly id: number,
    private readonly nombre: string,
    private readonly carrera: string | null,
    private readonly semestre: number | null,
    private readonly asignaturasActivas: Asignatura[],
  ) {}

  getNombre(): string {
    return this.nombre;
  }

  getCarrera(): string | null {
    return this.carrera;
  }

  getSemestre(): number | null {
    return this.semestre;
  }

  getAsignaturasActivas(): Asignatura[] {
    return this.asignaturasActivas;
  }

  render(): PerfilRendered {
    return {
      id: this.id,
      nombre: this.nombre,
      carrera: this.carrera,
      semestre: this.semestre,
      asignaturasActivas: this.asignaturasActivas,
    };
  }
}
