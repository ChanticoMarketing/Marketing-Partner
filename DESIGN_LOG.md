# Bitácora de Avance del Rebranding

## Propósito
Este documento funciona como un registro cronológico (append-only) del trabajo visual y de experiencia de usuario en el rebranding de Chantia. 

- **No sustituye el Plan Maestro:** El Plan Maestro rige el alcance funcional general.
- **No contiene reglas nuevas:** Las reglas de diseño viven en el `DESIGN_CONTEXT.md`.
- **Inmutable:** No reescribas históricamente entradas antiguas. Si hay correcciones, agrega una nueva entrada referenciando la fase principal.
- **Append-only:** Cada nueva iteración visual autorizada agregará una entrada utilizando la plantilla estricta de este documento.

---

## Plantilla Obligatoria

```markdown
### [Fecha] - Fase [Número/Nombre]
- **Objetivo:** 
- **Estado:** [En curso | Implementada | En revisión | Aprobada | Fusionada | Pendiente de validación]
- **Alcance visual:** 
- **Rama:** 
- **Commit:** 
- **Superficies modificadas:** 
- **Decisiones confirmadas:** 
- **Validaciones técnicas:** 
- **Validaciones manuales:** 
- **Desviaciones:** 
- **Deuda funcional detectada:** 
- **Elementos enviados al backlog:** 
- **Resultado:** 
- **Siguiente acción autorizada:** 
```

---

## Historial Inicial Reconstruido

El siguiente historial ha sido reconstruido a partir de la evidencia del repositorio actual, diferenciando estrictamente el trabajo visual de la deuda técnica funcional y el avance del backend.

### Fase - Sistema visual global (Temas)
- **Objetivo:** Implementar la estética base de Chantia (modo claro y oscuro).
- **Estado:** Fusionada.
- **Alcance visual:** Definición de paleta de colores, tipografía, variables CSS y modos claro y oscuro.
- **Rama:** main
- **Commit:** `2cb3562` y `dd2f74b`.
- **Superficies modificadas:** `index.css`, `tailwind.config.ts`, variables globales.
- **Decisiones confirmadas:** Adopción de diseño sin bordes, alta reducción de tarjetas innecesarias, uso de Ember como acento.
- **Validaciones técnicas:** `npm run build:client`.
- **Validaciones manuales:** N/A.
- **Desviaciones:** Ninguna registrada.
- **Deuda funcional detectada:** N/A.
- **Elementos enviados al backlog:** N/A.
- **Resultado:** Sistema base implementado y disponible para su uso en componentes.
- **Siguiente acción autorizada:** Iniciar aplicación del sistema a superficies de interfaz.

### Fase 1 y 2 Rebranding Visual
- **Objetivo:** Aplicar la identidad base a autenticación, dashboard y cartera de proyectos.
- **Estado:** Fusionada.
- **Alcance visual:** Rediseño de componentes principales usando Tailwind y componentes base.
- **Rama:** main
- **Commit:** `e878259`.
- **Superficies modificadas:** Rutas de autenticación, listado de proyectos (cartera), vista inicial.
- **Decisiones confirmadas:** Alta rápida (identidad del proyecto con color e imagen) alineada con el modelo funcional de la fase 1 técnica.
- **Validaciones técnicas:** Compilación de cliente.
- **Validaciones manuales:** N/A.
- **Desviaciones:** La implementación dependía de cambios en RLS corregidos por el equipo de backend en `registro-avance.md` Fase 0 y 1.
- **Deuda funcional detectada:** Nulo manejo de fallos al subir imagen (registrado en Plan Maestro).
- **Elementos enviados al backlog:** Compensación de Storage y resiliencia de uploads.
- **Resultado:** Autenticación y dashboard rediseñados.
- **Siguiente acción autorizada:** Rediseño del shell autenticado.

### Fase 3 Rebranding Visual (Shell Autenticado)
- **Objetivo:** Implementar el marco de navegación principal del usuario autenticado.
- **Estado:** Fusionada.
- **Alcance visual:** Navegación, barra superior, menú lateral y layout principal del shell.
- **Rama:** main
- **Commit:** `cd9db6f`.
- **Superficies modificadas:** `client/src/components/layout/*`, shell principal.
- **Decisiones confirmadas:** Reducción de ruido visual en el marco de la aplicación.
- **Validaciones técnicas:** Compilación sin errores.
- **Validaciones manuales:** N/A.
- **Desviaciones:** N/A.
- **Deuda funcional detectada:** Problema de importación duplicada en `reset-password.tsx` que afecta el chequeo de tipos estricto (registrado en avance backend).
- **Elementos enviados al backlog:** Reparación de tipos globales.
- **Resultado:** Layout principal alineado con la marca.
- **Siguiente acción autorizada:** Rebranding del espacio individual de proyectos.

