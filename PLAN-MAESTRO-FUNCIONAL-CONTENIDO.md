# Plan Maestro Funcional — Plataforma de contenido para agencias y marcas multiproducto

**Versión:** 1.0  
**Fecha:** 2026-07-10  
**Tipo:** definición funcional y de producto; no describe implementación técnica.

## 1. Decisión de producto

El proyecto ya tiene una base válida para **investigar una marca, conservar su contexto y generar calendarios de contenido**. Aún no representa el ciclo completo de una agencia o de una marca con varios productos.

La evolución necesaria es pasar de:

> “generar un calendario para un proyecto”

a:

> “gestionar una cartera de marcas, productos, campañas y piezas; aprobarlas, ejecutarlas y aprender de sus resultados”.

El producto debe servir para dos escenarios:

- **Agencia:** varios clientes y marcas, con responsables, revisiones y entregables separados.
- **Marca multiproducto:** una marca, varias líneas o productos, con contenido y resultados comparables por producto.

## 2. Alcance funcional

### Incluido

- Organización de clientes, marcas, productos y campañas.
- Estrategia de marca progresiva y reutilizable.
- Briefs de campaña y de pieza.
- Producción, revisión, aprobación y versionado.
- Calendario editorial y estado de ejecución.
- Biblioteca de conocimiento, ejemplos y activos.
- Medición por marca, campaña, canal y producto.
- Operación multiusuario y multi cliente.

### No incluido en este plan

- Decisiones de framework, base de datos, APIs, permisos técnicos o arquitectura.
- Elección de proveedores de publicación o analítica.
- Rediseño visual detallado.

## 3. Datos que ya existen y deben reutilizarse

| Fuente actual | Datos disponibles | Deben alimentar |
|---|---|---|
| Proyecto | Nombre, cliente, descripción, fechas, estado, creador | Identidad de marca, cartera de trabajo, filtros y contexto general |
| Estrategia de marca | Misión, visión, valores, objetivos, audiencia, buyer persona, tono, estilo, arquetipos, propuesta de valor, palabras clave, temas, competencia, objeciones, vocabulario, citas y calendario estacional | Briefs, generación de ideas, criterios de revisión y consistencia de mensajes |
| Productos | Nombre, descripción, imagen, SKU y precio | Catálogo, campañas por producto, beneficios, mensajes, comparaciones y medición |
| Documentos y conocimiento | Manuales, tono, colores, ejemplos, publicaciones, diseños, FAQ, CTA, palabras permitidas/evitadas, estado y aprobación | Evidencia de marca y referencias aprobadas para la IA y el equipo |
| Calendarios | Nombre, descripción, instrucciones, canal, fecha, hora, título, contenido, copy, hashtags y dirección de diseño | Plan editorial, producción y control de entregables |
| Historial de contenido | Versiones, cambios, usuario y fecha | Revisión, trazabilidad y aprendizaje editorial |
| Tareas y colaboración | Responsable, estado, prioridad, fechas, dependencias, comentarios y adjuntos | Flujo de producción y coordinación de agencia |
| Chat del proyecto | Conversaciones entre equipo y asistente | Descubrimiento y apoyo operativo; no debe convertirse automáticamente en fuente aprobada |

## 4. Modelo funcional objetivo

```text
Cartera / cliente
        ↓
      Marca
        ↓
 Línea o producto
        ↓
 Campaña / objetivo
        ↓
 Pieza de contenido
        ↓
 Revisión → aprobación → publicación → resultado → aprendizaje
```

El usuario debe poder llegar a cualquier nivel sin perder el contexto de los niveles superiores.

## 5. Capacidades que debemos agregar

### F0 — Definiciones y base operativa

**Objetivo:** eliminar ambigüedades antes de ampliar el producto.

**Funciones**

- Definir si cada proyecto representa una marca, un cliente o una campaña.
- Definir la diferencia entre cliente, marca, línea de producto y producto.
- Definir estados comunes para proyectos, campañas y piezas.
- Definir quién puede crear, editar, revisar, aprobar y consultar.
- Definir qué significa “publicado” y qué resultados se consideran válidos.

**Datos que se reutilizan:** proyecto, creador, usuarios, roles, estado y fechas.

**Criterio de salida:** una persona nueva puede explicar la estructura del trabajo sin recurrir a nombres técnicos o convenciones ocultas.

### F1 — Cartera de clientes y marcas

