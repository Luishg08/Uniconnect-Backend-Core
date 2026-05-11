import { EstadisticasEstudiante, Insignia } from '../interfaces/perfil-estudiante.interface';

const CATALOGO: Array<{
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  condicion: (stats: EstadisticasEstudiante, semestre: number | null) => boolean;
}> = [
  {
    id: 'registrado',
    nombre: 'Registrado',
    descripcion: 'Bienvenido a Uniconnect. ¡Tu cuenta está activa!',
    icono: '🎒',
    condicion: () => true,
  },
  {
    id: 'participante',
    nombre: 'Participante',
    descripcion: 'Formas parte de al menos un grupo de estudio',
    icono: '👥',
    condicion: (s) => s.gruposParticipa >= 1,
  },
  {
    id: 'fundador',
    nombre: 'Fundador',
    descripcion: 'Creaste tu primer grupo de estudio',
    icono: '🏗️',
    condicion: (s) => s.gruposCreados >= 1,
  },
  {
    id: 'mensajero',
    nombre: 'Mensajero',
    descripcion: 'Enviaste tu primer mensaje en un grupo',
    icono: '✉️',
    condicion: (s) => s.mensajesEnviados >= 1,
  },
  {
    id: 'explorador',
    nombre: 'Explorador',
    descripcion: 'Participas en 3 o más grupos de estudio',
    icono: '🧭',
    condicion: (s) => s.gruposParticipa >= 3,
  },
  {
    id: 'comunicador',
    nombre: 'Comunicador',
    descripcion: 'Enviaste 10 o más mensajes en grupos',
    icono: '💬',
    condicion: (s) => s.mensajesEnviados >= 10,
  },
  {
    id: 'maratonista',
    nombre: 'Maratonista',
    descripcion: 'Enviaste 50 o más mensajes en grupos',
    icono: '🏃',
    condicion: (s) => s.mensajesEnviados >= 50,
  },
  {
    id: 'veterano',
    nombre: 'Veterano',
    descripcion: 'Llevas 5 o más semestres en la universidad',
    icono: '🎓',
    condicion: (_s, semestre) => semestre !== null && semestre >= 5,
  },
  {
    id: 'lider',
    nombre: 'Líder',
    descripcion: 'Creaste 3 o más grupos de estudio',
    icono: '⭐',
    condicion: (s) => s.gruposCreados >= 3,
  },
];

/**
 * Determina qué insignias ha desbloqueado el estudiante
 * en función de sus estadísticas y semestre actual.
 */
export function calcularInsignias(
  estadisticas: EstadisticasEstudiante,
  semestre: number | null,
): Insignia[] {
  return CATALOGO
    .filter((def) => def.condicion(estadisticas, semestre))
    .map(({ id, nombre, descripcion, icono }) => ({ id, nombre, descripcion, icono }));
}
