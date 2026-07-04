# Plan de migración a Supabase — Marketing - Mate

Estado actual del repositorio al 2026-07-02:
- Fases 0 a 8 implementadas a nivel de código y limpieza del repo.
- Fase 9 pendiente de verificación E2E real y cierre final.
- El login web quedó alineado a Supabase Auth con `email/password`; ya no se intenta resolver `username` antes de autenticar.
- Persisten referencias heredadas a Drizzle en `shared/schema.ts`, por lo que la migración no debe considerarse cerrada al 100% todavía.

## Decisiones adoptadas

1. **Arquitectura:** Híbrido thin-backend (auth + CRUD → Supabase; Express sólo para lógica pesada).
2. **Acceso a datos:** Migrar a `supabase-js` + RLS (eliminar Drizzle).
3. **IDs de usuario:** Añadir columna UUID → `auth.users.id`, backfill con mapeo Google-id→UUID, eliminar PK VARCHAR al final.
4. **Lógica pesada:** Express Node serverless aparte (Puppeteer/ExcelJS/scheduler IA latencia larga).

## Arquitectura final

```
Cliente (React + supabase-js)
   │  ├─ Auth: @supabase/ssr + useUser()
   │  ├─ CRUD directo: supabase.from() + RLS
   │  ├─ Storage: uploads directos a buckets
   │  └─ Realtime: supabase.channel() (reemplaza /ws)
   │
   ├──► Supabase (project zfuwtvbkjqczynzfdxly)
   │      ├─ Auth (Google OAuth + email/password + reset nativo)
   │      ├─ Postgres + RLS (28 tablas, sin sessions/password_reset_tokens)
   │      ├─ Edge Functions (Deno): /schedule, /concepts, /chat, /analyze-image, /generate-tasks
   │      └─ Storage (6 buckets)
   │
   └──► Express Node serverless (servicio aparte)
          ├─ /schedule (orquestación IA larga)
          ├─ /download (Excel/PDF con Puppeteer/ExcelJS)
          └─ valida JWT Supabase + service role para DB
```

---

## Fase 0 — Preparación Supabase
**Verifica:** MCP responde config, auth providers habilitados.