### Fase 4A (Espacio Individual e Identidad del Proyecto)
- **Objetivo:** Reflejar la identidad visual del proyecto en su contenedor principal.
- **Estado:** Fusionada.
- **Alcance visual:** Avatar/Color dinámico del proyecto en el encabezado, rediseño del diálogo de edición de identidad.
- **Rama:** main
- **Commit:** `e2dd3a9`.
- **Superficies modificadas:** `project-detail.tsx`, componentes de encabezado de proyecto.
- **Decisiones confirmadas:** Fallback visual (Imagen → Color → Inicial neutra).
- **Validaciones técnicas:** `npm run build:client` OK.
- **Validaciones manuales:** N/A.
- **Desviaciones:** Cambios funcionales paralelos en backend restringieron la escritura de la identidad (Fase 2 técnica en `registro-avance.md`).
- **Deuda funcional detectada:** N/A.
- **Elementos enviados al backlog:** Prueba manual con usuarios de distintos roles.
- **Resultado:** Encabezado del proyecto muestra su identidad de forma coherente.
- **Siguiente acción autorizada:** Rediseño de estrategia (Centro de marca).

### Fase 4C-1 (Centro de Marca y Estrategia)
- **Objetivo:** Reorganizar la presentación de la estrategia de marca con baja carga cognitiva.
- **Estado:** Fusionada.
- **Alcance visual:** Reorganización visual en ocho secciones según la matriz funcional. Aplicación de jerarquías tipográficas claras y reducción de cajas contenedoras.
- **Rama:** main
- **Commit:** `e1ebe77`.
- **Superficies modificadas:** `project-analysis.tsx`, secciones del Brand Brain.
- **Decisiones confirmadas:** Mostrar únicamente controles aprobados y existentes; navegación por pestañas discretas o scroll continuo.
- **Validaciones técnicas:** `npm run check`, `npm run build:client`.
- **Validaciones manuales:** N/A.
- **Desviaciones:** Condicionado al backend de Fase 3 (Unicidad de `project_id`).
- **Deuda funcional detectada:** Posibilidad de sobrescritura de secciones completas (corregida posteriormente en backend mediante upsert parcial).
- **Elementos enviados al backlog:** N/A.
- **Resultado:** Centro de marca rediseñado.
- **Siguiente acción autorizada:** Diseño de la vista de Fuentes de apoyo.

### Fase 4C-1.1 (Fuentes Documentales / Fuentes de Apoyo)
- **Objetivo:** Adaptar visualmente el gestor de fuentes (Centro de conocimiento).
- **Estado:** Fusionada.
- **Alcance visual:** Rediseño del listado de documentos, modales de subida y estados de revisión.
- **Rama:** main
- **Commit:** `d775087`.
- **Superficies modificadas:** `project-documents.tsx`, componentes relacionados.
- **Decisiones confirmadas:** Integración del listado de documentos dentro de la experiencia borderless.
- **Validaciones técnicas:** `npm run build:client` OK.
- **Validaciones manuales:** N/A.
- **Desviaciones:** Deuda funcional paralela (archivos huérfanos si la inserción en DB falla, D-11 en Plan Maestro). No resuelta en esta iteración visual.
- **Deuda funcional detectada:** Upload acoplado que no compensa fallos de base de datos.
- **Elementos enviados al backlog:** Endurecimiento funcional de subida de documentos (Fase 6 técnica).
- **Resultado:** Interfaz de fuentes alineada.
- **Siguiente acción autorizada:** Rediseño visual del módulo de Oferta y Catálogo.

### Fase 4D (Oferta y Catálogo)
- **Objetivo:** Rediseñar la sección de Oferta y Catálogo de proyectos.
- **Estado:** En curso.
- **Alcance visual:** Rediseño de la presentación de productos asociados al proyecto.
- **Rama:** `feature/chantia-catalog-module`.
- **Commit:** `d95df1c`.
- **Superficies modificadas:** `client/src/components/projects/project-analysis.tsx`, `client/src/pages/project-detail.tsx`.
- **Decisiones confirmadas:** Rediseño visual del catálogo de ofertas y productos.
- **Validaciones técnicas:** `npm run build:client` (WIP).
- **Validaciones manuales:** N/A.
- **Desviaciones:** N/A.
- **Deuda funcional detectada:** Tratamiento inestable de imágenes y referencias a productos.
- **Elementos enviados al backlog:** N/A.
- **Resultado:** Trabajo en progreso.
- **Siguiente acción autorizada:** N/A.
