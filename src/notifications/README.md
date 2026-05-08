# Módulo de Notificaciones — Patrón Strategy

## Descripción

El módulo de notificaciones implementa el **patrón Strategy** para el envío multicanal de notificaciones. Cada canal de entrega (in-app/WebSocket, email institucional, push móvil) es una estrategia intercambiable que el `NotificationsService` recibe por inyección de dependencias. Agregar un canal nuevo no requiere modificar el servicio ni las estrategias existentes (principio Open/Closed).

---

## Estructura de archivos

```
src/notifications/
├── domain/
│   └── strategy/
│       ├── interfaces.ts                  ← INotificacionStrategy, NotificacionDTO, ResultadoEnvio
│       ├── in-app-websocket.strategy.ts   ← Guarda en BD + emite vía Socket.IO
│       ├── email-institucional.strategy.ts← Envío de email institucional
│       ├── push-movil.strategy.ts         ← Push Expo para dispositivos móviles
│       ├── resumen-diario.strategy.ts     ← Ejemplo OCP: canal nuevo sin tocar el servicio
│       ├── index.ts
│       └── strategy.spec.ts              ← Tests unitarios
├── dto/
│   ├── expo-push-token.dto.ts
│   └── preferencia-canal.dto.ts          ← PATCH /notifications/preferencias
├── listeners/
│   └── notification-event.listener.ts    ← Observer → Strategy bridge
├── notifications.controller.ts
├── notifications.module.ts
├── notifications.service.ts              ← Contexto del patrón Strategy
├── notifications.tokens.ts               ← NOTIFICACION_STRATEGIES injection token
└── README.md
```

---

## Diagrama UML

```
┌─────────────────────────────────────────────┐
│          <<interface>>                      │
│         INotificacionStrategy               │
│─────────────────────────────────────────────│
│ + canal: string                             │
│ + enviar(n: NotificacionDTO): ResultadoEnvio│
└──────────────────┬──────────────────────────┘
                   │ implements
       ┌───────────┼──────────────────┬──────────────────────┐
       ▼           ▼                  ▼                      ▼
┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────────────┐
│  InApp     │ │  Email       │ │  Push      │ │  ResumenDiario     │
│  WebSocket │ │  Institucional│ │  Movil     │ │  Strategy          │
│  Strategy  │ │  Strategy    │ │  Strategy  │ │  (ejemplo OCP)     │
│────────────│ │──────────────│ │────────────│ │────────────────────│
│ canal:     │ │ canal:       │ │ canal:     │ │ canal:             │
│ in_app_    │ │ email_       │ │ push_movil │ │ resumen_diario     │
│ websocket  │ │ institucional│ │            │ │                    │
│────────────│ │──────────────│ │────────────│ │────────────────────│
│ Persiste   │ │ Envía email  │ │ Llama Expo │ │ Encola para batch  │
│ en BD +    │ │ SMTP/SES     │ │ Push API   │ │ diario             │
│ Socket.IO  │ │              │ │            │ │                    │
└─────┬──────┘ └──────┬───────┘ └─────┬──────┘ └────────┬───────────┘
      │               │               │                  │
      └───────────────┴───────────────┴──────────────────┘
                              │ usa lista de
                              ▼
       ┌────────────────────────────────────────────────┐
       │           NotificationsService                 │
       │       (Contexto del patrón Strategy)           │
       │────────────────────────────────────────────────│
       │ - estrategias: INotificacionStrategy[]         │
       │   (inyectadas vía NOTIFICACION_STRATEGIES)     │
       │────────────────────────────────────────────────│
       │ + enviarNotificacion(n): ResultadoEnvio[]      │
       │   → filtra por preferencias de usuario         │
       │   → ejecuta cada estrategia activa             │
       │   → aísla errores con Promise.allSettled       │
       │ + obtenerPreferencias(userId)                  │
       │ + actualizarPreferencia(userId, tipo, canal,   │
       │                         activo)                │
       └────────────────────┬───────────────────────────┘
                            │ consume
                            ▼
       ┌────────────────────────────────────────────────┐
       │       NotificationEventListener                │
       │    (Patrón Observer — Sprint 3 bridge)         │
       │────────────────────────────────────────────────│
       │ @OnEvent(MESSAGE_SENT)                         │
       │ @OnEvent(GROUP_INVITATION_SENT)                │
       │ @OnEvent(GROUP_INVITATION_ACCEPTED)            │
       │ @OnEvent(USER_JOINED_GROUP)                    │
       │ @OnEvent(CONNECTION_REQUEST_SENT)              │
       │  → llama a notificationsService                │
       │    .enviarNotificacion(dto)                    │
       └────────────────────────────────────────────────┘
```

---

## Diagrama de secuencia — Envío multicanal con preferencias

```
Observer        NotificationEventListener   NotificationsService    Estrategias
   │  emite evento  │                             │                      │
   │───────────────▶│                             │                      │
   │                │  enviarNotificacion(dto)    │                      │
   │                │────────────────────────────▶│                      │
   │                │                             │ filtrarEstrategias() │
   │                │                             │ (BD: preferencias)   │
   │                │                             │──────────────┐       │
   │                │                             │◀─────────────┘       │
   │                │                             │                      │
   │                │                             │ Promise.allSettled() │
   │                │                             │─────────────────────▶│ InApp.enviar()
   │                │                             │─────────────────────▶│ Email.enviar()
   │                │                             │─────────────────────▶│ Push.enviar()
   │                │                             │                      │
   │                │                             │  [error en Email]    │
   │                │                             │◀─ rejected ──────────│
   │                │                             │◀─ fulfilled ─────────│ (InApp OK)
   │                │                             │◀─ fulfilled ─────────│ (Push OK)
   │                │                             │                      │
   │                │◀────── ResultadoEnvio[] ────│                      │
```

---

## Preferencias de canal por usuario

Cada usuario puede activar o desactivar canales por tipo de evento:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/notifications/preferencias` | `GET` | Lista preferencias del usuario autenticado |
| `/notifications/preferencias` | `PATCH` | Activa/desactiva un canal para un tipo de evento |

**Body `PATCH /notifications/preferencias`:**
```json
{
  "tipo_evento": "message",
  "canal": "email_institucional",
  "activo": false
}
```

Sin preferencias configuradas, **todas las estrategias activas se ejecutan** (comportamiento por defecto).

---

## Agregar un canal nuevo (principio Open/Closed)

1. Crear la clase e implementar `INotificacionStrategy`:
   ```typescript
   @Injectable()
   export class SlackStrategy implements INotificacionStrategy {
     readonly canal = 'slack';
     async enviar(n: NotificacionDTO): Promise<ResultadoEnvio> { ... }
   }
   ```
2. Registrar en `NotificationsModule`:
   ```typescript
   providers: [SlackStrategy, ...],
   // En la factory de NOTIFICACION_STRATEGIES agregar SlackStrategy
   ```

**No se modifica** `NotificationsService` ni ninguna estrategia existente.

---

## Aislamiento de errores

`NotificationsService.enviarNotificacion()` usa `Promise.allSettled()`: si una estrategia lanza una excepción, el error queda registrado en el log y el resto de las estrategias continúan ejecutándose. Cada `ResultadoEnvio` indica si el canal tuvo éxito.

---

## Tests

```bash
npx jest src/notifications/domain/strategy/strategy.spec.ts --verbose
```

Cubre:
- Cada estrategia concreta (`enviar()` exitoso y en error)
- Aislamiento de errores entre estrategias (`Promise.allSettled`)
- Principio Open/Closed: `ResumenDiarioStrategy` sin modificar código existente
