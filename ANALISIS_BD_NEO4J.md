# Análisis de la base de datos REFRACTS (Neo4j) y cambios en el diseño

> Fuente: `DISEÑObd_REFRACTS` (export de arrows.app, copiado en `docs/diseno_bd_refracts.json`). Análisis del 12/11/2026, revisado el mismo día con dos premisas del autor:
> 1. **El modelo puede cambiar**: se pueden añadir tipos de relación, de evento y de entidad. La aplicación no debe depender de una lista cerrada.
> 2. **Las relaciones no tienen valor de relevancia**. Al consultar la BD se mira si la tiene; **si no, se le asigna y se guarda**, de modo que solo se calcula la relevancia de lo que de verdad se necesita, y una sola vez.
>
> Sirve para el capítulo 4 (modelo de datos) y el capítulo 5 (diseño), y como base del prompt `prompt_iteracion3b_neo4j_vscode.md`.

## 1. Qué hay en el diseño

### 1.1 Nodos principales (azules)

| Etiqueta | Propiedades | Papel en la aplicación |
|---|---|---|
| `Person` | `name`, `lastName` | **Entidad**: persona |
| `Organization` | `name_es`, `name_ca`, `name_en` | **Entidad**: organización |
| `HeritageItem` | `name_es`, `name_ca`, `name_en`, `dimensions` | **Entidad**: obra (bien patrimonial) |
| `Relationship` | (ninguna) | **Intermediario**: relación entre personas, convertida en nodo |
| `Event` | `name_es`, `name_ca`, `name_en` (en el export aparecen como *labels*, seguramente por error) | **Intermediario**: hecho en el que participan entidades |
| `Period` | `from`, `to`, `description` | **Auxiliar**: cuándo |
| `Ubication` | `name_es/ca/en`, `adminLevel`, `coordinates` (point) | **Auxiliar**: dónde; jerarquía con `IS_IN` |
| `Image` | `url`, `caption` | **Auxiliar**: imágenes |
| `ExternalSource` | `name`, `url`, `lastUpdated`, `isAutomated` | **Auxiliar**: de dónde sale el dato |

### 1.2 Subtipos (rojos, unidos con `IS_A`)

- `Person` ← `Creator` ← `Painter`, `Designer`
- `Event` ← `Birth`, `Death`, `Live`, `Work`, `Fund`, `Wedding`, `Exposition`, `Creation` (← `Paint`, `Design`)
- `Relationship` ← `Related` (← `Marriage`, `Filiation`), `Professional` (← `Employement`, `coworking`), `Friendship`, `Mentorship`
- `ExternalSource` ← `Book` (`ISBN`, `Editorial`, `Published`), `API`, `Web` (`scrapable`)

Los nodos verdes son copias de etiquetas ya existentes, puestas solo para dibujar las flechas de `HAS_EXTERNAL_SOURCE`.

### 1.3 Relaciones

| Relación | De → A | Propiedades |
|---|---|---|
| `HAS_ROLE_IN` | Person → Relationship | `role` |
| `PARTICIPATES_IN` | Person → Event | `role` |
| `PRODUCED` y `CREATE` | Creation → HeritageItem | — |
| `CREATE` | Fund → Organization | — |
| `IS_EXPOSED` | Exposition → HeritageItem | — |
| `OCURRED_AT` | Relationship / Event → Organization | `date` (en Event) |
| `TOOK_PLACE_AT` | Relationship / Event → Ubication | `date` (en Event) |
| `OCURRED_DURING` | Relationship / Event → Period | — |
| `LOCATED_IN` | Organization → Ubication | — |
| `IS_IN` | Ubication → Ubication | — |
| `PROMPTED`, `TRIGGERED`, `LED_TO` | Relationship ↔ Event, Relationship → Relationship | — |
| `HAS_IMAGE` | Person / Organization / HeritageItem / Event → Image | `order` |
| `HAS_EXTERNAL_SOURCE` | casi todo → ExternalSource | `dateUpdated`, `externalId` |

## 2. Consecuencias para el proyecto

