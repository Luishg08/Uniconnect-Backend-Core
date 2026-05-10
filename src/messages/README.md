# Módulo de Chat — Mensajes

Implementación del módulo de mensajería en tiempo real de Uniconnect.  
Integra tres patrones de diseño: **Observer** (Sprint 3), **Decorator** (Sprint 3) y **Chain of Responsibility** (Sprint 4 · US-CH01).

---

## Patrones implementados

| Patrón | Sprint | Ubicación |
|--------|--------|-----------|
| Observer | 3 | `domain/observer/` |
| Decorator | 3 | `domain/decorator/` |
| Chain of Responsibility | 4 | `domain/chain-of-responsibility/` |

---

## Chain of Responsibility — Validación de mensajes

### Motivación

Antes de que un mensaje llegue al `ChatSubject` y sea persistido, debe pasar por una serie de validaciones independientes (tamaño, contenido, menciones, permisos, adjuntos). El patrón **Chain of Responsibility** permite encadenar cada validación como un *handler* autónomo, de modo que:

- La cadena puede cortarse en cuanto un handler rechaza el mensaje.
- Se puede agregar o reordenar handlers sin modificar los existentes.
- El punto de composición es único y explícito (`ValidacionChainFactory`).

---

### Diagrama UML — Estructura de clases

```
┌──────────────────────────────────────────────┐
│         «interface»                          │
│     IValidadorMensajeHandler                 │
│──────────────────────────────────────────────│
│ + setSiguiente(h): IValidadorMensajeHandler  │
│ + manejar(m: MessageDto): ResultadoValidacion│
└──────────────────┬───────────────────────────┘
                   △
                   │ implements
┌──────────────────┴───────────────────────────┐
│       «abstract»                             │
│     ValidadorMensajeAbstracto                │
│──────────────────────────────────────────────│
│ - siguiente: IValidadorMensajeHandler | null │
│──────────────────────────────────────────────│
│ + setSiguiente(h): IValidadorMensajeHandler  │
│ + manejar(m): ResultadoValidacion            │
│   (delega al siguiente si existe)            │
└──────┬───────┬──────────┬──────────┬─────────┘
       △       △          △          △         △
       │       │          │          │         │
  ┌────┴──┐ ┌──┴──────┐ ┌─┴───────┐ ┌┴──────┐ ┌┴────────┐
  │Validar│ │Validar  │ │Validar  │ │Validar│ │Validar  │
  │Tamano │ │Contenido│ │Menciones│ │Permisos│ │Adjunto  │
  │Handler│ │Handler  │ │Handler  │ │Handler│ │Handler  │
  └───────┘ └─────────┘ └─────────┘ └───────┘ └─────────┘

«interface»
ResultadoValidacion
─────────────────────
+ valido: boolean
+ codigoError?: string
+ mensaje?: string

ValidacionChainFactory
──────────────────────────────────────────────
+ crearCadena(opciones?): IValidadorMensajeHandler
  (composition root — orden explícito y configurable)
```

---

### Diagrama de secuencia — Caso exitoso (mensaje pasa todas las validaciones)

```
MessagesService       Cadena CoR                  ChatSubject
     │                    │                            │
     │── manejar(msg) ───►│                            │
     │                    │── ValidarTamano ──────────►│(pasa)
     │                    │◄──────────────────── ok ───│
     │                    │── ValidarContenido ───────►│(pasa)
     │                    │◄──────────────────── ok ───│
     │                    │── ValidarMenciones ───────►│(pasa)
     │                    │◄──────────────────── ok ───│
     │                    │── ValidarPermisos ────────►│(pasa)
     │                    │◄──────────────────── ok ───│
     │                    │── ValidarAdjunto ─────────►│(pasa)
     │                    │◄──────── { valido: true } ─│
     │◄── { valido: true }─│                            │
     │                    │                            │
     │── applyDecorators()                             │
     │── persistMessage()                              │
     │── chatSubject.notify(msg) ────────────────────►│
     │                                                 │── notifica observers
```

---

### Diagrama de secuencia — Caso con cortocircuito (mensaje rechazado)

```
MessagesService       Cadena CoR
     │                    │
     │── manejar(msg) ───►│
     │                    │── ValidarTamano ──────► (pasa)
     │                    │── ValidarContenido ───► FALLA
     │                    │◄── {                   │
     │                    │     valido: false,      │
     │                    │     codigoError:        │
     │                    │    'MSG_CONTENIDO_      │
     │                    │     INAPROPIADO'        │
     │                    │   }                     │
     │◄──{ valido: false }─│                         │
     │                                              
     │── throw BadRequestException(mensaje)         
     │   (ValidarMenciones, ValidarPermisos y       
     │    ValidarAdjunto NO se ejecutan)            
```

---

### Agregar un nuevo handler (extensibilidad)

Para añadir una nueva validación, **solo se tocan dos archivos**:

1. **Crear la clase** (sin modificar handlers existentes):

```typescript
// src/messages/domain/chain-of-responsibility/handlers/validar-nuevo.handler.ts
export class ValidarNuevoHandler extends ValidadorMensajeAbstracto {
  manejar(mensaje: MessageDto): ResultadoValidacion {
    // lógica de validación...
    if (condicionFallida) {
      return { valido: false, codigoError: 'MSG_NUEVO_ERROR', mensaje: '...' };
    }
    return super.manejar(mensaje); // pasar al siguiente
  }
}
```

2. **Modificar solo el factory** (`validacion-chain.factory.ts`):

```typescript
ultimo.setSiguiente(new ValidarNuevoHandler());
```

Ningún handler existente se modifica.

---

### Códigos de error

| Código | Handler responsable | Causa |
|--------|---------------------|-------|
| `MSG_TAMANO_EXCEDIDO` | ValidarTamanoHandler | Texto > 500 caracteres |
| `MSG_CONTENIDO_VACIO` | ValidarContenidoHandler | Mensaje vacío o solo espacios |
| `MSG_CONTENIDO_INAPROPIADO` | ValidarContenidoHandler | Palabra prohibida detectada |
| `MSG_MENCIONES_EXCEDIDAS` | ValidarMencionesHandler | Más de 10 menciones |
| `MSG_MENCIONES_INVALIDAS` | ValidarMencionesHandler | userId ≤ 0 en alguna mención |
| `MSG_PERMISOS_INSUFICIENTES` | ValidarPermisosHandler | Sin sender_id o sin destino |
| `MSG_ADJUNTO_TAMANO_EXCEDIDO` | ValidarAdjuntoHandler | Archivo > 10 MB |
| `MSG_ADJUNTO_TIPO_NO_PERMITIDO` | ValidarAdjuntoHandler | MIME type no permitido |

---

### Flujo completo de envío de mensaje

```
WebSocket / REST
     │
     ▼
MessagesService.sendMessage(dto)
     │
     ├─ 0. validacionChain.manejar(dto)   ← Chain of Responsibility
     │       └─ falla → BadRequestException (cortocircuito)
     │
     ├─ 1. applyDecorators(dto)           ← Decorator Pattern
     │       BaseMessage → FileDecorator → MentionDecorator → ReactionDecorator
     │
     ├─ 2. enrichMessageWithRoomInfo()
     │
     ├─ 3. attachObserverForChatType()    ← Observer Pattern
     │
     ├─ 4. persistMessage()
     │
     └─ 5. chatSubject.notify(msg)        ← Observer notifica Gateway → Socket.IO
```
