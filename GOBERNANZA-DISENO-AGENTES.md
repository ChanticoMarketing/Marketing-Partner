# Gobernanza Operativa para Agentes de Diseño

Este documento establece el contrato obligatorio para cualquier agente que participe en iteraciones de UI, UX o rebranding en el proyecto Chantia. Su cumplimiento es estricto y precede a cualquier preferencia o instrucción aislada.

## 1. Propósito

- **Proteger la coherencia visual:** Garantizar que Chantia mantenga una identidad estable y predecible.
- **Aislamiento de responsabilidades:** Evitar que los cambios visuales alteren la funcionalidad del sistema o introduzcan regresiones.
- **No interferencia:** Impedir que los agentes de diseño obstaculicen el trabajo paralelo en el backend, la lógica de negocio o la base de datos.
- **Iteraciones seguras:** Asegurar que cada cambio sea pequeño, reversible y verificable manualmente en menos de diez minutos.

## 2. Jerarquía de fuentes de verdad

Cuando exista duda o contradicción sobre una decisión, aplica este orden estricto de precedencia:

1. Instrucciones actuales del usuario.
2. Plan Maestro vigente (`PLAN-MAESTRO-REDISENO-PROYECTOS-v1.md`).
3. Contexto visual aprobado (`CONTEXTO-VISUAL-CHANTIA.md`).
4. Implementación actual en el repositorio (código y componentes).
5. Registro histórico de diseño (`BITACORA-REBRANDING.md`).
6. Propuestas futuras no aprobadas o suposiciones de diseño.

*Nota:* Si dos fuentes se contradicen claramente, notifica al usuario y detén la ejecución hasta que se resuelva la ambigüedad, priorizando siempre la implementación vigente frente a documentos históricos desactualizados.

## 3. Protocolo obligatorio antes de trabajar

Todo agente debe completar estos pasos antes de modificar código:

1. **Revisar el estado real:** Inspeccionar el repositorio actual, no asumir versiones de memoria.
2. **Identificar la fase:** Confirmar en qué fase del rebranding se enmarca la petición.
3. **Clasificar la tarea:** Determinar explícitamente si la solicitud es puramente visual, puramente funcional o mixta.
4. **Detectar riesgos:** Identificar si el cambio visual requiere modificar consultas, dependencias o permisos.
5. **Comprobar la validación:** Asegurar que la tarea puede validarse manualmente en menos de diez minutos; si no es así, dividir la tarea.
6. **Detención inmediata:** Si se descubre que un cambio aparentemente visual obliga a modificar lógica de negocio o contratos de datos, detenerse de inmediato.

## 4. Alcance permitido en iteraciones visuales

Durante una iteración de diseño, **SE PERMITE** modificar:

- Jerarquía de la información.
- Layout y estructura de pantalla.
- Espaciado (márgenes, paddings).
- Tipografía (familias aprobadas, pesos, tamaños).
- Color (paleta aprobada y modos claro/oscuro).
- Iconografía (sustitución, tamaño y alineación).
- Microcopy (textos de la interfaz y etiquetas).
- Estados visuales (hover, active, focus, disabled).
- Responsive (comportamiento en distintos viewports).
- Accesibilidad (atributos ARIA visuales, contrastes, foco).
- Movimiento (transiciones y animaciones permitidas).
- Componentes puramente presentacionales.

## 5. Alcance prohibido en iteraciones visuales

Durante una iteración de diseño, **ESTÁ ESTRICTAMENTE PROHIBIDO** modificar:

- Consultas (Supabase, TanStack Query, fetch).
- Mutaciones (inserciones, actualizaciones, borrados).
- Contratos de datos (esquemas de base de datos, tipos de TypeScript).
- Payloads (forma en que se envían los datos al servidor).
- Validaciones lógicas de negocio (reglas de Zod, comprobaciones de estado).
- Permisos y Autenticación.
- RLS (Row Level Security).
- Storage (creación de buckets, políticas de subida).
- Base de datos (migraciones SQL, esquemas).
- Funciones remotas (Edge Functions, Webhooks).
- Reglas de negocio u orquestación.
- Estados persistidos.
- Rutas (creación o eliminación de rutas principales).
- Dependencias (package.json).
- Integraciones de terceros.

