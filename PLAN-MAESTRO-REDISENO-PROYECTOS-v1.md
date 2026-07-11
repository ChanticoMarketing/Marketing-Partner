# Plan Maestro v1.0 — Alta rápida de proyectos y Brand Brain progresivo

**Estado:** Fase 0 cerrada en el proyecto enlazado; las fases funcionales restantes no se declaran completas  
**Fecha de auditoría:** 2026-07-04  
**Alcance auditado:** árbol de trabajo actual del repositorio (cliente React, servidor, esquema y políticas Supabase versionadas, Edge Functions)  
**Fuente de verdad de esta iteración:** implementación versionada y cambios presentes en el árbol de trabajo; no se asumió que el estado remoto de Supabase coincida con los archivos locales.

## 1. Propósito y reglas del plan

El objetivo es sustituir el alta extensa por este flujo:

```text
Nombre + color + imagen opcional
              ↓
       Proyecto creado
              ↓
 Espacio individual del proyecto
              ↓
 Brand Brain progresivo y no bloqueante
              ↓
 IA y calendarios mejoran con el contexto disponible
```

El proyecto debe ser utilizable desde el primer segundo. La falta de estrategia debe reducir la personalización de los resultados, pero nunca impedir crear el proyecto, entrar a él, cargar documentos, usar productos, tareas, chat o calendarios.

Principios Ponytail de este roadmap:

1. Reutilizar `projects`, `analysis_results`, `documents`, `products` y las rutas actuales.
2. Añadir únicamente dos atributos de identidad visual a `projects`; no crear una entidad Brand Brain nueva.
3. Conservar `client` como compatibilidad interna mientras se decide su semántica de producto.
4. Mantener la evidencia documental separada de los campos estratégicos y de la identidad visual.
5. Hacer cambios aditivos, anulables y verificables por fase.
6. No reestructurar IA, calendarios, permisos, documentos, productos ni analítica dentro de este rediseño.

## 2. Método y límites de la auditoría

Se trazaron:

- formulario de alta y mutación de creación;
- listado, navegación y espacio individual;
- esquema, mapeos camelCase/snake_case, relaciones y RLS versionados;
- edición y lectura de `analysis_results`;
- carga, aprobación, consumo y eliminación de `documents`;
- creación y regeneración de calendarios, conceptos, chat e imagen de entrada;
- patrones de Storage existentes.

Esta es una auditoría estática. Los archivos prueban la intención y el comportamiento del código, pero no prueban por sí solos que la base, buckets, políticas o funciones desplegadas tengan hoy la misma versión. Esa comprobación es un prerrequisito de implementación, no una autorización para cambiar estado en esta iteración.

## 3. Mapa del sistema actual

### 3.1 Modelo principal

`projects` contiene hoy `id`, `name`, `client`, `description`, fechas, estado, autor y timestamps. `name` y `client` son `NOT NULL`; no existen columnas de color ni imagen (`supabase/schema.sql:93-105`). El tipo cliente reproduce ese contrato (`client/src/shared/schema.ts:38-56`) y el mapeador tampoco conoce color o imagen (`client/src/lib/supabase-helpers.ts:54-65`).

Relaciones directas por `project_id` verificadas:

- `tasks`, `analysis_results`, `documents`, `schedules`, `chat_messages` y `products`;
- vistas, automatizaciones, etiquetas, documentos colaborativos, miembros, asignaciones, grupos y configuración de columnas;
- `activity_log` admite un proyecto opcional;
- `schedule_entries` y `content_history` dependen indirectamente mediante el calendario.

Las relaciones usan mayoritariamente `ON DELETE CASCADE`; por tanto, no se recomienda sustituir el registro de proyecto ni migrar sus identificadores. El rediseño debe enriquecer la fila existente.

### 3.2 Flujo real de creación

1. `Projects` abre `NewProjectModal` (`client/src/pages/projects.tsx`).
2. Zod exige `name` y `client`; estrategia y productos son opcionales (`new-project-modal.tsx:86-179`).
3. La interfaz expone doce pestañas y un cuestionario extenso, incluyendo identidad, audiencia, voz del cliente, pilares, competencia y calendario estacional (`new-project-modal.tsx:407+`).
4. Al enviar, la mutación inserta únicamente `name`, `client`, `description`, fechas y `status` en `projects` (`new-project-modal.tsx:307-329`).
5. Si hay productos, carga sus imágenes en `product-images` y crea filas de `products` (`new-project-modal.tsx:331-369`).
6. `analysisResults` no se inserta ni se actualiza en esa mutación. `formattedValues` se construye y no se usa.
7. Tras éxito se invalida el listado, se cierra el modal y el usuario permanece en `/projects`; no hay redirección al proyecto creado (`new-project-modal.tsx:373-384`).

