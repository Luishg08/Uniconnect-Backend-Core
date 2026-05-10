```md
# Actividades — US-NOT-S4: Patrón Strategy en el módulo de Notificaciones

---

## Tarea 1: Definir la interfaz INotificacionStrategy y tipos auxiliares

**Prompt Sugerido:**
Crea el archivo `src/notifications/domain/strategy/interfaces.ts` con la interfaz `INotificacionStrategy` que expone el atributo readonly `canal: string` y el método `enviar(notificacion: NotificacionDTO): Promise<ResultadoEnvio>`. Define también en el mismo archivo la interfaz `NotificacionDTO` con los campos `id_user`, `mensaje`, `tipo_evento`, `entidad_relacionada_id?` y `metadata?`, y la interfaz `ResultadoEnvio` con `canal`, `exitoso`, `error?` y `timestamp`. Crea además `src/notifications/notifications.tokens.ts` que exporte la constante `NOTIFICACION_STRATEGIES = 'NOTIFICACION_STRATEGIES'` para usar como token de inyección.

**Commit:** `feat(notifications): definir interfaz INotificacionStrategy, NotificacionDTO y ResultadoEnvio`

**Estimación:** 0.5 h

---

## Tarea 2: Implementar InAppWebSocketStrategy

**Prompt Sugerido:**
Crea `src/notifications/domain/strategy/in-app-websocket.strategy.ts`. La clase `InAppWebSocketStrategy` debe implementar `INotificacionStrategy` con `canal = 'in_app_websocket'`. En `enviar()` debe: (1) persistir la notificación en la tabla `notification` usando `PrismaService`; (2) obtener los sockets activos del usuario via `ChatSessionManager.getUserSockets()`; (3) emitir el evento `'notificacion'` a cada socket con `ChatGateway.server.to(socketId).emit(...)`. Si ocurre cualquier error, capturarlo y devolver `ResultadoEnvio` con `exitoso: false` y el mensaje del error aislado.

**Commit:** `feat(notifications): implementar InAppWebSocketStrategy con persistencia en BD y emisión WebSocket`

**Estimación:** 1 h

---

## Tarea 3: Implementar EmailInstitucionalStrategy y PushMovilStrategy

**Prompt Sugerido:**
Crea `src/notifications/domain/strategy/email-institucional.strategy.ts` con `canal = 'email_institucional'`. El método `enviar()` debe registrar en el log el envío (stub para integración SMTP/SES futura) y retornar `exitoso: true`. Crea `src/notifications/domain/strategy/push-movil.strategy.ts` con `canal = 'push_movil'`. En `enviar()` debe: consultar `prisma.push_token.findMany({ where: { id_user, is_active: true } })`; si no hay tokens retornar `exitoso: true`; si los hay, construir el payload Expo y llamar `fetch('https://exp.host/--/api/v2/push/send', ...)`. Ante respuesta `!ok` lanzar error; cualquier excepción devuelve `exitoso: false` con el mensaje aislado. Crea el barrel `src/notifications/domain/strategy/index.ts` re-exportando todas las estrategias e interfaces.

**Commit:** `feat(notifications): implementar EmailInstitucionalStrategy y PushMovilStrategy`

**Estimación:** 1 h

---

## Tarea 4: Implementar ResumenDiarioStrategy como demostración del principio Open/Closed

**Prompt Sugerido:**
Crea `src/notifications/domain/strategy/resumen-diario.strategy.ts` con `canal = 'resumen_diario'`. El método `enviar()` encola (log/stub de BullMQ/SQS) la notificación para despacho diferido y retorna `exitoso: true`. La clase debe estar decorada con `@Injectable()` e implementar `INotificacionStrategy`. Agrega la re-exportación en `index.ts`. La clase no debe modificar ningún archivo del servicio, del módulo ni de las estrategias ya existentes, demostrando así el principio Open/Closed.

**Commit:** `feat(notifications): agregar ResumenDiarioStrategy como demostración del principio Open/Closed`

**Estimación:** 0.5 h

---

## Tarea 5: Refactorizar NotificationsService como contexto del patrón Strategy

**Prompt Sugerido:**
Modifica `src/notifications/notifications.service.ts`. Agrega al constructor `@Inject(NOTIFICACION_STRATEGIES) private readonly estrategias: INotificacionStrategy[]`. Implementa el método público `enviarNotificacion(notificacion: NotificacionDTO): Promise<ResultadoEnvio[]>` que: (1) llame a `filtrarEstrategiasActivas(userId, tipoEvento)`, que consulta la tabla `user_notification_preference` (creándola si no existe con `ensurePreferencesTable()`); si no hay preferencias devuelve todas las estrategias; de lo contrario filtra por canal activo; (2) ejecute las estrategias filtradas con `Promise.allSettled()` para aislar errores; (3) mapee los `PromiseSettledResult` a `ResultadoEnvio[]`, registrando en el logger cualquier estrategia rechazada. Implementa también `obtenerPreferencias(userId)` y `actualizarPreferencia(userId, tipoEvento, canal, activo)` usando `$queryRaw` / `$executeRaw` sobre la tabla.

**Commit:** `refactor(notifications): refactorizar NotificationsService como contexto Strategy con filtrado por preferencias`

**Estimación:** 1.5 h

---

## Tarea 6: Actualizar NotificationsModule con registro de estrategias vía inyección de dependencias

**Prompt Sugerido:**
Modifica `src/notifications/notifications.module.ts`. Agrega al array `imports` el `MessagesModule` (requerido por `InAppWebSocketStrategy`). En `providers` registra las tres estrategias concretas (`InAppWebSocketStrategy`, `EmailInstitucionalStrategy`, `PushMovilStrategy`) como providers. Agrega el provider de factory:
```typescript
{
  provide: NOTIFICACION_STRATEGIES,
  useFactory: (inApp, email, push) => [inApp, email, push],
  inject: [InAppWebSocketStrategy, EmailInstitucionalStrategy, PushMovilStrategy],
}
```
`NotificationsService` y `NotificationEventListener` permanecen en `providers`. Verifica que no haya dependencias circulares entre `MessagesModule` y `NotificationsModule`.

**Commit:** `feat(notifications): registrar estrategias mediante token NOTIFICACION_STRATEGIES en NotificationsModule`

**Estimación:** 0.5 h

---

## Tarea 7: Refactorizar NotificationEventListener para delegar el envío en las estrategias

**Prompt Sugerido:**
Modifica `src/notifications/listeners/notification-event.listener.ts`. Inyecta `NotificationsService` además de `PrismaService`. En cada handler `@OnEvent(...)` reemplaza la llamada directa a `prisma.notification.create()` o `prisma.notification.createMany()` por llamadas a `notificationsService.enviarNotificacion(dto: NotificacionDTO)`, construyendo el `NotificacionDTO` con los campos `id_user`, `mensaje`, `tipo_evento` y `entidad_relacionada_id` a partir del payload del evento correspondiente. Para `MESSAGE_SENT` y `USER_JOINED_GROUP` (múltiples destinatarios) usa `Promise.all(members.map(...))`. Mantén el manejo de errores con `try/catch` y el logger existente.

**Commit:** `refactor(notifications): delegar envío a estrategias desde NotificationEventListener`

**Estimación:** 1 h

---

## Tarea 8: Agregar endpoints REST para configurar preferencias de canal por usuario

**Prompt Sugerido:**
Crea `src/notifications/dto/preferencia-canal.dto.ts` con la clase `PreferenciaCanalDto` validada con class-validator: campos `tipo_evento: string`, `canal: string` y `activo: boolean`. Modifica `src/notifications/notifications.controller.ts` agregando dos endpoints bajo el guard `JwtAuthGuard` existente: `GET /notifications/preferencias` que llame a `notificationsService.obtenerPreferencias(userId)` y `PATCH /notifications/preferencias` que reciba `@Body() dto: PreferenciaCanalDto` y llame a `notificationsService.actualizarPreferencia(userId, dto.tipo_evento, dto.canal, dto.activo)`.

**Commit:** `feat(notifications): agregar endpoints GET/PATCH /notifications/preferencias para configurar canales`

**Estimación:** 0.5 h

---

## Tarea 9: Escribir tests unitarios para las estrategias y el aislamiento de errores

**Prompt Sugerido:**
Crea `src/notifications/domain/strategy/strategy.spec.ts`. Escribe suites con `describe`/`it` para: (1) `InAppWebSocketStrategy`: verifica que `canal === 'in_app_websocket'`, que `enviar()` llame a `prisma.notification.create` y a `chatGateway.server.to().emit()`, y que ante un error de Prisma devuelva `exitoso: false` con el mensaje aislado sin relanzar la excepción. (2) `EmailInstitucionalStrategy`: verifica `canal` y que retorne `exitoso: true`. (3) `PushMovilStrategy`: verifica `canal`, que con tokens vacíos retorne `exitoso: true`, que con tokens llame a la Expo API (mockea `global.fetch`), y que con respuesta `!ok` devuelva `exitoso: false`. (4) `ResumenDiarioStrategy`: verifica `canal` y `exitoso: true`. (5) Suite de aislamiento: simula una estrategia que lanza excepción junto a una que resuelve; verifica con `Promise.allSettled` que la segunda sigue ejecutándose y retorna `fulfilled`.

**Commit:** `feat(notifications): agregar 12 tests unitarios para estrategias y aislamiento de errores`

**Estimación:** 1.5 h

---

## Tarea 10: Documentar el módulo con README, diagrama UML y diagrama de secuencia

**Prompt Sugerido:**
Crea `src/notifications/README.md`. El archivo debe incluir: (1) descripción del patrón Strategy aplicado; (2) estructura de archivos del módulo; (3) diagrama UML en ASCII/Mermaid mostrando la interfaz `INotificacionStrategy`, las cuatro estrategias concretas y `NotificationsService` como contexto cliente; (4) diagrama de secuencia del flujo Observer → Strategy → canales con aislamiento de errores; (5) tabla de endpoints de preferencias con body de ejemplo; (6) instrucciones paso a paso para agregar un canal nuevo sin modificar código existente (OCP); (7) comando para ejecutar los tests del módulo.

**Commit:** `docs(notifications): documentar patrón Strategy con diagrama UML y de secuencia en README`

**Estimación:** 0.5 h

---

**Estimación total:** 7.5 h
```
