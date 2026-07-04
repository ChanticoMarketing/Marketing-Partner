# Estado de migración a Supabase — Marketing - Mate

**Plan maestro:** `MIGRATION-PLAN.md` | **Proyecto Supabase:** `zfuwtvbkjqczynzfdxly`

---

## Progreso: 8/9 fases completadas

```
██████████████████████████████████████████████████████████████████████████████████░  89%
Fase 0  Fase 1  Fase 2  Fase 3  Fase 4  Fase 5  Fase 6  Fase 7  Fase 8  Fase 9
```

---

## Lo completado

### Fase 0 — Preparación Supabase
Configuración inicial del proyecto en Supabase:
- Inspeccionado proyecto `Marketing - Partner` (`ACTIVE_HEALTHY`, Postgres 17, `us-east-2`)
- Habilitado `email/password` auth (ya estaba). Google OAuth pendiente de credenciales.
- Configurado `site_url` y `uri_allow_list` para desarrollo local
- Añadidas `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` al `.env`

### Fase 1 — Esquema DB en Supabase
Migración completa del esquema de Drizzle a SQL directo en Supabase:
- **27 tablas** creadas en `public` con `users.id` como UUID → `auth.users.id`
- **Sesiones y password_reset_tokens eliminadas** (Supabase las gestiona)
- **98 políticas RLS** + helper functions `can_access_project()` e `is_admin_user()`
- **Trigger `handle_new_user`** que crea perfil en `public.users` al registrarse en `auth.users`
- DB local no disponible → sin migración de datos necesaria
- Schema consolidado: eliminado `server/schema.ts` (drift), `shared/schema.ts` es el canónico
- Archivos creados: `supabase/schema.sql`, `supabase/rls.sql`

### Fase 2 — Auth → Supabase
Sistema de autenticación migrado de Passport/Express a Supabase Auth:
- **Cliente:** `useAuth()` reescrito con `supabase.auth.onAuthStateChange` + login por email/password, register con `signUp`, logout con `signOut`
- **Páginas auth** reescritas: `auth-page.tsx` (Supabase), `forgot-password.tsx` (`resetPasswordForEmail`), `reset-password.tsx` (hash token + `updateUser`), `auth-callback.tsx` (OAuth callback)
- **Regla `@cohetebrands.com → department='Cohete Brands'`** movida al trigger `handle_new_user` en DB
- **Eliminados:** `passport`, `passport-local`, `passport-google-oauth20`, `express-session`, `connect-pg-simple`, `memorystore`, `bcryptjs` + `@types/*`
- **Eliminados del server:** `simple-oauth.ts`, `auth.ts`, `googleAuth.ts`, `replitAuth.ts`
- `queryClient.ts`: eliminados `credentials: include` y redirect 401 hardcodeado

### Fase 8 — Limpieza final
Limpieza de archivos legacy y configuración obsoleta:
- **59 targets legacy eliminados** en la raíz y config antigua retirada (`migrate-*`, `deploy-*`, `fix-*`, `start-*`, backups y artefactos)
- **Eliminados:** `migrations/0000_schema.sql`, carpeta `migrations/`, `drizzle.config.ts`, `vite.config.js`, `vite.config.ts` (raíz)
- **`.env` podado** para remover `DATABASE_URL`, `SESSION_SECRET` y `ALLOW_OFFLINE_MODE`
- **`env.example` actualizado** a la plantilla mínima de runtime Supabase
- **Builds canónicos verificados:** cliente y servidor pasan
- **Nota:** persisten referencias técnicas a Drizzle en `shared/schema.ts` y exclusiones defensivas en `client/vite.config.ts`; se reportan como deuda residual, no como dependencia activa del runtime

### Fase 3 — CRUD a cliente-directo + RLS
Todos los endpoints CRUD migrados de Express a `supabase.from()` directo:
- **~50 endpoints CRUD migrados** a cliente-directo: projects, tasks, comments, assignees, time-entries, task-groups, columns, views, automation-rules, products, documents (metadata), schedules (metadata), chat (historial), users, user profile, admin users
- **~22 endpoints se quedan en Express** (IA, downloads, uploads, analytics, create-primary-account)
- `queryClient.ts`: eliminado `queryFn` default roto y `getQueryFn`
- **Creado `supabase-helpers.ts`**: mapper camelCase↔snake_case + wrapper `dbQuery()` para 27 tablas
- **3 RPCs SQL** creadas: `get_tasks_with_groups`, `get_user_stats`, `get_user_activity`
- Código muerto eliminado: `dashboard-original.tsx`, `dashboard-real-original.tsx`, `settings-simple.tsx`
- `shared/schema.ts`: eliminados `sessions` y `passwordResetTokens`