### 3.3 Espacio individual actual

`/projects/:id` ya es el contenedor adecuado para el flujo futuro. Ofrece pestañas de Estrategia, Calendarios, Centro de conocimiento, Productos y Chat (`project-detail.tsx:251-318`). La ruta `/projects/:id/knowledge` reutiliza el mismo contenedor y abre directamente documentos. No hace falta crear otro “workspace”.

La edición general actual modifica nombre, cliente, descripción, fechas y estado. No edita identidad visual. Además, ofrece el estado `cancelled`, aunque el enum SQL y el esquema Zod de alta no lo admiten; es una discrepancia preexistente y fuera de este rediseño.

### 3.4 Persistencia estratégica actual

`analysis_results` ya puede almacenar:

- misión, visión, valores, objetivos y objetivos de comunicación;
- buyer persona y audiencia objetivo;
- estrategia de marketing, arquetipos, tono y estilo;
- redes sociales, políticas de respuesta y palabras clave;
- temas, competencia, descripción y notas;
- propuesta de valor, citas, objeciones, vocabulario y calendario estacional.

Los campos son opcionales, lo que hace viable un Brand Brain progresivo (`supabase/schema.sql:138-169`). `ProjectAnalysis` ya edita e inserta/actualiza gran parte de ellos después de crear el proyecto (`project-analysis.tsx:49-200`).

No existe una restricción `UNIQUE(project_id)` en `analysis_results`. Sin embargo:

- la UI y sus tipos esperan un solo objeto `analysis`;
- Supabase puede devolver una colección para una relación uno-a-muchos;
- `getKnowledgeContext` toma simplemente la primera fila, sin orden (`_shared/knowledge.ts:313-328`);
- el editor usa `maybeSingle()` y no procesa su error antes de decidir insertar (`project-analysis.tsx:165-179`).

Esto permite duplicados y contexto no determinista. Debe auditarse en datos reales antes de imponer unicidad.

### 3.5 Documentos y materiales de referencia

`documents` ya soporta contenido manual o archivo, categoría, subcategoría, estado de revisión, metadata estructurada y aprobación (`schema.sql:173-194`). El Centro de conocimiento permite:

- Branding: manual, tono y colores;
- Estrategia: palabras clave, palabras a evitar, CTA y FAQ;
- Ejemplos: publicaciones/resultados y diseños;
- subsecciones personalizadas (`project-documents.tsx:46-65`).

Solo documentos `approved` alimentan el contexto de IA. Cada documento se resume y transforma en un bloque acotado; el contexto total también tiene límite (`_shared/knowledge.ts:286-359`). Esta infraestructura es reutilizable para logo, manuales, referencias, catálogos, testimonios, URLs pegadas como contenido manual y fuentes de verdad. No debe duplicarse en otra tabla.

Storage verificado en el código:

- `documents` para archivos del centro de conocimiento;
- `product-images` para productos;
- `profile-images` y `cover-images` para usuarios.

No existe una columna de imagen de proyecto ni una declaración activa de bucket de proyecto en el repositorio. `MIGRATION-PLAN.md` solo lista buckets como tarea histórica; no prueba disponibilidad. Reutilizar `product-images` para la imagen del proyecto mezclaría identidad con catálogo y no se recomienda.

### 3.6 Consumo real por IA y calendarios

El contexto canónico actual se arma en `getKnowledgeContext`: primera fila de `analysis_results` más documentos aprobados. Ese contexto se reutiliza en calendario, regeneración, conceptos, chat y descripción de imagen.

| Dato persistido | Calendario nuevo | Regeneración | Conceptos | Imagen de entrada | Bloque común / chat |
| --- | --- | --- | --- | --- | --- |
| Misión | Sí | Sí | Sí | Indirecto | Sí |
| Visión | Sí | Indirecto | Sí | Indirecto | Sí |
| Valores | Sí | Indirecto | Indirecto | Indirecto | Sí |
| Objetivos | Sí | Sí | Sí | Indirecto | Sí |
| Audiencia objetivo | Sí | Sí | Sí | Sí | Sí |
| Tono de marca | Sí | Sí | Sí | Sí | Sí |
| Palabras clave | Sí | Indirecto | Indirecto | Indirecto | Sí |
| Propuesta de valor | Sí | No explícito | Sí | No explícito | No explícito |
| Temas de contenido | Sí | No explícito | Sí | No explícito | No explícito |
| Competencia | Sí | No explícito | No explícito | No explícito | No explícito |
| Productos | Sí | No | No | No | No |
| Documentos aprobados | Sí | Sí | Sí | Sí | Sí |

“Indirecto” significa incluido dentro de `promptBlock`, no necesariamente nombrado otra vez por la función.