1. **Las entidades no se relacionan directamente**, sino a través de nodos `Relationship` y `Event`. La aplicación tiene que **derivar** las relaciones entre entidades (§3).
2. **No hay valor de relevancia.** Se asigna al consultar, solo a las relaciones que se recorren, y se guarda en la BD (§4).
3. **El modelo puede crecer.** Nada puede depender de una lista fija de etiquetas o de caminos: la clasificación de las etiquetas (entidad, intermediario, auxiliar) va en la **configuración**, y lo que no se conozca se trata con reglas por defecto (§3.2).
4. **Los tipos forman una jerarquía** (`Marriage` → `Related` → `Relationship`), que sirve para dar un peso por defecto a los tipos nuevos (el del padre) y para agrupar la leyenda. La jerarquía se lee de la BD, no se escribe en el código.
5. **Los nombres están en tres idiomas** (`name_es`, `name_ca`, `name_en`), salvo las personas (`name` + `lastName`). El buscador debe buscar en todos.
6. **Las fechas y los lugares son eventos y nodos auxiliares**, no propiedades de la entidad: el nacimiento es un evento `Birth` con su `Period` y su `Ubication`; la fundación, un evento `Fund`. Desaparecen `Persona.fechaNacimiento`, `Organizacion.fechaFundacion`, `ObraDeArte.fechaCreacion` y `tecnica`; esos datos van a un **detalle** que se pide al seleccionar la entidad.
7. **No hay `description`** en las entidades. El panel mostrará subtipos (pintor, diseñador), eventos, imágenes y fuentes.
8. **Hay imágenes y fuentes externas.** Mostrar las fuentes ayuda a cumplir la atribución de RNF-27.
9. **No hay una propiedad `id`**: se usa `elementId(n)` (preguntar si hay un identificador estable, que haría falta para RF-35).

## 3. Relaciones derivadas: una regla genérica

### 3.1 Clasificación de las etiquetas (en la configuración, RNF-16)

```json
"etiquetasEntidad":      { "Person": "PERSONA", "Organization": "ORGANIZACION", "HeritageItem": "OBRA_DE_ARTE" },
"etiquetasAuxiliares":   ["Period", "Ubication", "Image", "ExternalSource"],
"tiposSinRelacion":      ["Birth", "Death", "Live"],
"relacionesIgnoradas":   ["IS_A", "IS_IN", "LOCATED_IN", "HAS_IMAGE", "HAS_EXTERNAL_SOURCE", "PROMPTED", "TRIGGERED", "LED_TO"],
"maxParticipantesIntermediario": 10
```
Todo nodo que no es entidad ni auxiliar es un **intermediario** (`Relationship`, `Event` y cualquier etiqueta nueva que se añada). Si mañana se añade, por ejemplo, `Commission` (encargo), funciona sin tocar el código.

### 3.2 La regla

1. **Por intermediario.** Si un intermediario está unido (por cualquier relación no ignorada y en cualquier sentido) a dos o más entidades, se crea una relación derivada **por cada pareja** de esas entidades. Tipo = etiqueta **más específica** del intermediario. Así salen, sin escribirlos uno a uno, todos los casos del diseño actual: persona–persona por una `Relationship` (matrimonio, mentoría…), persona–organización por una `Relationship` o un `Event` con `OCURRED_AT` (empleo, trabajo), persona–obra por una `Creation` (`PARTICIPATES_IN` + `PRODUCED`/`CREATE`), persona–organización por un `Fund` (`CREATE`), obra–organización por una `Exposition` y persona–persona por haber participado en el mismo evento.
2. **Directa.** Si en el futuro se añade una relación directa entre dos entidades (por ejemplo `(:Person)-[:STUDENT_OF]->(:Person)`), se toma tal cual. Tipo = el tipo de la relación.
3. **Límites.** No se aplica a los `tiposSinRelacion` (`Birth`, `Death`, `Live`: son datos de la persona y van al detalle) ni a intermediarios con más de `maxParticipantesIntermediario` entidades (un evento con 50 asistentes daría 1 225 parejas).
4. **Datos de la relación.** Cada relación derivada guarda el id del intermediario, los **roles** (propiedad `role` de la relación que une cada entidad al intermediario, si existe), el **periodo** (`Period` unido al intermediario), el **lugar** (`Ubication`) y la **fecha** (`date`) cuando los haya. En el panel: «Ana (maestra) → Luis (aprendiz), 1902–1908, Valencia».

Dos relaciones derivadas con el mismo par y distinto intermediario son distintas (se dibujan como curvas separadas, RF-38).

## 4. Relevancia: se asigna al consultar y se guarda

### 4.1 Dónde se guarda

La relevancia es de la **relación de la BD que la produce**:
- de una relación por intermediario → propiedad `relevance` **del nodo intermediario** (todas las parejas de una misma `Relationship` o `Event` comparten valor);
- de una relación directa → propiedad `relevance` **de la relación**.