### Fase 4 — Edge Functions para IA
Endpoints de IA migrados de Express a Edge Functions (Deno):
- **8 Edge Functions** creadas y deployed:
  - `chat` — chat IA con persistencia
  - `generate-concepts` — ideas de contenido
  - `generate-schedule` — calendario de contenido (15 días)
  - `regenerate-schedule` — regenerar áreas del calendario
  - `generate-entry-image` — descripción de imagen para entry
  - `analyze-image` — análisis de imagen con Vision
  - `analyze-document` — análisis de documentos PDF/TXT
  - `apply-document-analysis` — aplicar análisis a project
- **3 módulos shared**: `ai-client.ts` (xAI/Grok), `sanitizer.ts` (anti prompt-injection), `supabase.ts` (service role + auth)
- **Cliente actualizado** (8 archivos): `supabase.functions.invoke()` en vez de `apiRequest`
- Secrets configurados: `XAI_API_KEY`, `AI_MODEL`
- Enum `ai_model` actualizado con `grok-3-mini`

### Fase 5 — Express trimado + cleanup
Servidor Express reducido al mínimo necesario:
- **Server files eliminados (15):** `ai-analyzer.ts`, `ai-sanitizer.ts`, `ai-scheduler-concepts.ts`, `ai-scheduler.ts`, `gemini-integration.ts`, `storage.ts`, `mem-storage.ts`, `db.ts`, `runtime-config.ts`, `logger.ts`, `deployment-build.ts`, `production.ts`, `replit-optimizations.ts`, `static-optimization.ts`, `test-routes.ts`
- **Sólo 3 archivos server:** `index.ts`, `routes.ts`, `vite.ts`
- `routes.ts`: 3944 → 1179 líneas, **11 endpoints** (download Excel/PDF, create-primary-account, admin users, user/stats, user/activity)
- `index.ts`: CORS simplificado (sin cookies), comentarios limpios
- **Dependencias eliminadas (14 paquetes):** `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `pg`, `postgres`, `openai`, `puppeteer`, `html-pdf-node`, `ws`, `pdf-parse`, `node-fetch`, `@sendgrid/mail`, `openid-client`, `memoizee` + tipos
- `isAuthenticated` verifica JWT de Supabase (header o query param para downloads)
- `queryClient.ts`: `apiRequest` y `uploadFile` inyectan token JWT automáticamente
- `getDownloadUrl()` para downloads con token en query param

### Fase 6 — Storage
Uploads migrados de multer/disco a Supabase Storage:
- **6 buckets creados**: `profile-images`, `cover-images`, `product-images` (públicos), `documents`, `marketing-images`, `task-attachments` (privados con RLS)
- **Cliente migrado:** `use-profile.tsx`, `profile.tsx`, `product-list.tsx`, `new-project-modal.tsx` → `supabase.storage.from().upload()` + `getPublicUrl()`
- **Eliminado de routes.ts:** multer config, `/uploads` static serving, 2 endpoints de upload (cover-image, profile-image)
- **Eliminado:** `uploadFile()` de `queryClient.ts`, carpeta `uploads/`, paquetes `multer` y `@types/multer`
- `product-list.tsx`: `src={`/uploads/...`}` → `src={product.imageUrl}`

### Fase 7 — Realtime
WebSocket reemplazado por Supabase Realtime:
- **6 tablas** añadidas a `supabase_realtime` publication con `REPLICA IDENTITY FULL`
- **Creado `use-realtime-sync.ts`**: hook genérico que suscribe a cambios en DB e invalida queries de TanStack Query
- **10 componentes** con suscripciones: tasks (board, kanban, list, calendar, task-manager), chat (copilot-drawer, project-chat), schedule-detail, project-documents (reemplaza polling), task-comments
- **Código muerto eliminado:** `vite-websocket-fix.ts`, `disable-vite-hmr.ts`, interceptores WebSocket en `main.tsx`
- `@types/ws` eliminado de devDeps

---

## Lo pendiente

### Fase 9 — Verificación final
- Login local + logout (email/password)
- Register + trigger `handle_new_user` crea perfil
- Reset password (antes roto, ahora nativo Supabase)
- CRUD: crear/editar/borrar project, task, schedule, product, document
- RLS: usuario no-miembro no ve project ajeno
- Edge Functions: chat, generate-schedule, analyze-image
- Downloads Excel/PDF
- Uploads a Storage (profile, cover, product images)
- Realtime: cambio en tasks se refleja en otro navegador

### Deuda residual detectada
- `shared/schema.ts` sigue importando `drizzle-orm` y `drizzle-zod` como esquema/tipos heredados
- `client/vite.config.ts` aún excluye `drizzle-orm`, `postgres` y `pg` como medida defensiva
- `server/index.ts` conserva referencias de observabilidad a `DATABASE_URL`, aunque ya no es parte del runtime activo
- El typecheck global sigue fallando por errores preexistentes del cliente y por el esquema compartido heredado

### Pendiente transversal
- **Google OAuth**: no configurado por falta de `GOOGLE_CLIENT_ID/SECRET`

---

## Estado actual del servidor Express

**Archivos:** `server/index.ts`, `server/routes.ts`, `server/vite.ts`

**11 endpoints activos:**
| Endpoint | Función |
|---|---|
| `GET /privacy-policy` | Archivo estático |
| `GET /terms-of-service` | Archivo estático |
| `POST /api/create-primary-account` | Bootstrap admin (service role) |
| `GET /api/admin/users` | Listar usuarios |
| `POST /api/admin/users` | Crear usuario |
| `PATCH /api/admin/users/:id` | Actualizar usuario |
| `DELETE /api/admin/users/:id` | Eliminar usuario |
| `POST /api/admin/users/:id/change-password` | Cambiar contraseña |
| `GET /api/user/stats` | Estadísticas agregadas |
| `GET /api/user/activity` | Actividad reciente |
| `GET /api/schedules/:id/download` | Excel/PDF |

**Tamaño build:** 72.6kb (desde 328kb original)

**Middleware auth:** `isAuthenticated` verifica JWT de Supabase (header `Authorization: Bearer <token>` o query param `?token=` para downloads). `isPrimaryUser` carga rol desde `public.users`.

---

## Arquitectura resultado

```
Cliente (React + supabase-js)
   │  ├─ Auth: supabase.auth (useAuth, signInWithPassword, signInWithOAuth, resetPasswordForEmail)
   │  ├─ CRUD directo: supabase.from('projects').select().insert().update().delete()
   │  ├─ Realtime: useRealtimeSync → supabase.channel().on('postgres_changes')
   │  ├─ Storage: supabase.storage.from('profile-images').upload()
   │  └─ Edge: supabase.functions.invoke('chat')

   ├──► Supabase (zfuwtvbkjqczynzfdxly)
   │      ├─ Auth: email/password + reset nativo
   │      ├─ DB: 27 tablas con RLS (98 policies)
   │      ├─ Realtime: 6 tablas en publication
   │      ├─ Storage: 6 buckets (3 públicos, 3 privados con RLS)
   │      └─ Edge Functions (8): chat, generate-concepts, generate-schedule,
   │         regenerate-schedule, generate-entry-image, analyze-image,
   │         analyze-document, apply-document-analysis

   └──► Express (72.6kb, 11 endpoints)
          ├─ Downloads Excel/PDF
          ├─ Admin users CRUD
          ├─ Create primary account (service role)
          └─ User stats/activity