Persistidos pero sin consumo explícito en las funciones auditadas: objetivos de comunicación, buyer persona, estrategia de marketing, arquetipos, estilo de comunicación, redes sociales, políticas de respuesta, citas de clientes, objeciones, vocabulario y calendario estacional. Algunos podrían llegar mediante un documento aprobado, pero sus columnas de `analysis_results` no se añaden al bloque común.

Discrepancias de calendario que deben registrarse, no corregirse dentro de este rediseño:

- el panel de calidad considera suficiente misión, `buyerPersona` o tono, mientras la función usa `target_audience`, no `buyer_persona` (`calendar-creator.tsx:211-265`);
- `generate-schedule` recibe preferencias en `scheduleConfig` pero no las usa en el prompt ni en persistencia;
- calcula siempre desde la fecha del servidor y 15 días, aunque la UI envía fechas, período, plataformas y distribución (`generate-schedule/index.ts:23-46,71-75`);
- la advertencia de contexto incompleto ya existe y no bloquea, un patrón correcto para el futuro.

## 4. Discrepancias críticas: interfaz, persistencia y consumo

| ID | Evidencia | Impacto | Tratamiento |
| --- | --- | --- | --- |
| D-01 | El alta muestra `analysisResults`, pero su mutación nunca lo persiste. | El usuario puede completar un cuestionario largo y perder todo ese trabajo. | Corregir retirando esos campos del alta; no intentar rescatarlos desde estado efímero. |
| D-02 | `client` es obligatorio en Zod y SQL, pero el flujo deseado no lo pide. | El alta de tres datos no puede insertar con el contrato actual. | Compatibilidad mínima recomendada: guardar temporalmente `client = name`; no relajar ni borrar la columna en Fase 1. |
| D-03 | La política versionada exige `created_by = auth.uid()`, pero el alta no envía `createdBy`. | Con esas políticas desplegadas, la inserción directa con anon client debería fallar. | Verificar estado remoto y añadir el autor en la mutación futura; no modificar RLS. |
| D-04 | No hay color ni imagen en `projects`, tipos ni mapeos. | Los tres datos objetivo no caben en el modelo actual. | Migración aditiva con columnas nullable y fallbacks. |
| D-05 | No hay `UNIQUE(project_id)` en `analysis_results`; los consumidores eligen la primera fila. | Duplicados y selección estratégica no determinista. | Auditar duplicados, consolidar sin pérdida y solo después añadir unicidad. |
| D-06 | La relación `analysis` se trata como objeto en UI aunque el esquema permite varias filas. | Campos vacíos, edición duplicada o lectura inconsistente. | Estabilizar cardinalidad y forma de lectura antes de dividir el Brand Brain. |
| D-07 | El alta usa `contentPillars`/`competitors`; la edición persistente usa `contentThemes`/`competitorAnalysis`. | Contratos paralelos y mapeo imposible aunque se intentara guardar el alta. | Adoptar los nombres persistentes existentes en el Brand Brain. |
| D-08 | `communicationObjectives`, arquetipos y redes se muestran en alta, pero el editor progresivo no ofrece todos. | Información inaccesible después de crear, aun cuando la tabla la admite. | Decidir prioridad por sección; añadir campos al editor solo cuando la sección se implemente. |
| D-09 | Varios campos persistidos no alimentan funciones de IA/calendario. | Completar el formulario no garantiza mejor salida. | Mostrar calidad basada en datos realmente consumidos; ampliar prompts solo en fase separada y con prueba. |
| D-10 | Carga de producto ignora errores de upload/insert y no limpia archivos. | El patrón actual puede dejar producto incompleto o archivo huérfano. | No copiar este patrón para imagen de proyecto; diseñar compensación explícita. |
| D-11 | `analyze-document` sube el archivo antes de crear la fila y no compensa si falla DB/análisis. | Archivo huérfano o fila `processing` permanente. | Registrar como deuda del módulo documentos; no bloquear el alta rápida salvo que se reutilice ese flujo. |
| D-12 | Eliminar conocimiento no comprueba el resultado de `storage.remove`; luego borra la fila. | Puede quedar un archivo sin referencia. | Dependencia futura de mantenimiento, no parte de Fase 1. |
| D-13 | `client/src/shared/schema.ts` no incluye todos los campos P0 recientes aunque SQL y mapeador sí. | Tipos incompletos y mayor probabilidad de omisiones. | Actualizar tipos solo al tocar esas superficies en la fase correspondiente. |
| D-14 | El alta termina en el listado. | Incumple entrada directa al espacio individual. | Navegar a `/projects/:id` usando el ID devuelto. |

## 5. Matriz del Brand Brain progresivo

Leyenda de viabilidad: **Ahora** = reutilización sin cambio de esquema; **Migración** = necesita columnas/constraint; **Investigar** = falta confirmar datos o contrato; **No recomendado** = duplicaría o mezclaría responsabilidades.