**Objetivo:** hacer operable el producto para una agencia.

**Funciones**

- Vista de cartera con clientes y marcas administradas.
- Selector de marca activo que filtre todo el trabajo.
- Resumen de campañas, productos, piezas pendientes y resultados por marca.
- Acceso claro al espacio de cada marca.
- Separación visual y funcional entre marcas con nombres similares.

**Datos que se reutilizan:** nombre del proyecto, cliente, descripción, color, imagen, estado, fechas y creador.

**Datos que deben definirse funcionalmente:** relación entre cliente y marca, aunque inicialmente una marca pueda seguir viviendo dentro de un proyecto.

**Criterio de salida:** una agencia puede administrar varias marcas sin mezclar estrategia, productos, calendarios o resultados.

### F2 — Centro de marca progresivo

**Objetivo:** que la IA y el equipo sepan qué debe mantenerse constante y qué puede variar.

**Funciones**

- Vista de salud de la estrategia: completo, parcial o sin definir.
- Secciones editables y no bloqueantes: identidad, oferta, audiencia, voz, contenido, canales, fechas y referencias.
- Mostrar de dónde proviene cada dato: estrategia declarada, documento aprobado o hipótesis pendiente.
- Mostrar qué datos ya se usan para generar contenido.
- Detectar contradicciones entre documentos y estrategia sin decidir automáticamente cuál es correcta.
- Permitir guardar una sección sin completar todo el centro.

**Datos que se reutilizan:** todos los campos actuales de estrategia, productos y documentos aprobados.

**Regla funcional:** ningún campo estratégico vacío impide crear un calendario; reduce la confianza o personalización y genera una recomendación concreta para completarlo.

**Criterio de salida:** el equipo sabe qué conoce la plataforma, qué falta y qué evidencia respalda cada decisión de contenido.

### F3 — Catálogo y estrategia de productos

**Objetivo:** hacer que una marca multiproducto pueda crear contenido específico sin perder coherencia de marca.

**Funciones**

- Catálogo navegable con ficha de cada producto.
- Estado del producto: activo, próximo lanzamiento, temporal, descontinuado o en promoción.
- Mensaje principal, beneficio, prueba, objeciones y CTA por producto.
- Selección de uno o varios productos al crear una campaña.
- Comparación de productos y reglas para evitar mensajes contradictorios.
- Vista de contenido creado, aprobado, publicado y con resultados por producto.

**Datos que se reutilizan:** nombre, descripción, imagen, SKU y precio; además de propuesta de valor, audiencia, objeciones, vocabulario, documentos y calendario estacional de la marca.

**Criterio de salida:** cada pieza puede responder “¿para qué producto es?”, “¿qué objetivo cumple?” y “¿cómo rindió?”.

### F4 — Brief de campaña

**Objetivo:** convertir una necesidad de marketing en una instrucción operable para contenido.

**Funciones obligatorias del brief**

- Marca y producto(s) involucrados.
- Objetivo de negocio y objetivo de comunicación.
- Audiencia o segmento.
- Insight o problema.
- Promesa y razón para creer.
- Oferta, beneficio o mensaje prioritario.
- Objeciones que debe resolver.
- Canales y formatos.
- Etapa del embudo.
- Fechas, temporada y restricciones.
- CTA.
- Criterio de aprobación.

**Datos que se reutilizan:** objetivos, audiencia, propuesta de valor, temas, objeciones, citas, vocabulario, competencia, canales, calendario estacional, productos y documentos aprobados.

**Criterio de salida:** una campaña puede ser revisada por otra persona sin necesitar una explicación oral adicional.

### F5 — Generación y edición de contenido con trazabilidad

**Objetivo:** pasar de ideas generadas a piezas listas para revisión.

**Funciones**

- Generar varias ideas desde un brief y explicar por qué cada una existe.
- Convertir una idea en piezas por canal y formato.
- Mantener visibles audiencia, promesa, prueba, objeción, CTA y etapa.
- Separar contenido sugerido por IA de contenido aprobado por una persona.
- Regenerar una parte sin perder el resto de la pieza.
- Guardar versiones y motivo del cambio.
- Crear instrucciones de diseño y referencias visuales sin confundirlas con el arte final.

**Datos que se reutilizan:** calendarios y entradas existentes, contenido, copies, hashtags, instrucciones de diseño, imágenes de referencia, chat y documentos aprobados.

