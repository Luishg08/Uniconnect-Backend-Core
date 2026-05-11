import { PerfilBase } from '../perfil-base';
import { PerfilConEstadisticas } from '../perfil-con-estadisticas.decorator';
import { PerfilConInsignias } from '../perfil-con-insignias.decorator';
import { calcularInsignias } from '../insignias/insignias.factory';
import { Asignatura, EstadisticasEstudiante } from '../interfaces/perfil-estudiante.interface';

const asignaturasActivas: Asignatura[] = [
  { id_course: 1, nombre: 'Algoritmos' },
  { id_course: 2, nombre: 'Bases de Datos' },
];

const buildBase = () =>
  new PerfilBase(42, 'Ana García', 'Ingeniería de Sistemas', 4, asignaturasActivas);

const estadisticasEjemplo: EstadisticasEstudiante = {
  gruposCreados: 2,
  gruposParticipa: 5,
  mensajesEnviados: 20,
};

// ─── CA #1: PerfilBase ────────────────────────────────────────────────────────
describe('CA #1: PerfilBase', () => {
  it('retorna el nombre del estudiante', () => {
    expect(buildBase().getNombre()).toBe('Ana García');
  });

  it('retorna la carrera del estudiante', () => {
    expect(buildBase().getCarrera()).toBe('Ingeniería de Sistemas');
  });

  it('retorna el semestre del estudiante', () => {
    expect(buildBase().getSemestre()).toBe(4);
  });

  it('retorna las asignaturas activas', () => {
    expect(buildBase().getAsignaturasActivas()).toHaveLength(2);
    expect(buildBase().getAsignaturasActivas()[0].nombre).toBe('Algoritmos');
  });

  it('render() no incluye estadisticas ni insignias', () => {
    const rendered = buildBase().render();
    expect(rendered.estadisticas).toBeUndefined();
    expect(rendered.insignias).toBeUndefined();
    expect(rendered.nombre).toBe('Ana García');
    expect(rendered.asignaturasActivas).toHaveLength(2);
  });

  it('render() con carrera nula', () => {
    const sinCarrera = new PerfilBase(1, 'Nuevo', null, null, []);
    expect(sinCarrera.render().carrera).toBeNull();
    expect(sinCarrera.render().semestre).toBeNull();
  });
});

// ─── CA #2: PerfilConEstadisticas ─────────────────────────────────────────────
describe('CA #2: PerfilConEstadisticas', () => {
  it('añade estadisticas al render del perfil base', () => {
    const perfil = new PerfilConEstadisticas(buildBase(), estadisticasEjemplo);
    const rendered = perfil.render();

    expect(rendered.estadisticas).toBeDefined();
    expect(rendered.estadisticas!.gruposCreados).toBe(2);
    expect(rendered.estadisticas!.gruposParticipa).toBe(5);
    expect(rendered.estadisticas!.mensajesEnviados).toBe(20);
  });

  it('conserva los datos base en el render', () => {
    const perfil = new PerfilConEstadisticas(buildBase(), estadisticasEjemplo);
    const rendered = perfil.render();

    expect(rendered.nombre).toBe('Ana García');
    expect(rendered.carrera).toBe('Ingeniería de Sistemas');
    expect(rendered.asignaturasActivas).toHaveLength(2);
  });

  it('delega getNombre al componente envuelto', () => {
    const perfil = new PerfilConEstadisticas(buildBase(), estadisticasEjemplo);
    expect(perfil.getNombre()).toBe('Ana García');
  });

  it('no incluye insignias (solo estadisticas)', () => {
    const perfil = new PerfilConEstadisticas(buildBase(), estadisticasEjemplo);
    expect(perfil.render().insignias).toBeUndefined();
  });
});