| Sección futura | Datos existentes y persistencia real | Brechas, duplicidad y reutilización | Uso por IA/calendarios | Viabilidad y regla no bloqueante |
| --- | --- | --- | --- | --- |
| Branding e identidad | `projects.description`; en `analysis_results`: misión, visión, valores, tono y estilo. `documents` admite manual, tono, colores y diseños. | Logo y referencias visuales pueden ser documentos; el avatar del proyecto no debe ser un documento. Descripción aparece tanto en proyecto como `project_description` de análisis. | Descripción, misión, visión, valores y tono sí se usan; estilo no se usa explícitamente. | **Ahora** para estrategia/documentos. **Migración** solo para `projects.color` y `projects.image_url`. Todo opcional salvo nombre/color de alta. |
| Oferta y negocio | `unique_value_proposition`; `products` con nombre, descripción, imagen, SKU y precio; documentos manuales admiten CTA/FAQ. | No existe oferta prioritaria ni CTA canónico. Reutilizar productos y documentos antes de crear campos. `project.description` puede resumir el negocio, sin duplicar catálogo. | UVP y productos alimentan calendario nuevo; CTA/FAQ aprobados llegan como documento. | **Ahora**. Prioridad/oferta estructurada requiere **decisión** antes de migrar. No bloquea. |
| Audiencia y mercado | `buyer_persona`, `target_audience`, objeciones, vocabulario, citas y competencia. | Buyer persona y audiencia se solapan; `competitor_analysis` puede duplicar documentos. Elegir una presentación, no borrar campos. | IA usa `target_audience` y competencia en calendario; no usa buyer persona, citas, objeciones ni vocabulario explícitamente. | **Ahora**, con **investigación** de semántica y consumo. No bloquea. |
| Comunicación y límites | Tono, estilo, arquetipos, políticas positiva/negativa y palabras clave; documentos admiten palabras a evitar y tono. | Tono/estilo/arquetipos son cercanos; prohibiciones pueden vivir como documento aprobado hasta demostrar necesidad estructurada. | Tono y keywords sí; el resto no explícitamente. Documentos aprobados sí. | **Ahora**. No crear tabla de reglas. Advertir calidad, no bloquear. |
| Dirección de contenido | Objetivos, objetivos de comunicación, estrategia, `content_themes`; documentos de palabras clave/ejemplos. | `contentPillars` del alta equivale conceptualmente a `content_themes`; usar este último. No hay temas prohibidos/campañas estructurados. | Objetivos y temas sí; objetivos de comunicación y estrategia no explícitamente. | **Ahora** para base. Campañas/prioridades: **investigar** antes de agregar datos. No bloquea. |
| Canales y operación | `social_networks` JSONB; preferencias de calendario se capturan en UI; idioma existe a nivel usuario. | Las preferencias del creador de calendario no se guardan como configuración de proyecto y la función ignora parte del payload. Responsables ya existen mediante miembros/asignaciones. | `social_networks` no se usa explícitamente; plataformas del calendario tampoco se respetan plenamente. | **Investigar**. No migrar ni reestructurar calendario en este proyecto. Nunca bloquea el alta. |
| Fechas y prioridades | `seasonal_calendar` JSONB; fechas generales del proyecto; instrucciones y fechas del calendario. | Lanzamientos/promociones pueden coexistir en calendario estacional; no crear entidad hasta probar consultas/recordatorios reales. | `seasonal_calendar` no se usa explícitamente; el generador ignora fechas recibidas. | **Ahora** para captura; **investigar** para consumo. No bloquea. |
| Material de referencia | `documents` con upload/manual, metadata, aprobación y categorías; `products` para catálogo visual. | Es la reutilización principal. URLs pueden guardarse como conocimiento manual; documentos no deben guardar el avatar del proyecto. Conversaciones de chat no son fuente aprobada automáticamente. | Todo documento aprobado entra al bloque de contexto con límite de tamaño. | **Ahora**. Ampliar taxonomía es aditivo; no crear un repositorio paralelo. No bloquea. |

### Datos mostrados que hoy no se guardan en el alta

Todo `analysisResults` del modal: objetivos de comunicación, buyer persona, arquetipos, redes y frecuencias, estrategia, estilo, misión, visión, valores, políticas, UVP, citas, objeciones, vocabulario, pilares, calendario estacional y competencia. Los productos sí intentan guardarse de forma separada.

### Datos que sí pueden guardarse después

El editor del espacio individual persiste misión, visión, valores, buyer persona, audiencia, objetivos, estrategia, tono, estilo, keywords, políticas, UVP, citas, objeciones, vocabulario, temas, competencia y calendario estacional. La tabla admite además campos que esa UI no ofrece actualmente.

