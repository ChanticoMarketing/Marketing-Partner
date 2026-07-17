# Contexto Visual y de Experiencia

Este documento es la fuente de verdad estable sobre la identidad visual, estética y principios de experiencia de usuario de Chantia. No contiene registros de tareas ni flujos operativos, sino las directrices de diseño vigentes.

## 1. Esencia de Marca

- **Nombre:** Chantia
- **Concepto rector:** Chispa contenida.
- **Símbolo conceptual:** Núcleo activo.
- **Personalidad:** Estratégica, sobria, cálida, inteligente y humana.
- **Enfoque tecnológico:** La tecnología se aplica de forma útil e invisible, no exhibicionista. 
- **Estética a evitar:** Apariencia genérica de startup de IA, estética gamer, exceso de neón.

## 2. Principios de Experiencia

- **Claridad antes que espectáculo:** El diseño debe facilitar la tarea, no distraer de ella.
- **Resultado antes que decoración:** Todo elemento visual debe tener una función clara.
- **Baja carga cognitiva:** Evitar saturar la pantalla con decisiones simultáneas.
- **Jerarquía editorial:** Usar el peso, el tamaño y el contraste para guiar la vista hacia lo importante.
- **Progresión no bloqueante:** Permitir al usuario avanzar de manera fluida y gradual.
- **Estados comprensibles:** Todo estado del sistema debe ser evidente (cargando, error, guardado).
- **Acciones principales evidentes:** El camino de éxito siempre debe estar a la vista.
- **Uso responsable del espacio:** Densidad adecuada; ni demasiado compacta ni excesivamente suelta.
- **Consistencia sin uniformidad rígida:** Seguir patrones, pero adaptarlos a las necesidades del contexto.
- **Diseño funcional para usuarios no técnicos:** El lenguaje y la interfaz deben resultar accesibles a cualquier perfil.

## 3. Paleta Aprobada

La identidad de Chantia se apoya en los siguientes colores fundamentales:

- **Obsidian (#151312):** Base profunda, utilizada para fondos y contrastes máximos en modo oscuro, y para tipografía principal en modo claro.
- **Parchment (#F7F2E9):** Tono neutro y cálido para fondos de áreas de lectura o tarjetas en modo claro.
- **Ember (#B7432A):** Color de acción principal. Representa la "chispa". Úsalo para botones primarios, estados activos y confirmaciones críticas.
- **Warm Gold (#F6B94C):** Acento controlado. Útil para destacar elementos secundarios o estados de atención sin generar alarma.
- **Graphite (200: #D5D3CF, 400: #7A7A7A, 700: #2A2A2A):** Grises funcionales para bordes, textos secundarios, divisores y fondos inactivos.

**Reglas de uso:**
- **Comportamiento claro/oscuro:** Respeta el contraste funcional; Obsidian es texto en claro y fondo en oscuro.
- **Contraste:** Mantener siempre ratios de contraste accesibles (mínimo 4.5:1 para texto normal).
- **Prohibiciones:** No usar colores fuera de la paleta. Evitar el exceso de Ember; debe reservarse para guiar la acción.

## 4. Tipografía

- **Plus Jakarta Sans:** Usada exclusivamente para encabezados y jerarquías. Aporta carácter y modernidad.
- **Inter:** Usada para texto de cuerpo, formularios, tablas y navegación. Prioriza la legibilidad técnica.
- **Escalas:** Mantener saltos consistentes (ej. `text-sm`, `text-base`, `text-lg`, `text-2xl`).
- **Pesos:** Usar `medium` o `semibold` para títulos, `normal` para texto de cuerpo.
- **Lectura:** Limitar la longitud de línea (max 65-75 caracteres) para lectura cómoda.
- **Restricciones:** Evitar el uso excesivo de mayúsculas sostenidas en textos largos.

## 5. Composición

- **Preferencia borderless:** Favorecer composiciones sin bordes visibles cuando la agrupación por proximidad y espacio en blanco sea suficiente.
- **Secciones editoriales:** Estructurar el contenido como un documento bien editado.
- **Divisores discretos:** Usar líneas sutiles solo cuando el espacio en blanco no alcance para separar contextos.
- **Reducción de tarjetas:** Usar "cards" únicamente cuando representen entidades independientes, no para envolver cualquier contenido.
- **Evitar cajas dentro de cajas:** Mantener la jerarquía plana para reducir el ruido visual.
- **Reducción de paneles:** No abusar de paneles laterales o contenedores anidados.
- **Textos decorativos:** Evitar mini textos genéricos encima de todos los títulos. Los encabezados deben sostenerse solos.

## 6. Botones y Acciones

- **Ember:** Exclusivo para la acción principal de la pantalla.
- **Neutrales:** Acciones secundarias (Outline, Ghost) usando grises o colores de texto estandarizados.
- **Warm Gold:** Para acciones o indicadores que requieren atención pero no son la acción principal de éxito.
- **Destructivos:** Claramente diferenciados (generalmente tonos rojizos funcionales) y a menudo requiriendo confirmación.
- **Jerarquía:** Nunca poner dos botones primarios en el mismo nivel visual.
- **Interacción:** El foco (`focus-visible`) debe ser evidente. El área táctil debe ser de al menos 44x44px en móvil.
- **Regla:** No ocultar acciones necesarias exclusivamente bajo estados `hover`.

## 7. Estados Visuales

- **Loading:** Preferir esqueletos (skeletons) sutiles frente a spinners de pantalla completa.
- **Errores:** Informar con lenguaje claro y humano. **No mostrar errores técnicos (ej. stack traces, errores de BD) al usuario final.**
- **Estados vacíos (Empty states):** Deben ser ilustrativos, explicar el beneficio de la acción y proveer el botón para iniciarla.
- **Éxito y procesamiento:** Retroalimentación inmediata tras una acción.
- **Deshabilitado (Disabled):** Evitar si es posible; es preferible habilitar el botón y mostrar por qué falla al hacer clic. Si se usa, asegurar legibilidad y contraste.

## 8. Responsive (Adaptabilidad)

- **Mobile-first:** Diseñar considerando siempre cómo apilar y simplificar en pantallas estrechas.
- **Encabezados:** Adaptar tamaño y márgenes en viewports pequeños.
- **Apilamiento:** Las filas de acciones deben apilarse o usar scroll horizontal nativo si es necesario.
- **Prevención de overflow:** Impedir desbordamientos horizontales accidentales rompiendo texto largo o usando contenedores controlados.
- **Móvil:** Reducir la densidad de información y maximizar el área de los targets táctiles.
- **Diálogos:** En móvil, limitar altura y usar scroll interno o formato de panel inferior (drawer) si aplica.

## 9. Accesibilidad (A11Y)

- **Semántica:** Etiquetas HTML correctas y nombres accesibles (`aria-label`) para iconos y acciones.
- **Teclado:** Debe ser posible operar toda la interfaz mediante la tecla Tab y Enter/Espacio.
- **Foco:** El estado de foco debe ser siempre visible y obvio.
- **Imágenes:** Todo recurso gráfico funcional debe tener texto alternativo adecuado.
- **Dependencia de color:** Nunca comunicar información crucial (como un error) dependiento únicamente del cambio de color; usar iconos o texto de apoyo.
- **Movimiento reducido:** Respetar la preferencia del usuario (`@media (prefers-reduced-motion)`).

## 10. Movimiento y Animación

- **Contención:** Las animaciones deben ser funcionales, orientar al usuario e indicar cambios de estado.
- **Duración:** Transiciones cortas (150ms-300ms).
- **Prohibición:** Evitar movimiento decorativo permanente, zooms agresivos o transiciones de página completas lentas.
- **Bloqueo:** Ninguna funcionalidad principal debe depender de que una animación concluya.

## 11. Recursos Visuales Permitidos vs. Prohibidos

**PERMITIDOS:**
- Metáforas de convergencia y progreso.
- Indicadores discretos de "IA pensando".
- Patrones de fondo sutiles.
- Sombras de profundidad muy suave y direccional (luz contenida).
- Información visual estructurada y funcional.

**PROHIBIDOS:**
- Cohetes, robots físicos, cerebros o galaxias literales.
- Hologramas, neón o luces estridentes.
- Estética genérica de videojuego o "hacker".
- Exceso de gradientes multicolores o glassmorphism dominante.
- Sombras pesadas o "cajas" flotantes desconectadas.
- Iconografía decorativa que no cumpla una función.
- Repetición excesiva o estandarizada del isotipo de la marca como relleno.
- Interfaces estilo "tienda online" si el módulo no es de comercio electrónico puro.

## 12. Terminología Aprobada

Utiliza estos nombres exactos para las superficies del sistema:

- Centro de marca (Utiliza cuatro agrupaciones visuales que consolidan los dominios conceptuales del Plan Maestro)
- Fuentes de apoyo
- Oferta y catálogo
- Productos y servicios
- Estrategia
- Calendarios
- Chat
- Actividad

**Nota Importante:** Estos nombres aplican a la interfaz visible. Las entidades de datos internas (`projects`, `analysis_results`, `documents`, `products`) conservan sus nombres técnicos y no deben renombrarse en código o base de datos.

## 13. Estado Actual del Rebranding (Visual)

*Clasificación de superficies según el estado real de la implementación visual:*

- **Autenticación:** Implementada / En revisión.
- **Shell autenticado:** Implementada.
- **Dashboard:** Implementada.
- **Cartera de proyectos:** Implementada.
- **Alta rápida (identidad):** Implementada.
- **Espacio individual:** Implementada.
- **Centro de marca:** Fusionada.
- **Oferta y catálogo:** En revisión.
- **Fuentes de apoyo:** Fusionada.
- **Sistema visual global:** Aprobada e implementada como base.