**Criterio de salida:** una pieza tiene contexto, responsable, versión y razón de aprobación; no es solo texto generado.

### F6 — Flujo editorial y revisión de cliente

**Objetivo:** hacer confiable el trabajo de agencia.

**Funciones**

- Estados visibles: idea, borrador, en revisión interna, cambios solicitados, aprobado por agencia, enviado a cliente, aprobado por cliente, programado, publicado, rechazado o archivado.
- Comentarios vinculados a una pieza y no solo al proyecto.
- Solicitud de cambios con responsable y fecha.
- Aprobación explícita con usuario y fecha.
- Bloqueo de publicación cuando falta aprobación requerida.
- Vista “qué necesita mi atención”.
- Historial comprensible para equipo y cliente.

**Datos que se reutilizan:** tareas, responsables, comentarios, usuarios, historial de contenido, calendario y documentos aprobados.

**Criterio de salida:** una agencia puede demostrar quién aprobó qué, cuándo, con qué versión y qué cambios se solicitaron.

### F7 — Calendario editorial ejecutable

**Objetivo:** que el calendario sea un instrumento de operación, no solo un documento generado.

**Funciones**

- Vista mensual, semanal y por campaña/producto/canal.
- Filtros por marca, producto, responsable, estado, canal y objetivo.
- Identificación de huecos, conflictos y exceso de publicaciones.
- Reprogramación con motivo visible.
- Estado de preparación de cada fecha.
- Exportación diferenciando plan, aprobado y publicado.
- Resumen de entregables atrasados o incompletos.

**Datos que se reutilizan:** fechas, horas, plataformas, títulos, contenido, copy, hashtags, instrucciones de diseño, campañas, tareas y estados.

**Criterio de salida:** el equipo puede responder qué se publica, cuándo, dónde, para quién, con qué producto y quién lo debe entregar.

### F8 — Biblioteca de conocimiento y activos

**Objetivo:** conservar evidencia y reducir repetición de trabajo.

**Funciones**

- Biblioteca por marca con filtros por categoría, producto, campaña y estado.
- Separación clara entre fuente aprobada, referencia en revisión y material archivado.
- Relación de un documento con una o varias campañas o productos.
- Búsqueda de ejemplos por canal, objetivo, formato y resultado.
- Indicador de documentos que necesitan revisión.
- Reutilización de un activo sin duplicar la fuente original.

**Datos que se reutilizan:** documentos, categorías, subcategorías, contenido, metadata, estado, aprobación, productos e imágenes.

**Criterio de salida:** la IA y el equipo pueden distinguir evidencia aprobada de inspiración o material pendiente.

### F9 — Resultados y aprendizaje

**Objetivo:** cerrar el ciclo entre contenido y decisión de marketing.

**Funciones**

- Dashboard por marca, campaña, producto, canal y periodo.
- Separar producción de rendimiento: piezas creadas no equivalen a piezas exitosas.
- Métricas de operación: tiempo de aprobación, entregas a tiempo, cambios por pieza y volumen publicado.
- Métricas de contenido: alcance, impresiones, reproducciones, interacción, clics, conversiones y costo cuando exista.
- Comparar productos, formatos, temas, CTA y canales.
- Registrar hipótesis y aprendizajes sin presentarlos como causalidad.
- Recomendaciones para el siguiente calendario basadas en datos suficientes.

**Datos que se reutilizan:** fechas, plataformas, contenido, producto, campaña, estado, tareas, historial y resultados que se incorporen desde los canales.

**Criterio de salida:** cada periodo termina con decisiones accionables: qué repetir, qué ajustar, qué detener y qué aún no puede concluirse.

### F10 — Operación de agencia

**Objetivo:** hacer escalable la entrega a varios clientes.

**Funciones**

- Plantillas de brief, campaña, revisión y reporte.
- Asignación de responsables por función: estrategia, copy, diseño, aprobación y cuenta.
- Bandeja de trabajo por usuario.
- Vistas de carga y capacidad por periodo.
- Fechas de entrega internas y de cliente.
- Reporte exportable por marca con resumen, calendario, piezas y resultados.
- Registro de decisiones y acuerdos del cliente.

**Datos que se reutilizan:** usuarios, roles, tareas, asignaciones, comentarios, fechas, proyectos, calendarios, documentos e historial.

**Criterio de salida:** aumentar el número de marcas no obliga a crear procesos paralelos fuera de la plataforma.