## 6. Diseño mínimo de datos recomendado

### 6.1 Separación de responsabilidades

| Responsabilidad | Fuente recomendada | No usar como sustituto |
| --- | --- | --- |
| Identidad visible del proyecto | `projects.name`, nuevo `projects.color`, nuevo `projects.image_url` | `tags.color`, imagen de producto, documento de branding |
| Resumen general | `projects.description` | duplicarlo automáticamente en `analysis_results.project_description` |
| Contexto estratégico editable | única fila de `analysis_results` por proyecto | nueva tabla Brand Brain |
| Evidencia y fuentes aprobadas | `documents` + Storage `documents` | campos JSONB gigantes en `projects` |
| Oferta/catalogación | `products` | lista duplicada dentro de Brand Brain |
| Operación y responsables | relaciones actuales de miembros/asignaciones | campos libres duplicados |

### 6.2 Migración mínima futura

Propuesta, no SQL de esta iteración:

- `projects.color text NULL`;
- `projects.image_url text NULL`;
- mapeos y tipos correspondientes;
- tras auditar y consolidar duplicados: `UNIQUE (project_id)` en `analysis_results`.

No hacer backfill destructivo. El cliente debe aplicar un color fallback estable cuando `color` sea nulo/inválido y mostrar iniciales sobre ese fondo cuando no haya imagen. Una imagen válida reemplaza o complementa el fallback; si falla al cargar, vuelve a color/iniciales.

Para nuevos proyectos, el color es obligatorio en UI y tiene valor inicial. Las columnas permanecen nullable para compatibilidad histórica y despliegue gradual.

### 6.3 Compatibilidad de `client`

Recomendación mínima para Fase 1: no pedirlo y enviar internamente `client = name`. Esto conserva SQL, exportaciones, prompts y vistas que todavía muestran `client`. Si producto decide que “cliente” y “marca” son conceptos distintos, se podrá editar después; no conviene hacer nullable la columna durante el rediseño.

### 6.4 Ciclo seguro de imagen opcional

1. Crear primero la fila del proyecto con nombre, color, compatibilidad `client` y `created_by`.
2. Si no hay imagen, navegar inmediatamente.
3. Si hay imagen, subirla a un bucket confirmado para proyectos usando una ruta basada en el ID.
4. Guardar la URL/ruta en el proyecto.
5. Si upload falla: conservar el proyecto, mostrar aviso y permitir reintento.
6. Si upload funciona pero actualizar la fila falla: intentar borrar el objeto; si esa compensación falla, registrar el path para limpieza.
7. Al reemplazar imagen: guardar la nueva referencia antes de borrar la anterior.

El éxito del proyecto nunca debe revertirse por el fallo de su imagen opcional.

## 7. Roadmap secuencial

### Fase 0 — Cerrar contratos y sanear prerrequisitos

**Objetivo:** demostrar que Fase 1 puede desplegarse sin pérdida ni contradicción con el entorno real.

**Alcance:** solo verificación y decisiones; sin UX nueva. Comparar esquema/RLS/buckets/funciones desplegadas con repositorio, contar filas de `analysis_results` por proyecto, clasificar duplicados y confirmar quién puede crear proyectos.

**Datos:** `projects.created_by/client`; cardinalidad de `analysis_results`; buckets; URLs existentes.

**Riesgos:** imponer unicidad con duplicados; creer disponible un bucket inexistente; lanzar una creación que RLS rechaza.

**Compatibilidad:** no mutar datos. Si hay duplicados, diseñar consolidación que preserve todas las columnas y exporte respaldo.

**Criterio de salida:** matriz local/remoto documentada; cero incógnitas sobre `created_by`, bucket objetivo y duplicados; decisiones P-01 a P-05 cerradas.

**Prueba manual:** con una cuenta autorizada, ejecutar en entorno de prueba una inserción mínima reversible y confirmar lectura/acceso; no realizarla en producción durante la auditoría.

#### Cierre verificado — 2026-07-10

- **Paridad:** las migraciones `20260709204125`, `20260709205159` y `20260709214116` están aplicadas en el proyecto enlazado `zfuwtvbkjqczynzfdxly`; `projects.color` e `image_url` ya existen.
- **Datos:** hay 1 proyecto con `created_by` y `client` completos; existe 1 fila de `analysis_results`, sin duplicados y sin `UNIQUE(project_id)`.
- **RLS:** se corrigió `projects_select` para reutilizar `can_access_project(id)`. La versión anterior correlacionaba erróneamente las subconsultas de miembros/asignaciones consigo mismas.
- **Storage:** no hay bucket de imágenes de proyecto. P-03 queda cerrado para Fase 1: crear `project-images` público, con escritura limitada por acceso al proyecto, JPEG/PNG/WebP hasta 5 MB y `object-fit: cover` sin recorte de servidor.
- **Decisiones:** P-01 `client = name`; P-02 color inicial `#F59E0B`; P-04 puede crear cualquier usuario autenticado que envíe su propio `created_by`; P-05 no requiere consolidación hoy y se repetirá el conteo antes de añadir unicidad en Fase 3.

