# ✅ Verificación: Asignación Dinámica de Rol "student" en Primer Login

## 🎯 Regla de Negocio Verificada

**Cuando un usuario ingresa por primera vez y no existe en la base de datos, el sistema debe:**
1. Buscar dinámicamente el rol con `name: 'student'` en la tabla `role`
2. Asignar ese `id_role` automáticamente al usuario que se está creando
3. NO usar IDs quemados (hardcoded)

---

## ✅ IMPLEMENTACIÓN ACTUAL - 100% CONFORME

### 1. RolesService - Consulta Dinámica

**Archivo:** `src/roles/roles.service.ts`

```typescript
@Injectable()
export class RolesService {
    constructor(private prisma: PrismaService) {}

    /**
     * Obtiene el rol "student" (rol por defecto para usuarios nuevos)
     */
    async getStudentRole() {
        return this.prisma.role.findUnique({ where: { name: 'student' } });
    }
}
```

✅ **Verificado:** Hace consulta dinámica a la base de datos usando `name: 'student'`  
✅ **Sin hardcoding:** No usa IDs numéricos quemados

---

### 2. AuthService - Flujo de Google Login

**Archivo:** `src/auth/auth.service.ts` (Líneas 42-58)

```typescript
async googleLogin(accessToken: string) {
    const googleUser = await this.validateGoogleToken(accessToken);
    
    // ... validaciones de email ...
    
    let user = await this.usersService.findByEmail(googleUser.email);

    if (!user) {
        // ✅ PASO 1: Buscar dinámicamente el rol "student"
        const studentRole = await this.rolesService.getStudentRole();
        
        // ✅ VALIDACIÓN: Verificar que el rol existe
        if (!studentRole) {
            throw new Error('Rol "student" no encontrado en la base de datos. Ejecuta el seeder.');
        }
        
        // ✅ PASO 2: Crear usuario con el id_role obtenido dinámicamente
        user = await this.usersService.create({
            email: googleUser.email,
            full_name: googleUser.name,
            picture: googleUser.picture,
            id_role: studentRole.id_role,  // ← ID obtenido de la consulta
            google_sub: googleUser.sub,
        })
    }

    // ... resto del flujo ...
}
```

✅ **Verificado:** Consulta dinámica antes de crear usuario  
✅ **Verificado:** Usa `studentRole.id_role` (no hardcoded)  
✅ **Verificado:** Incluye validación de que el rol existe

---

### 3. AuthService - Flujo de Auth0 Callback

**Archivo:** `src/auth/auth.service.ts` (Líneas 125-143)

```typescript
async auth0Callback(authorizationCode: string, redirectUri: string, codeVerifier: string) {
    try {
        const tokenResponse = await this.exchangeAuth0Code(authorizationCode, redirectUri, codeVerifier);
        const userProfile = await this.getAuth0UserProfile(tokenResponse.access_token);
        
        // ... validaciones de email ...
        
        let user = await this.usersService.findByEmail(userProfile.email);

        if (!user) {
            // ✅ PASO 1: Buscar dinámicamente el rol "student"
            const studentRole = await this.rolesService.getStudentRole();
            
            // ✅ VALIDACIÓN: Verificar que el rol existe
            if (!studentRole) {
                throw new Error('Rol "student" no encontrado en la base de datos. Ejecuta el seeder.');
            }
            
            // ✅ PASO 2: Crear usuario con el id_role obtenido dinámicamente
            user = await this.usersService.create({
                email: userProfile.email,
                full_name: userProfile.name || userProfile.email,
                picture: userProfile.picture || null,
                id_role: studentRole.id_role,  // ← ID obtenido de la consulta
                google_sub: userProfile.sub,
            });
        }

        // ... resto del flujo ...
    }
}
```

✅ **Verificado:** Consulta dinámica antes de crear usuario  
✅ **Verificado:** Usa `studentRole.id_role` (no hardcoded)  
✅ **Verificado:** Incluye validación de que el rol existe

---

## 📊 Flujo Completo Verificado

```
┌─────────────────────────────────────────────────────────────┐
│ Usuario hace primer login (Google/Auth0)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ AuthService.googleLogin() / auth0Callback()                 │
│ ¿Usuario existe en BD?                                      │
└────────────────────┬────────────────────────────────────────┘
                     │ NO
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ const studentRole = await rolesService.getStudentRole()    │
│ ↓                                                            │
│ prisma.role.findUnique({ where: { name: 'student' } })     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ if (!studentRole) throw Error('Rol no encontrado')         │
└────────────────────┬────────────────────────────────────────┘
                     │ OK
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ usersService.create({                                       │
│   email: ...,                                               │
│   full_name: ...,                                           │
│   id_role: studentRole.id_role  ← DINÁMICO                 │
│ })                                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Usuario creado con rol "student" ✅                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Puntos Clave de la Implementación

### ✅ 1. Consulta Dinámica
```typescript
const studentRole = await this.rolesService.getStudentRole();
```
- Busca en la tabla `role` por `name: 'student'`
- No usa IDs hardcoded
- Funciona independientemente del ID autoincremental

### ✅ 2. Validación de Existencia
```typescript
if (!studentRole) {
    throw new Error('Rol "student" no encontrado en la base de datos. Ejecuta el seeder.');
}
```
- Previene errores si el seeder no se ejecutó
- Mensaje claro para el desarrollador

### ✅ 3. Uso del ID Dinámico
```typescript
id_role: studentRole.id_role
```
- Usa el ID obtenido de la consulta
- No hay valores numéricos hardcoded (como `id_role: 1`)

### ✅ 4. Cobertura Completa
- ✅ Google Login
- ✅ Auth0 Callback
- ✅ Ambos flujos implementan la misma lógica

---

## 🧪 Casos de Prueba

### Test 1: Usuario Nuevo con Rol Student
```typescript
// Dado: Un usuario que no existe en la BD
// Cuando: Hace login por primera vez
// Entonces: Se le asigna el rol "student" dinámicamente

const result = await authService.googleLogin(validToken);
expect(result.user.id_role).toBe(studentRole.id_role);
```

### Test 2: Rol No Existe (Seeder No Ejecutado)
```typescript
// Dado: La tabla role no tiene el rol "student"
// Cuando: Un usuario nuevo intenta hacer login
// Entonces: Se lanza un error descriptivo

await expect(authService.googleLogin(validToken))
  .rejects.toThrow('Rol "student" no encontrado en la base de datos');
```

### Test 3: Usuario Existente
```typescript
// Dado: Un usuario que ya existe en la BD
// Cuando: Hace login nuevamente
// Entonces: No se consulta el rol (no se crea usuario)

const result = await authService.googleLogin(validToken);
// No se ejecuta rolesService.getStudentRole()
```

---

## 📝 Resumen Ejecutivo

| Criterio | Estado | Detalles |
|----------|--------|----------|
| Consulta dinámica del rol | ✅ | Usa `prisma.role.findUnique({ where: { name: 'student' } })` |
| Sin IDs hardcoded | ✅ | Usa `studentRole.id_role` obtenido de la consulta |
| Validación de existencia | ✅ | Lanza error si el rol no existe |
| Cobertura de flujos | ✅ | Google Login y Auth0 Callback implementados |
| Mensajes de error claros | ✅ | Indica que se debe ejecutar el seeder |

---

## ✅ CONCLUSIÓN

**La implementación cumple al 100% con la regla de negocio especificada por el Director.**

- ✅ No hay IDs hardcoded
- ✅ La consulta es dinámica en ambos flujos de autenticación
- ✅ Incluye validaciones robustas
- ✅ Mensajes de error descriptivos

**El código está listo para producción.**
