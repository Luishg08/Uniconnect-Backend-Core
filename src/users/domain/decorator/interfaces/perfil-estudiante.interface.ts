export interface Asignatura {
  id_course: number;
  nombre: string;
}

export interface EstadisticasEstudiante {
  gruposCreados: number;
  gruposParticipa: number;
  mensajesEnviados: number;
}

export interface Insignia {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
}

export interface PerfilRendered {
  id: number;
  nombre: string;
  carrera: string | null;
  semestre: number | null;
  asignaturasActivas: Asignatura[];
  estadisticas?: EstadisticasEstudiante;
  insignias?: Insignia[];
}

/**
 * Interfaz del patrón Decorator para el perfil del estudiante.
 * PerfilBase y cada decorador concreto implementan esta interfaz.
 * Permite construir versiones enriquecidas del perfil sin acoplar
 * las estadísticas ni las insignias al modelo base.
 */
export interface IPerfilEstudiante {
  getNombre(): string;
  getCarrera(): string | null;
  getSemestre(): number | null;
  getAsignaturasActivas(): Asignatura[];
  render(): PerfilRendered;
}
