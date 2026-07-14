# Registro de ejecución — Fase 0

**Proyecto:** Marketing - Mate  
**Plan:** `PLAN-MAESTRO-REDISENO-PROYECTOS-v1.md`  
**Estado:** Cerrada técnicamente; prueba funcional con roles pendiente de entorno no productivo.

## Pasos ejecutados

1. Revisé el flujo actual de proyectos, el esquema, RLS, Storage y consumidores de `analysis_results`.
2. Confirmé el proyecto Supabase enlazado y la paridad de las migraciones remotas.
3. Verifiqué `projects.created_by`, `client`, `color`, `image_url` y la cardinalidad de `analysis_results`.
4. Confirmé que no existen duplicados estratégicos ni un bucket dedicado para imágenes de proyecto.
5. Detecté y corregí la policy `projects_select`, reutilizando `can_access_project(id)`.
6. Apliqué la migración `20260711034215_fix_projects_select_scope.sql` al proyecto enlazado.
7. Actualicé el Plan Maestro con evidencia y decisiones P-01 a P-05.

## Decisiones cerradas

| Decisión | Resultado |
|---|---|
| P-01 `client` | Se conserva internamente como copia de `name`. |
| P-02 color | `#F59E0B` como valor inicial. |
| P-03 imagen | Bucket público dedicado `project-images` en Fase 1; JPEG/PNG/WebP, 5 MB. |
| P-04 creación | Cualquier usuario autenticado con `created_by = auth.uid()`. |
| P-05 duplicados | No hay duplicados actuales; repetir conteo antes de añadir unicidad. |

## Verificación

- `supabase migration list --linked`: migración correctiva aplicada.
- Policy remota: `projects_select = can_access_project(id)`.
- `npm run check`: OK.
- `npm run build:client`: OK.
- `git diff --check`: OK.
- `supabase db advisors`: avisos existentes fuera del alcance de Fase 0.

## Pendiente

- Ejecutar en staging la prueba reversible con creador, admin, miembro, asignado y usuario ajeno.
- Fase 1 queda como siguiente bloque funcional después de la prueba manual de roles.

## Fase 1 — Implementación técnica

**Estado:** Implementada y desplegada; falta prueba manual de carga desde una sesión autenticada.

### Pasos ejecutados

1. Creé el bucket público `project-images` con límite de 5 MiB y MIME JPEG/PNG/WebP.
2. Añadí policies `INSERT` y `DELETE` condicionadas por `can_access_project` y el primer segmento del path.
3. Reemplacé la URL libre de la modal por selección de archivo con validación local.
4. Implementé creación de fila antes del upload, URL pública y actualización de `image_url`.
5. Añadí compensación de Storage y reintento sin duplicar el proyecto.
6. Habilité el botón de alta para cualquier usuario autenticado, conforme a P-04.

### Verificación

- `20260711055558_add_project_images_storage.sql`: aplicada.
- `20260711055925_fix_project_images_storage_scope.sql`: aplicada.
- Policy remota verificada con `objects.name` como path del objeto.
- `npm run check`: OK.
- `npm run build:client`: OK.
- `npm run build:server`: OK.
- `git diff --check`: OK.

### Pendiente

- Crear un proyecto sin imagen desde la UI.
- Crear un proyecto con JPEG, PNG y WebP válidos.
- Verificar rechazo de tipo inválido y archivo mayor a 5 MiB.
- Simular fallo de upload/actualización y confirmar reintento, compensación y ausencia de duplicados.

## Fase 2 — Implementación técnica

**Estado:** Implementada y desplegada; prueba manual de roles/imágenes pendiente.

### Pasos ejecutados

1. Reutilicé el contrato de identidad existente y centralicé la validación de JPEG/PNG/WebP, 5 MiB y extensiones.
2. Añadí un avatar compartido con fallback ante URL rota: imagen → color → inicial neutra.
3. Apliqué el avatar en el listado de proyectos, proyectos recientes, detalle e imagen-análisis.
4. Extendí el diálogo existente para editar color y reemplazar o eliminar la imagen sin crear una pantalla nueva.
5. Añadí compensación: si falla la actualización de la fila, se elimina la imagen recién subida; si falla la limpieza posterior, se registra el contexto sin revertir un cambio correcto.
6. Restringí actualización del proyecto y escritura/borrado de imágenes a creador o admin/isPrimary mediante `can_approve_project_knowledge`.

### Migración

- `20260713155923_restrict_project_identity_writes.sql`: aplicada y verificada en el proyecto Supabase enlazado.

### Pendiente

- Resolver el error preexistente de importación duplicada en `reset-password.tsx` para recuperar el chequeo completo de tipos.
- Probar manualmente imagen válida, imagen rota, reemplazo, eliminación, archivo inválido/mayor a 5 MiB y roles creador/admin frente a miembro/asignado.

## Fase 3 — Base confiable del Brand Brain

**Estado:** Implementada y desplegada; prueba manual de edición parcial pendiente.

### Pasos ejecutados

1. Confirmé en remoto 1 fila estratégica para 1 proyecto y cero duplicados antes de migrar.
2. Añadí unicidad de `analysis_results.project_id` con prevalidación que detiene la migración si aparecen duplicados.
3. Reemplacé el patrón de lectura previa por `upsert` sobre `project_id`.
4. Limité cada guardado del Cerebro de Marca al bloque activo: Marca, Cliente, Contenido o Contexto.
5. Normalicé las relaciones de análisis para que detalle y creador de calendario consuman una fila o estado vacío, no un arreglo.
6. Endurecí `apply-document-analysis`: creador/admin requerido, documento del mismo proyecto, campos vacíos por defecto y lista de conflictos para reemplazo confirmado.

### Despliegue y verificación

- `20260713170112_enforce_analysis_results_per_project.sql`: aplicada y verificada en el proyecto Supabase enlazado.
- Restricción remota: `UNIQUE (project_id)` presente en `analysis_results`.
- `apply-document-analysis`: desplegada y activa.
- `npm run build:client`: OK.
- `npm run build:server`: OK.
- `git diff --check`: OK.

### Pendiente

- Probar desde una sesión de creador/admin el primer guardado, guardados consecutivos de bloques distintos y la confirmación de conflictos de documento.
- El chequeo completo de tipos continúa bloqueado por imports duplicados preexistentes en `reset-password.tsx`.