### Fase 1 — Contrato de identidad visual y alta rápida

**Objetivo:** crear en segundos un proyecto válido con nombre, color e imagen opcional.

**Alcance:** migración aditiva de color/imagen; tipos/mapeos; reemplazar contenido del modal; enviar `createdBy`; mantener `client` internamente; conservar proyecto aunque falle imagen.

**Datos:** `projects.name`, `client`, `color`, `image_url`, `created_by`, `status` y Storage de proyecto confirmado.

**Riesgos:** RLS, validación de archivo, URL pública/privada, objeto huérfano, doble envío y creación duplicada.

**Compatibilidad:** columnas nullable; fallback visual; sin tocar relaciones ni campos históricos; ninguna migración masiva obligatoria.

**Criterio de salida:** una sola fila se crea con nombre/color; imagen es opcional; fallo de imagen no marca fallo de proyecto; no se presenta estrategia en el alta.

**Prueba manual:** crear con y sin imagen; simular fallo de upload y de actualización; recargar listado; confirmar autor, fallback y ausencia de objetos huérfanos conocidos.

### Fase 2 — Entrada directa y fallbacks en superficies existentes

**Objetivo:** llevar al usuario a `/projects/:id` y representar identidad consistente.

**Alcance:** redirección tras creación; encabezado/listados/tarjetas con imagen → color → fallback neutro; edición posterior de nombre/color/imagen en la superficie existente.

**Datos:** los tres datos de identidad; no tocar estrategia.

**Riesgos:** imagen rota, cache de React Query, enlaces de `/knowledge`, proyectos legacy nulos.

**Compatibilidad:** todas las rutas existentes continúan; no crear nuevo workspace.

**Criterio de salida:** proyecto nuevo abre su espacio individual; todos los proyectos legacy se ven y navegan; una URL rota nunca deja el componente vacío.

**Prueba manual:** abrir proyecto nuevo, legacy sin color/imagen, con color, con imagen y con imagen 404 desde listado, dashboard y detalle.

### Fase 3 — Base confiable del Brand Brain progresivo

**Objetivo:** asegurar una única fuente estratégica editable antes de reorganizar su presentación.

**Alcance:** consolidación previamente aprobada; unicidad por proyecto; lectura de relación con forma estable; estados vacíos; guardado parcial por secciones reutilizando `ProjectAnalysis`.

**Datos:** `analysis_results`; sin tabla nueva.

**Riesgos:** fusión incorrecta de duplicados, último valor vacío sobrescribiendo contenido, actualización de una sección borrando otras.

**Compatibilidad:** preservar todos los campos; crear fila al primer guardado, no al crear proyecto; actualizaciones parciales.

**Criterio de salida:** máximo una fila por proyecto; guardar una sección no altera las demás; ausencia total de análisis funciona.

**Prueba manual:** proyecto sin análisis, parcial y completo; editar secciones en orden distinto; recargar y comparar valores; probar colisión de actualizaciones.

### Fase 4 — Reorganización funcional en ocho secciones

**Objetivo:** presentar el Brand Brain conforme a la matriz, con avance gradual y baja carga cognitiva.

**Alcance:** reorganizar la UI existente; indicadores por sección; reutilizar productos y Centro de conocimiento mediante enlaces/embeds, no copiar datos; añadir únicamente los controles de campos existentes aprobados.

**Datos:** `analysis_results`, `projects.description`, `products`, `documents`.

**Riesgos:** duplicar contenido, confundir “dato canónico” con evidencia, porcentaje de avance engañoso.

**Compatibilidad:** cualquier sección vacía es válida; no exigir porcentaje mínimo.

**Criterio de salida:** ocho secciones navegables; cada campo tiene una fuente declarada; ninguna bloquea proyecto, calendario o chat.

**Prueba manual:** completar solo una sección, varias y ninguna; comprobar que documentos/productos no se duplican y que el guardado parcial persiste.

### Fase 5 — Calidad contextual visible y consumo gradual

**Objetivo:** hacer transparente qué contexto usa realmente la IA sin convertirlo en puerta de acceso.

**Alcance:** indicador “contexto básico/parcial/completo” basado primero en campos ya consumidos y documentos aprobados; advertencias y enlaces a secciones; pruebas de prompts actuales. Cualquier ampliación de campos consumidos debe ser un cambio pequeño independiente.

**Datos:** campos consumidos listados en §3.6 y estado de documentos.