## 6. Priorización

### Imprescindible para el primer producto operable

1. F1 — separación clara de marcas/proyectos.
2. F2 — centro de marca progresivo y transparente.
3. F3 — relación funcional entre producto, campaña y pieza.
4. F4 — brief de campaña.
5. F6 — aprobación y comentarios por pieza.
6. F7 — calendario con estados y filtros.

### Siguiente nivel

7. F5 — generación trazable y versionado.
8. F8 — biblioteca de activos relacionada con campañas y productos.
9. F10 — plantillas y operación de agencia.

### Después de tener datos confiables

10. F9 — resultados, comparación y aprendizaje.
11. Automatizaciones de publicación y recomendaciones avanzadas.

## 7. Métricas de éxito funcional

### Activación

- Tiempo desde crear una marca hasta generar su primer brief.
- Porcentaje de proyectos con estrategia mínima y producto(s) identificados.
- Porcentaje de calendarios que contienen objetivo, canal, producto y CTA.

### Calidad y operación

- Porcentaje de piezas aprobadas en el primer ciclo.
- Promedio de rondas de cambios por pieza.
- Tiempo entre borrador y aprobación.
- Porcentaje de entregas a tiempo.
- Porcentaje de piezas con fuente o referencia de marca.

### Escala

- Marcas activas por equipo.
- Productos gestionados por marca.
- Campañas simultáneas sin mezcla de contexto.
- Tiempo de preparación de un reporte por marca.

### Resultado

- Rendimiento por producto, campaña, canal y formato.
- Incremento o decremento frente al periodo comparable.
- Porcentaje de conclusiones respaldadas por datos suficientes.

## 8. Reglas de calidad y guardrails

- Nunca tratar un campo vacío como una verdad.
- Separar dato declarado, evidencia aprobada, sugerencia de IA e hipótesis.
- No afirmar que una pieza funcionó sin exposición, periodo y métrica verificables.
- No permitir que un producto aparezca en contenido sin que el responsable lo confirme cuando la campaña sea comercial.
- No aprobar una pieza sin audiencia, objetivo, canal, CTA y criterio de revisión.
- No mezclar documentos de marcas distintas.
- No convertir conversaciones del chat en conocimiento oficial sin revisión.
- No bloquear la creación de una marca por falta de estrategia; sí advertir qué contexto falta.

## 9. Decisiones pendientes del negocio

Estas decisiones no deben ser inventadas por el agente técnico:

- ¿Un proyecto representa una marca, un cliente o puede representar ambos?
- ¿Una marca puede tener varias líneas, regiones o idiomas?
- ¿Qué aprobaciones son obligatorias para cada tipo de cliente?
- ¿Qué canales se consideran prioritarios en la primera versión?
- ¿Qué datos de rendimiento se consideran oficiales?
- ¿Qué diferencia existe entre contenido orgánico, paid, lifecycle y contenido comercial?
- ¿Un producto puede pertenecer a más de una campaña?
- ¿Qué información puede ver un cliente externo?
- ¿Cuál es la cadencia de reportes: semanal, mensual o por campaña?

## 10. Entregable para el agente técnico

El trabajo técnico debe recibir cada fase con este contrato funcional:

1. Usuario y situación de uso.
2. Resultado que debe poder lograr.
3. Datos actuales que debe mostrar o reutilizar.
4. Datos nuevos estrictamente necesarios, si los hubiera.
5. Estados y transiciones visibles.
6. Reglas de aprobación y calidad.
7. Criterios de aceptación observables.
8. Casos vacíos, legacy, error y recuperación.
9. Métrica de éxito.

No se debe iniciar por tablas o componentes. Primero debe aceptarse la función, el dato que la respalda y la prueba de que resuelve el trabajo de la agencia o de la marca.

## 11. Próximo paso recomendado

Realizar una sesión de definición de 60–90 minutos con una agencia o equipo de marca y cerrar las decisiones de la sección 9. Después, convertir F1–F7 en historias funcionales priorizadas, usando los datos existentes de la sección 3 como contrato de producto.

**Criterio global de “listo para agencia”:** una marca puede pasar de estrategia a campaña, de campaña a piezas aprobadas, de piezas aprobadas a calendario ejecutable y de calendario a reporte, sin perder el producto, el objetivo, el responsable ni la evidencia que justifica cada decisión.