- [ ] Inspeccionar proyecto vía MCP: extensions, auth providers, buckets actuales.
- [ ] Habilitar Auth providers: **Google OAuth** (mover `GOOGLE_CLIENT_ID/SECRET` a Supabase), **email/password**, **reset por email**.
- [ ] Configurar URLs de redirect (`http://localhost:5173`, dominio prod) y plantilla de email de reset.
- [ ] Definir secrets en Supabase: `XAI_API_KEY`, `GROK_API_KEY`, `PRIMARY_ACCOUNT_SECRET`.
- [ ] Variables nuevas en `.env`/`env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Fase 1 — Esquema de DB en Supabase
**Verifica:** `\dt` muestra 28 tablas + `auth.users`.

- [ ] Consolidar schema: **eliminar `server/schema.ts`** (desfasado), usar sólo `shared/schema.ts`.
- [ ] Generar SQL inicial: `drizzle-kit generate` una última vez → aplicar en Supabase vía SQL editor (o MCP). Después se elimina Drizzle.
- [ ] **Migración `users.id`:**
  - Crear `auth.users` (Supabase lo gestiona).
  - En tabla `users` de negocio: añadir `id_uuid uuid` referencing `auth.users.id`; renombrar `id` → `legacy_google_id varchar` (mantener durante backfill).
  - Backfill: script que crea usuarios en `auth.users` (`admin.createUser`) por cada `users` existente (email), mapea `legacy_google_id → id_uuid`, actualiza todas las FKs (`projects.created_by`, `tasks.assignee`, `project_members.user_id`, etc.) al UUID.
  - Al final: `id_uuid` pasa a ser PK, drop `legacy_google_id` y `sessions`, `password_reset_tokens`.
- [ ] RLS **habilitada en todas las tablas** + policies (ver sección RLS).
- [ ] Migrar datos existentes (export → import con mapeo de IDs).

---

## Fase 2 — Auth → Supabase
**Verifica:** login local + Google + reset funcionan E2E.

- [ ] Instalar `@supabase/supabase-js`, `@supabase/ssr`.
- [ ] Crear `client/src/lib/supabase.ts` (browser client) y server client para Edge.
- [ ] Reescribir `client/src/hooks/use-auth.tsx` → `useUser()` + `signInWithPassword` / `signInWithOAuth('google')` / `signUp` / `resetPasswordForEmail`.
- [ ] Reescribir `client/src/pages/auth-page.tsx`, `forgot-password.tsx`, `reset-password.tsx` con flujos nativos Supabase (el reset **ahora funciona**).
- [ ] `client/src/lib/protected-route.tsx` → sesión Supabase.
- [ ] `client/src/lib/queryClient.ts` → quitar `credentials: include` y redirect 401 hardcodeado; inyectar `Authorization: Bearer <token>` desde sesión.
- [ ] **Regla `@cohetebrands.com → department='Cohete Brands'`** (`server/simple-oauth.ts:257-288`): mover a trigger DB `on auth.users insert` o Edge Function post-signup.
- [ ] Eliminar: `passport`, `passport-local`, `passport-google-oauth20`, `express-session`, `connect-pg-simple`, `memorystore`, `bcryptjs`, `server/simple-oauth.ts`, `server/auth.ts`, `server/googleAuth.ts`, `server/replitAuth.ts`.

---

## Fase 3 — CRUD a cliente-directo + RLS
**Verifica:** cada recurso CRUD pasa con user auth y falla sin permiso.

- [ ] Reemplazar `apiRequest`/`getQueryFn` por `supabase.from('table')...` en hooks/páginas, recurso por recurso:
  - projects, tasks (subtasks/comments/attachments/assignees/dependencies), task-groups, columns, column-values
  - schedules (metadata), schedule-entries, documents (metadata), products
  - tags, views, automation-rules, time-entries, notifications, members, collaborative-docs
  - user profile, user settings, user stats/activity, users list
- [ ] Eliminar `server/storage.ts` y `server/mem-storage.ts` del path del cliente (keep service-role en Express serverless).
- [ ] Validar cada policy con usuario no-miembro (debe recibir 0 filas / error).

---

## Fase 4 — Edge Functions para IA
**Verifica:** `/schedule` genera calendario, `/chat` responde.

- [ ] Migrar a Edge Functions (Deno, TS):
  - `generate-schedule` ← `server/ai-scheduler.ts:generateSchedule`
  - `generate-concepts` ← `server/ai-scheduler-concepts.ts`
  - `chat` ← `server/ai-analyzer.ts:processChatMessage`
  - `analyze-image` ← `server/ai-analyzer.ts:analyzeMarketingImage` (Vision)
  - `generate-tasks` ← `server/routes.ts:3010`
  - `analyze-document` (parse PDF + IA) ← `server/routes.ts:1276`
- [ ] Mover `server/gemini-integration.ts` (xAI/Grok) a módulo Deno; secrets desde Supabase.
- [ ] Cliente invoca Edge Functions vía `supabase.functions.invoke()`.
- [ ] **Nota:** el scheduler (1602 líneas, latencia larga) puede exceder timeout de Edge → si pasa, dejarlo en el Express serverless (Fase 5) en vez de Edge.

---

## Fase 5 — Express Node serverless para pesado
**Verifica:** `/download` entrega Excel y PDF.

- [ ] Servicio Node mínimo (`/services/heavy/`) con endpoints:
  - `POST /schedule` (orquestación IA larga, si no cabe en Edge)
  - `GET /download/:scheduleId` (ExcelJS + Puppeteer/html-pdf-node)
- [ ] Middleware auth: `supabase.auth.getUser(token)` del header `Authorization`.
- [ ] DB: `supabase-js` con **service role key** (sólo servidor).
- [ ] Deploy: Render/Railway/Fly (Puppeteer necesita Chromium, no corre en Edge).
- [ ] CORS estricto al dominio del cliente.

---

## Fase 6 — Storage
**Verifica:** upload y lectura de cada bucket con RLS.

- [ ] Crear buckets: `documents`, `profile-images`, `cover-images`, `marketing-images`, `product-images`, `task-attachments`.
- [ ] Reemplazar `multer` (`server/routes.ts:127-209`) por uploads directos del cliente con URLs firmadas + RLS por carpeta/proyecto.
- [ ] Migrar archivos existentes en `uploads/` (~10+ PDFs/IMG) a buckets.
- [ ] Eliminar `multer`, `@types/multer`, carpeta `uploads/` del repo.

---

## Fase 7 — Realtime
**Verifica:** cambio en tasks se refleja en otro navegador sin refresh.

- [ ] Reemplazar `/ws` (`server/routes.ts:3348-3381`, esquelético/muerto) por `supabase.channel().on('postgres_changes', ...)`.
- [ ] Suscripciones cliente en tasks, schedule-entries, chat-messages, collaborative-docs.
- [ ] Eliminar `ws`, `@types/ws` del server.

---

## Fase 8 — Limpieza
**Verifica:** `tsc --noEmit` pasa, sin imports huérfanos.

- [ ] Eliminar código muerto: `replit-optimizations.ts`, `static-optimization.ts`, `deployment-build.ts`, `production.ts`, `test-routes.ts`, `runtime-config.ts` (si ya no hay sesión Express), `logger.ts` (si Edge usa su logger).
- [ ] Eliminar ~21 `migrate-*.{js,cjs,ts,mjs}` sueltos + `migrate.js` + ~10 `*-deploy*.{cjs,js}` + `fix-*.js` + `update-user-admin.js` en raíz.
- [ ] Eliminar `migrations/0000_schema.sql` y `drizzle.config.ts`, `drizzle-orm`, `drizzle-kit`, `drizzle-zod`, `postgres`, `pg`.
- [ ] Eliminar `vite.config.js`, `vite.config.ts` (raíz, no usados), `package*.json` backups.
- [ ] Actualizar `package.json` scripts (`dev` → cliente Vite + serverless; `build`; quitar `db:push`, `deploy:replit`).
- [ ] Regenerar `SESSION_SECRET` / eliminar (ya no hay sesión Express en el cliente).

---

## Fase 9 — Verificación final
**Verifica:** todos los flujos críticos E2E.

- [ ] Login local + Google OAuth + logout.
- [ ] Reset password (antes roto, ahora nativo Supabase).
- [ ] CRUD: crear/editar/borrar project, task, schedule, product, document.
- [ ] RLS: usuario no-miembro no ve project ajeno (test con 2 cuentas).
- [ ] Generación de schedule (Edge o serverless) + descarga Excel/PDF.
- [ ] Uploads a Storage (profile image, document, marketing image).
- [ ] Realtime en tasks.
- [ ] Migración de datos existentes completada (conteo de filas antes/después).

---

## Políticas RLS (alto nivel)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `users` (perfil público) | limitado público | — | `auth.uid() = id` | — |
| `users` (admin) | service role | service role | service role | service role |
| `projects` | creador / `isPrimary` / admin / miembro / asignado | authenticated | creador / admin / `isPrimary` | creador / admin / `isPrimary` |
| `tasks`, `task_comments`, `task_attachments`, `task_assignees`, `task_dependencies` | miembros del `project_id` padre | miembros | miembros | creador / admin |
| `schedules`, `schedule_entries` | miembros del `project_id` padre | miembros | miembros | creador / admin |
| `documents`, `products`, `tags`, `views`, `automation_rules`, `task_groups`, `project_column_settings`, `task_column_values`, `collaborative_docs`, `analysis_results` | miembros del `project_id` padre | miembros | miembros | creador / admin |
| `chat_messages` | miembros del `project_id` padre | miembros | autor del mensaje | — |
| `notifications` | `auth.uid() = user_id` | service role / Edge | `auth.uid() = user_id` | — |
| `user_settings` | `auth.uid() = user_id` | — | `auth.uid() = user_id` | — |
| `time_entries`, `activity_log` | miembros del proyecto | service role / Edge | — | — |
| `project_members`, `project_assignments` | miembros del proyecto | admin / `isPrimary` | admin / `isPrimary` | admin / `isPrimary` |

- `sessions`, `password_reset_tokens`: **eliminadas** (Supabase gestiona ambas nativamente).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `users.id` VARCHAR → UUID rompe FKs | Fase 1 con ventana dual + backfill verificado antes de cutover |
| Sesiones `connect-pg-simple` no migrables | Usuarios re-autenticán (irreversible); comunicar con antelación |
| Puppeteer no corre en Edge | Aislado en Express serverless (Fase 5) |
| Scheduler IA latencia > timeout Edge | Medir primero; si >25s va al serverless |
| 28 tablas con RLS → policies complejas | Generar policies con helper SQL reutilizable por patrón "project access" |
| Drift `server/schema.ts` vs `shared/schema.ts` | Consolidar antes de generar SQL final |
| Reset password hoy roto | Supabase lo resuelve nativo (mejora neta) |
| No hay tests | Crear tests E2E mínimos por fase como criterio de verificación |

---

## Estimación de esfuerzo (orientativa)

- **Fase 0–1** (esquema + migración IDs): mayor riesgo, ~30% del esfuerzo.
- **Fase 2** (auth): ~15%.
- **Fase 3** (CRUD → RLS): ~25% (repetitivo, 28 tablas).
- **Fase 4–5** (IA + pesado): ~15%.
- **Fase 6–7** (Storage + Realtime): ~10%.
- **Fase 8–9** (limpieza + verificación): ~5%.

---

## Notas

- Proyecto Supabase: `zfuwtvbkjqczynzfdxly` (MCP conectado en `~/.config/opencode/opencode.jsonc:4-11`).
- Fuera de alcance: migrar el frontend a otro framework, rediseñar UI, o cambiar el modelo de datos de negocio (sólo se mueve a Supabase, no se rediseña).
- Las fases están ordenadas por dependencia: cada una construye sobre la anterior.