```

---

## Dependencias clave

**Agregadas:** `@supabase/supabase-js`, `@supabase/ssr`

**Eliminadas (20+):** `passport`, `passport-local`, `passport-google-oauth20`, `express-session`, `connect-pg-simple`, `memorystore`, `bcryptjs`, `drizzle-orm`, `drizzle-zod`, `drizzle-kit`, `pg`, `postgres`, `openai`, `puppeteer`, `html-pdf-node`, `ws`, `pdf-parse`, `node-fetch`, `@sendgrid/mail`, `openid-client`, `memoizee`, `multer` + `@types/*`

**Builds:** Server 72.6kb (-78%), Client 1,547kb (sin cambios significativos)

---

## Archivos creados durante la migración

| Archivo | Fase |
|---|---|
| `MIGRATION-PLAN.md` | Plan maestro |
| `MIGRATION-STATUS.md` | Este documento |
| `supabase/schema.sql` | Fase 1 — Schema DB |
| `supabase/rls.sql` | Fase 1 — RLS policies |
| `supabase/rpcs.sql` | Fase 3 — RPCs |
| `client/src/lib/supabase.ts` | Fase 2 — Cliente browser |
| `client/src/lib/supabase-helpers.ts` | Fase 3 — Mapper camelCase↔snake_case |
| `client/src/hooks/use-realtime-sync.ts` | Fase 7 — Hook Realtime |
| `client/src/pages/auth-callback.tsx` | Fase 2 — OAuth callback |
| `client/src/vite-env.d.ts` | Fase 2 — Tipos Vite |
| `supabase/functions/_shared/ai-client.ts` | Fase 4 — Módulo IA |
| `supabase/functions/_shared/sanitizer.ts` | Fase 4 — Anti prompt-injection |
| `supabase/functions/_shared/supabase.ts` | Fase 4 — Service role + auth |
| `supabase/functions/chat/index.ts` | Fase 4 |
| `supabase/functions/generate-concepts/index.ts` | Fase 4 |
| `supabase/functions/generate-schedule/index.ts` | Fase 4 |
| `supabase/functions/regenerate-schedule/index.ts` | Fase 4 |
| `supabase/functions/generate-entry-image/index.ts` | Fase 4 |
| `supabase/functions/analyze-image/index.ts` | Fase 4 |
| `supabase/functions/analyze-document/index.ts` | Fase 4 |
| `supabase/functions/apply-document-analysis/index.ts` | Fase 4 |

### Archivos server conservados
| Archivo | Estado |
|---|---|
| `server/index.ts` | Limpio (sin session/passport) |
| `server/routes.ts` | Trimado: 3944 → 1179 líneas, 11 endpoints |
| `server/vite.ts` | Sin cambios |