*Si una mejora visual no puede realizarse sin alterar alguno de estos puntos, el agente debe detenerse, documentar el hallazgo y trasladar la tarea al backlog funcional.*

## 6. Control de alcance

- **Una sola superficie por iteración:** No agrupes cambios de diferentes módulos en un solo commit o rama.
- **Rondas de corrección:** Máximo una ronda de correcciones tras la implementación principal. Las correcciones adicionales no bloqueantes se registran en el backlog.
- **Cero oportunismo:** No realices "mejoras" adicionales solo porque pasaste por un archivo.
- **No refactorizar por preferencia:** Mantén el código existente si funciona, aunque no encaje con tu estilo personal.
- **Sin propagación de coherencia:** No modifiques otras superficies no solicitadas para "igualarlas" a tu cambio actual.
- **Separación de deuda:** Nunca combines una tarea de rebranding con la resolución de deuda técnica o bugs funcionales preexistentes.

## 7. Definición de bloqueo

Una fase visual cerrada solo debe reabrirse si se cumple alguna de estas condiciones críticas:

- El proyecto no compila.
- No se puede acceder a la superficie visual.
- Una acción principal ha dejado de funcionar.
- Existe una regresión de datos (pérdida o corrupción visualizada).
- La interfaz es completamente inutilizable en dispositivos móviles.
- El contraste impide utilizarla y viola severamente la accesibilidad.
- La navegación por teclado queda bloqueada (trampas de foco).
- El resultado contradice de manera directa e indiscutible la identidad aprobada.

**No reabrir por:**
- Diferencias menores de píxeles o márgenes.
- Preferencias subjetivas de diseño.
- Refinamientos cosméticos.
- Posibles mejoras futuras (esas van al backlog).
- Colores secundarios no ideales pero utilizables.
- Ausencia de animaciones no esenciales.

## 8. Disciplina de Git

- Trabajar siempre en una **rama independiente** y descriptiva.
- Basar la rama en el estado principal (`main`) más reciente.
- **Jamás** enviar cambios directamente a la rama principal (no hacer push directo a main).
- Preparar un **commit descriptivo** que explique qué se hizo visualmente.
- Incluir en el commit **únicamente** los archivos modificados para esta iteración.
- Evitar el staging indiscriminado (`git add .` sin revisar).
- Reportar al usuario el nombre de la rama, hash, estado de compilación y validaciones realizadas.
- Esperar la revisión manual antes de fusionar.

## 9. Validación obligatoria

Toda iteración visual debe revisarse contra esta lista de control antes de declararse terminada:

- [ ] Escritorio.
- [ ] Tablet.
- [ ] Móvil.
- [ ] Tema claro.
- [ ] Tema oscuro.
- [ ] Estado de carga (loading, skeletons).
- [ ] Estado de error.
- [ ] Estado vacío (empty state).
- [ ] Datos parciales o ausentes.
- [ ] Comportamiento ante contenido largo.
- [ ] Navegación por teclado.
- [ ] Foco visible.
- [ ] Contraste suficiente.
- [ ] Soporte para reducción de movimiento (`prefers-reduced-motion`).

## 10. Formato de Handoff

Al finalizar una iteración, el agente debe entregar un reporte breve con la siguiente estructura:

- **Qué se modificó:** (Lista concreta de cambios visuales).
- **Qué se preservó:** (Funcionalidades, datos o lógica intacta).
- **Qué se validó:** (Resultados de la validación local).
- **Qué no pudo validarse:** (Casos que requieren un entorno específico).
- **Qué deuda preexistente se detectó:** (Hallazgos ajenos a la tarea).
- **Siguiente acción autorizada:** (Paso siguiente recomendado al usuario).