// ─── CA #3: PerfilConInsignias ────────────────────────────────────────────────
describe('CA #3: PerfilConInsignias', () => {
  it('añade insignias al render del perfil', () => {
    const insignias = calcularInsignias(estadisticasEjemplo, 4);
    const perfil = new PerfilConInsignias(buildBase(), insignias);
    const rendered = perfil.render();

    expect(rendered.insignias).toBeDefined();
    expect(Array.isArray(rendered.insignias)).toBe(true);
  });

  it('desbloquea Fundador con 1+ grupo creado', () => {
    const insignias = calcularInsignias({ gruposCreados: 1, gruposParticipa: 0, mensajesEnviados: 0 }, null);
    expect(insignias.map(i => i.id)).toContain('fundador');
  });

  it('desbloquea Explorador con 3+ grupos participados', () => {
    const insignias = calcularInsignias({ gruposCreados: 0, gruposParticipa: 3, mensajesEnviados: 0 }, null);
    expect(insignias.map(i => i.id)).toContain('explorador');
  });

  it('desbloquea Comunicador con 10+ mensajes', () => {
    const insignias = calcularInsignias({ gruposCreados: 0, gruposParticipa: 0, mensajesEnviados: 10 }, null);
    expect(insignias.map(i => i.id)).toContain('comunicador');
  });

  it('desbloquea Veterano con semestre 5+', () => {
    const insignias = calcularInsignias({ gruposCreados: 0, gruposParticipa: 0, mensajesEnviados: 0 }, 5);
    expect(insignias.map(i => i.id)).toContain('veterano');
  });

  it('NO desbloquea Veterano con semestre menor a 5', () => {
    const insignias = calcularInsignias({ gruposCreados: 0, gruposParticipa: 0, mensajesEnviados: 0 }, 4);
    expect(insignias.map(i => i.id)).not.toContain('veterano');
  });

  it('siempre retorna al menos la insignia Registrado', () => {
    const insignias = calcularInsignias({ gruposCreados: 0, gruposParticipa: 0, mensajesEnviados: 0 }, null);
    expect(insignias.map(i => i.id)).toContain('registrado');
    expect(insignias.length).toBeGreaterThanOrEqual(1);
  });

  it('desbloquea Participante con 1+ grupo participado', () => {
    const insignias = calcularInsignias({ gruposCreados: 0, gruposParticipa: 1, mensajesEnviados: 0 }, null);
    expect(insignias.map(i => i.id)).toContain('participante');
  });

  it('desbloquea Mensajero con 1+ mensaje enviado', () => {
    const insignias = calcularInsignias({ gruposCreados: 0, gruposParticipa: 0, mensajesEnviados: 1 }, null);
    expect(insignias.map(i => i.id)).toContain('mensajero');
  });
});

// ─── Composición de decoradores ───────────────────────────────────────────────
describe('Composición: PerfilBase + Estadísticas + Insignias', () => {
  it('render() incluye base + estadisticas + insignias al apilar decoradores', () => {
    const insignias = calcularInsignias(estadisticasEjemplo, 4);

    let perfil = buildBase() as any;
    perfil = new PerfilConEstadisticas(perfil, estadisticasEjemplo);
    perfil = new PerfilConInsignias(perfil, insignias);

    const rendered = perfil.render();

    expect(rendered.nombre).toBe('Ana García');
    expect(rendered.estadisticas!.gruposCreados).toBe(2);
    expect(rendered.insignias).toBeDefined();
  });

  it('cada decorador conserva la cadena de delegación', () => {
    const insignias = calcularInsignias(estadisticasEjemplo, 4);
    let perfil = buildBase() as any;
    perfil = new PerfilConEstadisticas(perfil, estadisticasEjemplo);
    perfil = new PerfilConInsignias(perfil, insignias);

    expect(perfil.getNombre()).toBe('Ana García');
    expect(perfil.getCarrera()).toBe('Ingeniería de Sistemas');
    expect(perfil.getSemestre()).toBe(4);
    expect(perfil.getAsignaturasActivas()).toHaveLength(2);
  });
});