Junto a ella se guardan `relevanceSource` (`"auto"`, o `"manual"` si la pone una persona) y `relevanceVersion` (versión de la tabla de pesos con la que se calculó).

### 4.2 Cuándo se calcula

Durante el recorrido del vecindario, el servidor lee `relevance` de cada intermediario que encuentra:
- si la tiene (y es manual, o automática con la versión actual de los pesos), la usa;
- si **no** la tiene (o es automática y de una versión antigua), la **calcula y la guarda** en ese momento;
- las relaciones que no se recorren **nunca se calculan**.

Así, la primera vez que alguien explora una zona del grafo se completan sus relevancias, y las siguientes visitas ya no calculan nada. Un valor `"manual"` nunca se sobrescribe, de modo que el grupo de investigación puede corregir a mano cualquier valor. Si dos usuarios asignan a la vez la misma relevancia no pasa nada: el valor es el mismo (en Cypher, `SET n.relevance = coalesce(n.relevance, $valor)`).

### 4.3 Cómo se calcula: estrategia `RelevanciaPorTipo`

Patrón Estrategia (`EstrategiaRelevancia`), ahora en el **servidor**, porque es donde se guarda el valor:
1. Peso del tipo en la tabla `pesosRelevancia` de la configuración.
2. Si no está, el del **padre más cercano** en la jerarquía (un tipo nuevo `Apprenticeship` que herede de `Professional` recibe el peso de `Professional`).
3. Si tampoco, `pesoPorDefecto` (0,5).

Pesos iniciales propuestos (**a validar con el tutor**; cambiar un peso aumenta `versionPesos` y las relevancias automáticas se recalculan cuando se vuelvan a recorrer):

| Tipo | Peso | | Tipo | Peso |
|---|---|---|---|---|
| `Marriage` | 0,95 | | `Creation` (y `Paint`, `Design`) | 0,90 |
| `Filiation` | 0,90 | | `Fund` | 0,85 |
| `Mentorship` | 0,85 | | `Work` | 0,60 |
| `Friendship` | 0,75 | | `Wedding` | 0,60 |
| `Related` | 0,70 | | `Exposition` | 0,50 |
| `coworking` | 0,65 | | `Event` (otros) | 0,40 |
| `Employement` | 0,60 | | `Relationship` (genérica) | 0,50 |
| `Professional` | 0,55 | | | |

La estrategia es sustituible: más adelante se puede tener en cuenta, por ejemplo, la duración del periodo o el número de participantes, sin cambiar el resto.

### 4.4 Qué queda para el cliente

El navegador sigue haciendo el cálculo pesado: recibe un vecindario con la **relevancia ya asignada a cada relación** y calcula la relevancia de los nodos (producto del camino), el subgrafo «primero el mejor», la poda, la centralidad, los colores y la búsqueda. Vuelve a usar `RelevanciaDesdeBD`, que ahora sí tiene un valor que leer. El servidor solo asigna lo que falta porque es lo único que hay que **guardar** en la BD.

## 5. Permisos: choca con RNF-11

RNF-11 dice que la aplicación accede a la BD **solo con permisos de lectura**. Guardar la relevancia necesita escribir. Opciones (a decidir con el tutor):
1. **Permiso de escritura solo sobre `relevance`, `relevanceSource` y `relevanceVersion`.** Neo4j Enterprise permite dar permiso para modificar propiedades concretas (`GRANT SET PROPERTY {…}`). RNF-11 pasaría a decir «solo lectura, salvo las propiedades de relevancia».
2. **Si no se puede escribir en la BD**, guardar las relevancias en un almacén propio del servidor (un fichero o una pequeña base de datos), con la misma interfaz. El resto no cambia.

Por eso el guardado va detrás de una interfaz, `AlmacenRelevancias`, con dos implementaciones: en la propia BD y en un almacén local. Los datos simulados usan la primera (escriben en el grafo en memoria).

## 6. Cambios en las clases