**Riesgos:** prometer uso de campos ignorados, prompts excesivos, contexto contradictorio, documentos antiguos desplazando otros por límite.

**Compatibilidad:** generación con cero contexto sigue habilitada con mensaje de calidad; mantener fallbacks actuales.

**Criterio de salida:** el indicador coincide con la composición real del prompt; una salida genérica se explica sin bloquear; pruebas cubren vacío/parcial/completo.

**Prueba manual:** generar conceptos/calendario/chat con tres niveles de contexto y verificar trazabilidad; confirmar que campos marcados como influyentes aparecen en el prompt construido.

### Fase 6 — Endurecimiento y limpieza operativa

**Objetivo:** cerrar fallos residuales de archivos y datos sin mezclar una reescritura.

**Alcance:** inventario de objetos sin referencia; compensación/reintento para imagen de proyecto; registrar por separado deudas verificadas de documentos/productos/calendario.

**Datos:** Storage y referencias `image_url`/metadata.

**Riesgos:** borrar archivos aún referenciados; limpiar por coincidencia de nombre; alcance expansivo.

**Compatibilidad:** modo informe primero; borrado solo con referencia inversa y aprobación.

**Criterio de salida:** no se crean nuevos huérfanos en el flujo de proyecto; existe procedimiento seguro para detectar, no borrar automáticamente, huérfanos históricos.

**Prueba manual:** provocar cada frontera de fallo y verificar fila/objeto/reintento; ejecutar inventario en modo lectura.

## 8. Matriz de viabilidad por fase

| Fase | Viable ahora | Viable con migración | Investigación adicional | No recomendado |
| --- | --- | --- | --- | --- |
| 0. Contratos | Auditoría local y consultas de lectura | — | Estado remoto, duplicados, buckets y RLS | Asumir paridad local/remota |
| 1. Alta rápida | Nombre, compatibilidad `client`, autor y estado | Color, imagen y bucket/ruta confirmada | Política de formatos/tamaño/privacidad | Nueva entidad de proyecto o Brand Brain |
| 2. Entrada/fallbacks | Ruta y contenedor individual ya existen | No necesaria | Superficies exactas donde mostrar identidad | Nuevo workspace paralelo |
| 3. Base Brand Brain | `analysis_results` y editor existentes | Unicidad tras consolidación | Forma real de relación y duplicados | Tabla Brand Brain nueva |
| 4. Ocho secciones | Reorganizar campos/documentos/productos | Solo si producto aprueba nuevos campos canónicos | Solapamientos semánticos | Copiar documentos/productos dentro de análisis |
| 5. Calidad contextual | Advertencia no bloqueante ya existe | No necesaria para indicador | Evaluación de prompts y campos ignorados | Bloquear IA por completitud |
| 6. Endurecimiento | Compensación en nuevo flujo | Posible registro técnico de limpieza | Inventario seguro de huérfanos | Limpieza masiva por heurística |

## 9. Dependencias entre fases

```text
Fase 0
  ├─ confirma RLS/autor/bucket ─→ Fase 1 ─→ Fase 2
  └─ confirma duplicados ───────→ Fase 3 ─→ Fase 4 ─→ Fase 5
                                      │
Fase 1 + evidencia de fallos ─────────┴────────────────→ Fase 6
```

Fase 1 no depende de completar o reparar toda la estrategia. Fase 4 sí depende de cardinalidad estable en Fase 3. Fase 5 depende de saber exactamente qué guarda Fase 4 y qué consumen las funciones. Fase 6 no autoriza corregir deudas de otros módulos salvo ticket separado.

## 10. Riesgos y casos extremos

| Caso | Respuesta prevista |
| --- | --- |
| Proyecto legacy sin color ni imagen | Fallback determinista; no backfill obligatorio. |
| Proyecto con estrategia parcial | Mostrar solo lo disponible; guardar por sección; generación permitida. |
| Cuestionario actual no persistido | Retirarlo del alta; informar como defecto histórico; no inventar recuperación. |
| Campo persistido no usado por IA | No contarlo como mejora de calidad hasta incorporar y probar su consumo. |
| Upload opcional falla | Proyecto exitoso, aviso accionable y reintento posterior. |
| Upload funciona y patch falla | Compensar borrando objeto; si falla, registrar para limpieza. |
| Archivo huérfano histórico | Inventario de lectura y revisión antes de borrar. |
| Estrategia duplicada | Consolidar con respaldo y regla campo por campo; después unicidad. |
| Contexto incompleto | Fallback genérico más advertencia, nunca bloqueo. |
| Contexto contradictorio entre tabla y documento | Declarar precedencia; propuesta: campos estructurados + documentos aprobados, mostrando ambas fuentes. |
| Cambio de esquema desplegado antes que UI | Columnas nullable; código antiguo continúa insertando. |
| UI desplegada antes que esquema | No recomendado; migración aditiva primero y prueba de lectura/escritura. |
| Imagen remota rota | `onError` vuelve al color/iniciales. |
| Doble clic/reintento de red | Deshabilitar mientras inserta; evaluar clave idempotente solo si el problema se reproduce. |
| Permisos históricos | Reutilizar política actual; no ampliar roles ni RLS en este roadmap. |

