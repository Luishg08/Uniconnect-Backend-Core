# US-CH01 — Chain of Responsibility en publicación de mensajes

## Actividades realizadas

---

### 1. Definir interfaz `IValidadorMensajeHandler` y tipo `ResultadoValidacion`

**Prompt sugerido:**
> Crea la interfaz `IValidadorMensajeHandler` con los métodos `setSiguiente(handler): IValidadorMensajeHandler` y `manejar(mensaje: MessageDto): ResultadoValidacion`. Crea también la interfaz `ResultadoValidacion` con `valido: boolean`, `codigoError?: string` y `mensaje?: string`. Ubícalas en `src/messages/domain/chain-of-responsibility/interfaces/` y exporta un `index.ts`. Agrega también la clase abstracta `ValidadorMensajeAbstracto` que implemente la lógica de delegación al siguiente handler.

**Commit convencional:**
```
feat(chat): definir IValidadorMensajeHandler, ResultadoValidacion y clase abstracta base CoR
```

**Tiempo estimado:** 1 h

---

### 2. Implementar los cinco handlers concretos

**Prompt sugerido:**
> Implementa los siguientes handlers en `src/messages/domain/chain-of-responsibility/handlers/`, todos extendiendo `ValidadorMensajeAbstracto`:
> - `ValidarTamanoHandler`: rechaza si `text_content` supera 500 caracteres → código `MSG_TAMANO_EXCEDIDO`.
> - `ValidarContenidoHandler`: rechaza si el texto está vacío (`MSG_CONTENIDO_VACIO`) o contiene palabras prohibidas reutilizando `findProhibitedWord` de `content-moderation.decorator.ts` → código `MSG_CONTENIDO_INAPROPIADO`.
> - `ValidarMencionesHandler`: rechaza si hay más de 10 menciones (`MSG_MENCIONES_EXCEDIDAS`) o algún `userId <= 0` (`MSG_MENCIONES_INVALIDAS`).
> - `ValidarPermisosHandler`: rechaza si no hay `sender_id` válido o no existe `id_membership` ni `recipient_id` → código `MSG_PERMISOS_INSUFICIENTES`.
> - `ValidarAdjuntoHandler`: rechaza si algún archivo supera 10 MB (`MSG_ADJUNTO_TAMANO_EXCEDIDO`) o tiene un MIME type no permitido (`MSG_ADJUNTO_TIPO_NO_PERMITIDO`).
> Exporta todos desde un `index.ts`.

**Commit convencional:**
```
feat(chat): implementar handlers concretos ValidarTamano, ValidarContenido, ValidarMenciones, ValidarPermisos y ValidarAdjunto
```

**Tiempo estimado:** 2 h

---

### 3. Crear `ValidacionChainFactory` como composition root

**Prompt sugerido:**
> Crea `ValidacionChainFactory` en `src/messages/domain/chain-of-responsibility/validacion-chain.factory.ts`. Debe exponer un método estático `crearCadena(opciones?: ValidacionChainOptions): IValidadorMensajeHandler` que construya la cadena en este orden explícito: `ValidarTamano → ValidarContenido → ValidarMenciones → ValidarPermisos → ValidarAdjunto` (este último opcional mediante `incluirValidacionAdjunto`). Ningún handler existente debe modificarse si se cambia el orden o se agrega uno nuevo.

**Commit convencional:**
```
feat(chat): crear ValidacionChainFactory como composition root de la cadena CoR
```

**Tiempo estimado:** 0.5 h

---

### 4. Integrar la cadena en `MessagesService` y registrarla en `MessagesModule`

**Prompt sugerido:**
> En `src/messages/application/messages.service.ts`, inyecta `IValidadorMensajeHandler` mediante el token `VALIDACION_CHAIN_TOKEN` usando `@Inject`. Al inicio de `sendMessage()`, llama a `this.validacionChain.manejar(messageDto)`; si `resultado.valido === false`, lanza `BadRequestException` con el mensaje del handler. En `messages.module.ts`, registra el proveedor `{ provide: VALIDACION_CHAIN_TOKEN, useFactory: () => ValidacionChainFactory.crearCadena() }`.

**Commit convencional:**
```
feat(chat): integrar cadena CoR en MessagesService y registrar factory en MessagesModule
```

**Tiempo estimado:** 1 h

---

### 5. Tests unitarios de los handlers y la factory

**Prompt sugerido:**
> Escribe tests Jest en `src/messages/domain/chain-of-responsibility/__tests__/` para cada handler y para `ValidacionChainFactory`. Cada suite de handler debe cubrir: aprobación, rechazo con código específico, y delegación al siguiente. La suite de la factory debe incluir: caso exitoso completo, un caso de cortocircuito por cada handler, y la demostración de extensibilidad (cadena sin `ValidarAdjuntoHandler` acepta un MIME no permitido).

**Commit convencional:**
```
feat(chat): agregar tests unitarios para los cinco handlers y la ValidacionChainFactory
```

**Tiempo estimado:** 2 h

---

### 6. Documentar el patrón en el README del módulo

**Prompt sugerido:**
> Crea `src/messages/README.md`. Documenta el patrón Chain of Responsibility implementado en US-CH01: incluye un diagrama UML de clases en ASCII/Mermaid mostrando `IValidadorMensajeHandler`, `ValidadorMensajeAbstracto` y los cinco handlers concretos; un diagrama de secuencia del caso exitoso (el mensaje atraviesa toda la cadena y llega al `ChatSubject`); un diagrama de secuencia del caso con cortocircuito (el handler que detecta el error devuelve `ResultadoValidacion` fallido y los handlers posteriores no se ejecutan); y una tabla de códigos de error. Incluye también la guía de extensibilidad.

**Commit convencional:**
```
docs(chat): documentar patrón CoR en README con diagramas UML y de secuencia
```

**Tiempo estimado:** 1.5 h

---

## Resumen

| # | Tarea | Commit | Horas |
|---|-------|--------|-------|
| 1 | Interfaces y clase abstracta base | `feat(chat): definir IValidadorMensajeHandler...` | 1 h |
| 2 | Cinco handlers concretos | `feat(chat): implementar handlers concretos...` | 2 h |
| 3 | Factory (composition root) | `feat(chat): crear ValidacionChainFactory...` | 0.5 h |
| 4 | Integración en ServicesService y módulo | `feat(chat): integrar cadena CoR...` | 1 h |
| 5 | Tests unitarios (33 tests, 6 suites) | `feat(chat): agregar tests unitarios...` | 2 h |
| 6 | README con UML y diagramas de secuencia | `docs(chat): documentar patrón CoR...` | 1.5 h |
| | **Total** | | **8 h** |