| Clase | Cambio |
|---|---|
| **Servidor** `ClasificadorEtiquetas` (nueva) | sabe, a partir de la configuración y de la jerarquía leída de la BD, si una etiqueta es entidad, auxiliar o intermediario, cuál es la más específica de un nodo y sus padres |
| **Servidor** `ProyectorRelaciones` (nueva) | regla genérica de §3.2 sobre el grafo simulado (en la BD real, consultas Cypher) |
| **Servidor** `EstrategiaRelevancia`, `RelevanciaPorTipo` | vuelven al servidor (§4.3) |
| **Servidor** `AlmacenRelevancias` (interfaz) y `AlmacenRelevanciasEnGrafo` | lee y guarda `relevance` (§4.1, §5) |
| **Servidor** `AsignadorRelevancia` (nueva) | durante el recorrido: si falta o está anticuada, calcula con la estrategia y guarda con el almacén |
| **Servidor** `RepositorioDatos` | `obtener_tipos`, `obtener_nombres`, `obtener_vecindario(id, umbral, max)` (asigna relevancias por el camino y solo sigue relaciones por encima del umbral), `obtener_detalle(id)` |
| `Entidad` | `nombre` → `nombres: Map<idioma, texto>` + `getNombre()`; + `subtipos: String[]` |
| `Persona` | `nombrePropio`, `apellidos`; sin fechas ni nacionalidad |
| `Organizacion` | sin `fechaFundacion` ni `sede` |
| `ObraDeArte` | `dimensiones`; sin `fechaCreacion` ni `tecnica` |
| `TipoRelacion` | + `padres: String[]`, `getFamilia()`; nombre de `nombresTipos` o, si es un tipo nuevo, separando el *CamelCase* |
| `Relacion` | + `idIntermedio`, `roles`, `periodo`, `lugar`, `fecha`; `valor` = relevancia asignada |
| **Nuevas (modelo)** | `Periodo`, `Evento`, `Imagen`, `FuenteExterna`, `DetalleEntidad` |
| `FabricaEntidades` | crea la entidad desde etiquetas y propiedades en bruto, con la tabla `etiquetasEntidad` |
| `RelevanciaDesdeBD` (cliente) | estrategia por defecto otra vez: lee el valor asignado |
| `ClienteServicio` | + `obtenerTipos()`, + `obtenerDetalle(id)` |
| `PanelInformacion` | detalle al seleccionar (eventos, imágenes, fuentes); roles, periodo y lugar en las relaciones |
| `Leyenda` | relaciones agrupadas por familia |

## 7. Cosas raras del diseño para comentar con el tutor (no se cambian)

- Erratas: `Ubication` (*Location*), `Employement` (*Employment*), `OCURRED_AT` / `OCURRED_DURING` (*OCCURRED*), `coworking` en minúsculas; espacios al final en `Death `, `Friendship `, `Creation `, `Designer `. La aplicación usa los nombres tal cual estén en la BD real (con la regla genérica no hay que cambiar código si se corrigen; solo la tabla de pesos y de nombres).
- `Creation` tiene dos relaciones hacia `HeritageItem`: `PRODUCED` y `CREATE`. ¿Son lo mismo?
- En `Event` los nombres aparecen como *labels* en vez de como propiedades.
- `Person` no tiene nombre en varios idiomas; el `Organization` verde tiene `name` en vez de `name_es`.
- ¿Los subtipos (`IS_A`) son varias etiquetas en el mismo nodo (`:Event:Creation:Paint`) o nodos de una taxonomía? Cambia cómo se lee la jerarquía.
- ¿Hay un identificador estable o hay que usar `elementId`?
- **Permisos para guardar la relevancia** (§5) y edición de Neo4j (Community o Enterprise).
- ¿Validan los pesos y el criterio por tipo?
- ¿Se quieren ver los eventos, lugares o periodos como nodos del grafo?
- Tamaño de la BD (afecta a `/api/nombres`).

## 8. Qué hay que cambiar en la memoria

- **O1**: el texto actual («como mínimo, el tipo de relación») sigue siendo correcto.
- **RF-09**: «El sistema obtendrá la relevancia de cada relación de la base de datos y, si no la tiene, la calculará a partir de su tipo y la guardará».
- **RNF-11**: según la opción de §5.
- **RNF-16**: pesos, clasificación de etiquetas y límites en el fichero de configuración.
- Nuevo RNF (mantenibilidad): «Añadir un tipo de relación, de evento o de entidad a la BD no obligará a modificar el código».
- **RF-39**: se cumple con `/api/tipos`.
- **RNF-27**: las fuentes externas se muestran en el panel.
- **RNF-10 / RF-34**: los datos ya están en castellano, valenciano e inglés.
- `solucion_propuesta.tex` ya decía «si una relación no la tiene, el servidor la calcula»: completar el TODO con §4 y §5.
- Capítulo 4: modelo de datos con §1 y la regla de §3.