## 11. Qué implementar, qué verificar y qué decidir

### Implementar en futuras iteraciones

- [I-01] Dos columnas nullable, tipos y mapeos de identidad visual.
- [I-02] Alta mínima con autor y compatibilidad `client`.
- [I-03] Flujo tolerante a fallo y compensación de imagen.
- [I-04] Redirección al detalle y fallbacks en superficies existentes.
- [I-05] Cardinalidad estratégica estable, después de sanear datos.
- [I-06] Brand Brain por secciones reutilizando fuentes actuales.
- [I-07] Indicador de calidad basado en consumo comprobado.

### Verificar antes o durante las fases

- [V-01] Esquema, RLS y funciones efectivamente desplegados.
- [V-02] Conteo y contenido de duplicados de `analysis_results`.
- [V-03] Buckets, privacidad, límites MIME/tamaño y políticas Storage.
- [V-04] Usuarios autorizados para crear y valor real de `created_by` histórico.
- [V-05] URLs/imágenes rotas y objetos sin referencia.
- [V-06] Forma de relación devuelta por Supabase en detalle y calendario.
- [V-07] Prompts construidos con contexto vacío, parcial y completo.
- [V-08] Todas las superficies que renderizan proyectos.

### Requiere decisión de producto

Ver §13. No convertir decisiones abiertas en migraciones especulativas.

## 12. Validación requerida por fase

Cada fase funcional deberá pasar, como mínimo:

1. `npm run check`.
2. `npm run build:client`.
3. `npm run build:server` cuando toque contratos compartidos o servidor.
4. Prueba manual de éxito y fallo descrita en cada fase.
5. Diff limitado a los archivos de esa fase; fallos preexistentes separados de regresiones.
6. Consulta de lectura posterior para probar fila, autor, cardinalidad y referencias Storage cuando aplique.

Para este documento se validará además que todas las tablas, columnas, rutas, buckets mencionados y consumidores tengan evidencia local y que el único archivo nuevo sea este Markdown.

## 13. Decisiones pendientes de producto

Antes de iniciar implementación deben cerrarse, como máximo, estas diez decisiones:

1. **P-01 — Significado de `client`:** confirmar la recomendación de ocultarlo y copiar inicialmente `name`, conservando edición posterior.
2. **P-02 — Color inicial:** definir el hexadecimal por defecto y si el usuario puede dejar el sugerido sin interactuar.
3. **P-03 — Imagen:** confirmar formatos, tamaño máximo, recorte/relación visual y si debe ser pública o servida con URL firmada.
4. **P-04 — Acceso al alta:** confirmar qué roles actuales pueden crear proyectos; no cambiar RLS, solo alinear UI con la política vigente.
5. **P-05 — Duplicados estratégicos:** aprobar la regla de consolidación y respaldo antes de `UNIQUE(project_id)`.
6. **P-06 — Precedencia contextual:** confirmar si, ante conflicto, domina el campo estructurado o el documento aprobado más reciente.
7. **P-07 — Completitud:** confirmar que el indicador sea orientativo y nunca un requisito para usar IA/calendarios.
8. **P-08 — Oferta prioritaria:** decidir si basta con seleccionar/referenciar un `product` existente o se necesita un campo canónico futuro.
9. **P-09 — Idioma operativo:** decidir si permanece en perfil/instrucción de calendario o si realmente necesita configuración por proyecto.
10. **P-10 — Campañas y fechas:** confirmar si `seasonal_calendar` cubre la primera versión o si existe un caso probado que justifique estructura adicional.

## 14. Recomendación ejecutiva

La transformación es viable sin reconstrucción. El camino mínimo es:

1. verificar contratos reales y sanear la cardinalidad estratégica;
2. enriquecer `projects` con color e imagen nullable;
3. crear con nombre/color, mantener `client` internamente y registrar autor;
4. entrar al detalle existente;
5. convertir el editor `analysis_results` actual en secciones progresivas;
6. reutilizar `documents` y `products` por referencia;
7. reflejar calidad de contexto sin bloquear.

Los bloqueos reales para empezar Fase 1 no son de arquitectura: son confirmar RLS/`created_by`, bucket/política de imagen, contrato de `client` y estado de duplicados estratégicos. Lo demás puede avanzar de forma aditiva y reversible.
