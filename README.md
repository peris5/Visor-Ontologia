# Visor de patrimonio 3D · Incremento 3b: datos con la forma de Neo4j

Trabajo de Fin de Grado. Aplicación web para explorar en 3D una base de datos de conocimiento sobre patrimonio cultural (grupo IRTIC, Universitat de València).

El desarrollo se divide en cuatro incrementos:

1. Modelo y subgrafo (O1): datos simulados, cálculo de la relevancia y construcción del subgrafo. ✔
2. Visualización 3D (O2): servidor Python, Three.js y disposición con un grafo dirigido por fuerzas. ✔
3. Exploración (O3): buscador, información de nodos, navegación, historial y filtros. ✔
   - **3b** (este): adaptación al diseño de la base de datos real (Neo4j, proyecto REFRACTS): modelo genérico y relevancia asignada bajo demanda. ✔
4. Datos reales y validación (O4): conexión con la base de datos y pruebas de rendimiento y usabilidad.

El diseño de la base de datos está en `docs/diseno_bd_refracts.json` (export de arrows.app) y su análisis, en `ANALISIS_BD_NEO4J.md`.

## Arquitectura: el navegador calcula, el servidor da los datos (y asigna la relevancia)

```
┌──────────────────── NAVEGADOR (JavaScript + Three.js) ── CÁLCULO DEL SUBGRAFO ──────────────┐
│  Aplicacion ──crea y conecta──▶ ControladorExploracion ◀──avisan── EscenaGrafo (3D)          │
│                                   │    ◆ FiltroVisualizacion        └ SelectorInteraccion    │
│                                   │    ◆ HistorialNavegacion  ◀──── InterfazUsuario (2D)     │
│                  ┌────────────────┴───────┐                                                  │
│                  ▼                        ▼                                                  │
│              Buscador              GestorSubgrafos ──▶ RepositorioVecindario (en memoria)    │
│     (todos los nombres)                   │           ConstructorSubgrafo, RelevanciaDesdeBD,│
│                                           ▼           CalculadorCentralidad, PaletaColores   │
│                                    ClienteServicio                                           │
└───────────────────────────────────────────┼──────────────────────────────────────────────────┘
       HTTP + JSON: configuración, tipos y nombres (UNA vez) · un vecindario por entidad · un detalle al seleccionar
┌───────────────────────────────────────────▼──────── SERVIDOR (Python + FastAPI) ── DATOS ────┐
│  app.py (rutas) ─▶ ConversorJson, CacheRespuestas                                            │
│        ▼                                                                                     │
│  RepositorioDatos ◀── RepositorioSimulado (datos_ejemplo.json, con la forma de Neo4j)        │
│        │          ◀── (incremento 4: RepositorioBDConocimiento, Neo4j)                       │
│        ├─▶ ClasificadorEtiquetas · ProyectorRelaciones (regla genérica)                      │
│        └─▶ AsignadorRelevancia ─▶ RelevanciaPorTipo (estrategia) + AlmacenRelevancias        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **El servidor** da acceso a los datos (lo que tiene que estar allí: la conexión, las credenciales y las consultas) y, desde el 3b, **asigna y guarda la relevancia** de las relaciones que recorre. Es lo único del cálculo que va en el servidor, porque es lo único que hay que **guardar** en la base de datos.
- **El navegador** hace el resto: relevancia de los nodos (producto del camino), subgrafo «primero el mejor», poda a 150 nodos, centralidad, colores, búsqueda tolerante a errores, vista 3D e interfaz.

### Por qué el navegador calcula (incremento 3)

- El servidor apenas consume recursos y atiende a más usuarios a la vez (RNF-05).
- Cambiar el umbral muchas veces no le cuesta nada al servidor: si sube, el navegador recalcula con los datos que ya tiene.
- Las sugerencias del buscador salen al instante, porque se buscan en memoria (RNF-03).

### El vecindario y por qué contiene todo lo necesario

El servidor entrega **de una sola vez** el *vecindario* de la entidad: el recorrido **en anchura** desde ella por las relaciones cuya relevancia **supera el umbral**, en los dos sentidos (`RepositorioDatos.obtener_vecindario`). Con él, el navegador construye el subgrafo (`RepositorioVecindario` + `ConstructorSubgrafo`).

**Por qué es correcto.** La relevancia de un nodo es el producto de las relevancias de su camino, y todas están entre 0 y 1. Un producto de números entre 0 y 1 nunca es mayor que ninguno de sus factores. Si un nodo supera el umbral, **todas** las relaciones de su camino lo superan también, y ese camino está dentro del vecindario. Lo que sobra (por ejemplo, un nodo a 0,5 × 0,5 = 0,25 con umbral 0,3), lo descarta el navegador. Por lo mismo, si se pide **la misma entidad con un umbral igual o mayor**, `GestorSubgrafos` no pide nada al servidor.

El servidor corta el vecindario en `maxEntidadesVecindario` entidades (2000) y lo marca como `recortado` (el navegador lo avisa en la consola).

## Los datos con la forma de Neo4j (incremento 3b)

### Forma de los datos simulados

`servidor/datos/datos_ejemplo.json` es un grafo **inventado** con la misma estructura que el diseño de Neo4j:

```json
{
  "jerarquia": { "Painter": "Creator", "Creator": "Person", "Marriage": "Related", "Related": "Relationship", "...": "..." },
  "nodos":      [ { "id": "n1", "etiquetas": ["Person", "Creator", "Painter"], "propiedades": { "name": "Elena", "lastName": "Ferrando Peris" } } ],
  "relaciones": [ { "id": "r1", "tipo": "HAS_ROLE_IN", "desde": "n1", "hasta": "n227", "propiedades": { "role": "maestra" } } ]
}
```

- Las entidades **no** se relacionan directamente: lo hacen a través de nodos intermediarios (`Relationship`, `Event` y sus subtipos), con sus periodos (`Period`), lugares (`Ubication`), imágenes (`Image`) y fuentes (`ExternalSource`).
- Etiquetas, tipos de relación y propiedades son **exactamente** los del diseño, erratas incluidas (`Ubication`, `Employement`, `OCURRED_AT`, `coworking`). No se corrigen porque la aplicación tiene que funcionar con los nombres tal cual estén en la BD real.
- **Ninguna relación tiene `relevance`**, igual que la BD real.
- `jerarquia` copia los `IS_A` del diseño. Se supone que en la BD real los subtipos son varias etiquetas en el mismo nodo (`:Event:Creation:Paint`); está pendiente de confirmar.
- Dos elementos **no están en el diseño** y están marcados con `"_comentario"` como de prueba: el subtipo `Apprenticeship` (aprendizaje, hijo de `Professional`) y la relación directa `STUDENT_OF` entre personas. Sirven para comprobar que el código no depende de una lista fija.

Tiene 120 personas, 25 organizaciones, 60 obras y 15 lugares (ciudad → provincia → país con `IS_IN`), 1462 nodos y 2500 relaciones. Lo genera, con semilla fija, `servidor/datos/generar_datos_ejemplo.py`:

```
.venv\Scripts\python.exe -m servidor.datos.generar_datos_ejemplo
```

Escribe también `tests/vecindarioEjemplo.json`, el vecindario completo que usan las pruebas del navegador. La prueba `test_datos_ejemplo.py` comprueba que siempre genera lo mismo, que no hay ninguna `relevance` y que todo existe en el diseño salvo lo marcado como de prueba.

### Clasificación de las etiquetas y regla genérica

La clasificación está en `servidor/configuracion.json`, no en el código (`ClasificadorEtiquetas`):

- **Entidades** (`etiquetasEntidad`): `Person` → persona, `Organization` → organización, `HeritageItem` → obra.
- **Auxiliares** (`etiquetasAuxiliares`, y su papel en `papelesAuxiliares`): `Period` (periodo), `Ubication` (lugar), `Image` (imagen), `ExternalSource` (fuente).
- **Intermediarios**: todo lo demás, también cualquier etiqueta nueva.

`ProyectorRelaciones` deriva las relaciones entre entidades con una **regla genérica**, sin ningún nombre de etiqueta ni de relación en el código:

1. **Por intermediario:** si un intermediario está unido (por cualquier relación que no esté en `relacionesIgnoradas`) a dos o más entidades, hay una relación por cada **pareja**. Su tipo es la etiqueta **más específica** del intermediario. Así salen el matrimonio, la mentoría, el empleo, la creación de una obra, la fundación, la exposición o haber ido al mismo evento.
2. **Directa:** una relación entre dos entidades se toma tal cual (por ejemplo `STUDENT_OF`).
3. **Límites:** no se aplica a `tiposSinRelacion` (`Birth`, `Death`, `Live`: van al detalle) ni a intermediarios con más de `maxParticipantesIntermediario` (10) entidades, para que un evento grande no cree una maraña.
4. **Datos:** roles (`role`), periodo, lugar y fecha.

En `servidor/datos/proyector_relaciones.py` hay una consulta Cypher de referencia para el incremento 4 que hace lo mismo sin nombrar ninguna etiqueta.

### Cómo se añade un tipo nuevo

Normalmente, **nada**. Si la BD añade un subtipo de relación o de evento (como `Apprenticeship`), o una relación directa (como `STUDENT_OF`):

- sale solo en `/api/tipos`, en la leyenda y en el grafo;
- recibe el peso de su padre más cercano (o `pesoPorDefecto`);
- se nombra automáticamente a partir de su id (`STUDENT_OF` → «Student of»).

Como mucho, se añade en `servidor/configuracion.json` un **peso** (`pesosRelevancia`, subiendo `versionPesos`) y un **nombre** (`nombresTipos`). Un tipo nuevo de **entidad** sí necesita una línea en `etiquetasEntidad`.

### Relevancia asignada bajo demanda y guardada

Las relaciones no tienen relevancia en la BD. Mientras recorre el vecindario, el servidor (`AsignadorRelevancia`) mira cada intermediario (o relación directa) que encuentra:

- si ya tiene `relevance` (manual, o automática con la versión actual de los pesos), la **reutiliza**;
- si no, la **calcula** con la estrategia `RelevanciaPorTipo` (peso del tipo → del padre más cercano → por defecto) y la **guarda** con `relevance`, `relevanceSource` y `relevanceVersion`.

Así solo se calcula lo que se recorre, y una sola vez. Un valor `"manual"` nunca se sobrescribe. Los pesos de `configuracion.json` son una **propuesta pendiente de validar con el tutor**. Si se cambia uno, hay que subir `versionPesos`: las relevancias automáticas antiguas se recalculan al volver a recorrerlas.

El navegador lee el valor asignado con `RelevanciaDesdeBD`. La barra de abajo muestra cuántas relevancias asignó el servidor en el último vecindario y cuántas reutilizó, y el registro del servidor lo apunta en cada petición.

### El problema de los permisos (RNF-11)

RNF-11 dice que la aplicación accede a la BD **solo con permisos de lectura**, pero guardar la relevancia necesita escribir. Por eso el guardado va detrás de la interfaz `AlmacenRelevancias`:

1. **`AlmacenRelevanciasEnGrafo`** (la que hay ahora) escribe en el propio grafo. Con Neo4j sería un `SET … coalesce(…)` y haría falta permiso de escritura **solo** sobre esas tres propiedades (Neo4j Enterprise lo permite).
2. Si no se consigue ese permiso, en el incremento 4 se hará otra implementación con un **almacén propio del servidor** (un fichero o una pequeña base de datos), sin cambiar nada más.

Está pendiente de decidir con el tutor (ver `ANALISIS_BD_NEO4J.md` §5).

## Requisitos

- **Node.js** LTS (para Vite y Three.js).
- **Python 3.12** (para el servidor).

## Instalación (una vez)

```
npm install
py -m venv .venv
.venv\Scripts\activate
pip install -r servidor/requirements.txt
```

## Desarrollo: dos servidores

Hacen falta dos terminales:

- **Terminal 1, servidor Python** (puerto 8000):
  ```
  .venv\Scripts\activate
  python -m uvicorn servidor.app:app --reload --port 8000
  ```
  `http://localhost:8000/api/salud` debe responder `{"estado": "ok"}`. La documentación de la API se genera sola en `http://localhost:8000/docs`. Si `servidor/configuracion.json` no está completa, el servidor no arranca y dice qué falta.
- **Terminal 2, la página** (puerto 5173):
  ```
  npm run dev
  ```
  Abre `http://localhost:5173/`.

Para parar cada uno: `Ctrl + C` en su terminal. En Windows, la recarga automática (`--reload`) a veces se queda a medias y el servidor sigue con el código anterior. Si algo no cambia, para el servidor y arráncalo de nuevo. Al arrancarlo, además, las relevancias asignadas se borran, porque solo están en memoria.

## Pruebas

- **Python**: `python -m pytest`, con el entorno virtual activado. Están en `servidor/tests/` y cubren:
  - clasificador, proyector, relevancia por tipo, asignador y almacén;
  - repositorio, vecindario, datos de ejemplo, configuración, caché y API.
- **Navegador**: con `npm run dev` en marcha, abre `http://localhost:5173/pruebas.html`.
  - Cubren el modelo, la fábrica de entidades, los tipos de relación, el cálculo del subgrafo, el buscador, el gestor, el controlador, los filtros, el historial, la vista 3D, la leyenda y los paneles.
  - Arriba aparece «X de Y pruebas correctas», y debajo cada prueba en verde o en rojo con el motivo.
  - No necesitan el servidor: usan **dobles de prueba** y `tests/vecindarioEjemplo.json`.

`EscenaGrafo` y `SelectorInteraccion` necesitan WebGL y se comprueban a mano con la lista del final.

## Publicar

```
npm run build
python -m uvicorn servidor.app:app --port 8000
```

`npm run build` deja la página en `dist/`, y el servidor Python la sirve en `/` además de la API: en el servidor real basta con Python. La aplicación queda en `http://localhost:8000/`.

## API

| Petición | Respuesta |
|---|---|
| `GET /api/salud` | `{"estado": "ok"}` |
| `GET /api/configuracion` | `umbralPorDefecto`, `maxNodos`, `entidadInicial`, `idioma`, `nombresTipos`, `etiquetasEntidad` (solo lo que necesita el navegador) |
| `GET /api/tipos` | **Nueva.** Los tipos de relación de los datos con sus padres: `[{"id": "Marriage", "padres": ["Related", "Relationship"]}]` (RF-39) |
| `GET /api/nombres` | Todas las entidades con sus etiquetas y sus propiedades de nombre, en bruto (el índice del buscador) |
| `GET /api/vecindario/{id}?umbral=0.3` | `idCentral`, `umbral`, `recortado`, `entidades` (en bruto), `relaciones` (derivadas, con `valor` = relevancia asignada, `roles`, `periodo`, `lugar`, `fecha`), `relevanciasAsignadas` y `relevanciasReutilizadas` |
| `GET /api/detalle/{id}` | **Nueva.** En bruto: `eventos` (también nacimiento, defunción y residencia, con rol, periodo, lugar, fecha y participantes), `imagenes` (por `order`), `fuentes` (con `dateUpdated` y `externalId`) y `ubicacion` (con la cadena de `IS_IN`) |

- `umbral` entre 0 y 1; si no, **422**. Si no se indica, se usa el de la configuración. Se redondea hacia abajo a 2 decimales.
- Entidad inexistente (o un nodo que no es una entidad): **404** con `{"detail": "No existe la entidad X"}`. Cualquier otro error: **500** con un mensaje genérico.
- El vecindario lleva `Cache-Control: no-store`, para que las estadísticas de cada petición sean las suyas. Se reutiliza de la caché del servidor; en ese caso dice «0 asignadas». El resto de rutas sí se guardan en el navegador dos minutos.

## Rendimiento

En el servidor: índice de relaciones por nodo, caché de respuestas (`CacheRespuestas`), umbral redondeado y, desde el 3b, cada relevancia se calcula una sola vez. Con los datos de ejemplo:

- el vecindario de n1 con umbral 0,3 tarda unos 40 ms en recorrerse;
- ocupa unos 186 KB;
- el subgrafo de 150 nodos se calcula en el navegador en unos 15 ms la primera vez y en pocos milisegundos al cambiar el umbral.

## Configuración

- **`servidor/configuracion.json`** (la de verdad):
  - ajustes generales: `origenDatos`, `umbralPorDefecto`, `maxNodos`, `maxEntidadesVecindario`, `entidadInicial`, `idioma`;
  - clasificación de etiquetas: `etiquetasEntidad`, `etiquetasAuxiliares`, `papelesAuxiliares`, `tiposSinRelacion`, `relacionesIgnoradas`, `maxParticipantesIntermediario`;
  - relevancia y nombres: `pesosRelevancia`, `pesoPorDefecto`, `versionPesos` y `nombresTipos`.

  Las credenciales de la base de datos real **no** irán aquí, sino en variables de entorno (archivo `.env`, que Git ignora).
- **`public/config.json`**: solo `urlServicio` (`"/api"`).

## Cómo añadir otra fuente de datos

Crear en `servidor/datos/` una clase que herede de `RepositorioDatos` (por ejemplo `RepositorioBDConocimiento` para Neo4j, en el incremento 4) e implemente:

- `obtener_tipos`, `obtener_nombres`, `obtener_vecindario` y `obtener_detalle`;
- `cerrar`, si abre conexiones;
- su propio `AlmacenRelevancias`.

Después, en `crear_repositorio` de `servidor/app.py`, crearla cuando `origenDatos` tenga su nombre.

## Carpetas y clases

### Servidor (`servidor/`)

| Ruta | Qué es |
|---|---|
| `app.py` | Rutas de la API, configuración comprobada al arrancar, repositorio y página publicada. |
| `api/conversor_json.py` | **ConversorJson**: forma del JSON (configuración y vecindario). |
| `api/cache_respuestas.py` | **CacheRespuestas**: guarda las respuestas ya preparadas. |
| `logica/configuracion.py` | **Configuracion**: lee y comprueba `configuracion.json`. |
| `logica/clasificador_etiquetas.py` | **ClasificadorEtiquetas** (nueva): entidad, auxiliar o intermediario; etiqueta más específica; padres. |
| `logica/estrategia_relevancia.py` | **«interface» EstrategiaRelevancia**: vuelve al servidor. |
| `logica/relevancia_por_tipo.py` | **RelevanciaPorTipo** (nueva): peso del tipo, del padre más cercano o por defecto. |
| `logica/asignador_relevancia.py` | **AsignadorRelevancia** (nueva): reutiliza o calcula y guarda la relevancia de lo que se recorre. |
| `datos/repositorio_datos.py` | **«interface» RepositorioDatos** (`obtener_tipos`, `obtener_nombres`, `obtener_vecindario`, `obtener_detalle`) y la excepción `EntidadNoEncontrada`. |
| `datos/repositorio_simulado.py` | **RepositorioSimulado**: el grafo de ejemplo en memoria. |
| `datos/proyector_relaciones.py` | **ProyectorRelaciones** (nueva): la regla genérica. |
| `datos/almacen_relevancias.py` | **«interface» AlmacenRelevancias** (nueva). |
| `datos/almacen_relevancias_en_grafo.py` | **AlmacenRelevanciasEnGrafo** (nueva): guarda la relevancia en el grafo. |
| `datos/generar_datos_ejemplo.py` | **GeneradorDatosEjemplo**: genera los datos de ejemplo (no la usa la aplicación). |
| `modelo/vecindario.py` | **Vecindario**: entidades y relaciones en bruto, si está recortado y las estadísticas de asignación. |
| `modelo/` (resto) y `datos/fabrica_entidades.py` | Modelo de los incrementos 1 y 2. Desde el 3b ya no lo usa el servidor (ver el resumen del incremento). |

### Navegador (`src/`)

| Ruta | Qué es |
|---|---|
| `aplicacion/Aplicacion.js` | Crea y conecta todo; prepara el **contexto** (idioma, nombres de tipos, etiquetas de entidad y tipos) y el índice del buscador; barra de rendimiento. |
| `modelo/Entidad.js`, `Persona.js`, `Organizacion.js`, `ObraDeArte.js` | Entidades creadas desde propiedades en bruto: nombres en tres idiomas (persona: nombre y apellidos), subtipos y atributos desconocidos. |
| `modelo/TipoRelacion.js` | Con padres, familia y nombre (traducido o automático). |
| `modelo/Relacion.js` | Con relevancia asignada, intermediario, roles, periodo, lugar y fecha. |
| `modelo/Periodo.js`, `Evento.js`, `Imagen.js`, `FuenteExterna.js`, `DetalleEntidad.js` | **Nuevas**: el detalle de una entidad. |
| `modelo/NodoRelevante.js`, `Subgrafo.js`, `TipoEntidad.js` | Sin cambios. |
| `datos/FabricaEntidades.js` | `crearDesdeNeo4j`: la clase sale de las etiquetas con la tabla `etiquetasEntidad`. |
| `datos/RepositorioVecindario.js` | El vecindario en memoria; tipos con nombre, padres, familia y color estable. |
| `datos/ClienteServicio.js` | Configuración, tipos, nombres, vecindarios y detalle (`convertirDetalle`). |
| `logica/` | `RelevanciaDesdeBD` (lee el valor asignado), `ConstructorSubgrafo`, `CalculadorCentralidad`, `PaletaColores`, `GestorSubgrafos` (y el detalle), `Buscador` (todos los nombres), `ControladorExploracion` (pide el detalle sin bloquear), `FiltroVisualizacion`, `HistorialNavegacion`, `EstadoCarga`. |
| `vista3d/` | La vista 3D; la etiqueta de una relación incluye los roles. |
| `interfaz/` | `PanelInformacion` (subtipos, detalle, imágenes, fuentes, roles), `Leyenda` (agrupada por familias) y el resto de componentes del incremento 3. |

## Uso

- **Buscar**: escribe en el buscador (basta con 2 letras; vale cualquiera de los nombres: castellano, valenciano, inglés o apellidos; se toleran erratas). Flechas, Intro y Escape.
- **Ver información**: clic en un nodo (su información y, al momento, su detalle) o en una línea (tipo, roles, periodo, lugar). Pasando el puntero se ve su nombre.
- **Navegar**: doble clic en un nodo o «Explorar su red». «← Volver» (o `Alt + ←`) regresa.
- **Filtrar**: pulsa un tipo en la leyenda para ocultarlo (sale apagado y tachado) o volver a mostrarlo; están agrupados por familia. «Todas» y «Ninguna» cambian todas las relaciones a la vez.
- **Cámara**: arrastra para girar, rueda para acercar, «Vista inicial» (o `Inicio`).

## Lista de comprobación del incremento 3b (a mano)

Arranca el servidor Python **de nuevo** (para empezar sin ninguna relevancia asignada), con `npm run dev` en marcha, y abre `http://localhost:5173/`:

- [ ] La leyenda muestra tipos como «Matrimonio», «Mentoría» y «Pintura», agrupados por familia («Parentesco», «Relación profesional», «Creación»…). También salen «Apprenticeship» y «Student of», que no estaban en el diseño.
- [ ] La primera vez que se abre la entidad inicial, la barra muestra «Relevancias asignadas: 320 · reutilizadas: 0». Al volver a abrirla, todas reutilizadas («asignadas: 0»). El registro del servidor lo apunta igual.
  - Como los datos de ejemplo están todos conectados, en la primera visita se asignan las de todo el grafo, y después cualquier otra entidad las reutiliza.
- [ ] Al poner el umbral en 0,6 desaparecen de la leyenda las relaciones de empleo y de co-participación en eventos (Trabajo, Boda, Exposición, Evento), **sin petición nueva** (F12 → *Red*).
- [ ] El panel de una persona (por ejemplo Elena Ferrando Peris) muestra lo siguiente: «Persona · Pintor/a · Creador/a», nacimiento y defunción (fecha y lugar), eventos y relaciones, imágenes y fuentes («Fuente: … (Libro), actualizada el …»).
  - Las imágenes son direcciones inventadas: se ve su texto alternativo.
- [ ] El panel de una relación muestra roles y periodo: «Elena Ferrando Peris (maestra) → … (discípulo)», 1893–1903, el lugar y la relevancia «asignada según el tipo de relación».
- [ ] Al pasar el puntero por una relación, la etiqueta incluye los roles.
- [ ] Buscar «Museu» (valenciano) o «Workshop» (inglés) encuentra las organizaciones, y buscar por un apellido («Ferrando») encuentra a la persona.
- [ ] Ningún evento grande crea una maraña: los dos congresos (14 asistentes) y la exposición de 12 obras no crean relaciones.

Y del incremento 3 (sigue igual):

- [ ] Al **subir** el umbral no hay petición nueva; al **bajarlo**, sí.
- [ ] Erratas («sanchiz», «belloc»), sin tildes y en mayúsculas («HORTOLA»). Búsqueda sin resultados («zzqx»). Buscador solo con teclado.
- [ ] Clic, arrastre (no selecciona), doble clic, «Volver», filtros (la central nunca desaparece), «Vista inicial» y atajos.
- [ ] Con el servidor parado, aviso de error sin romper la página.
- [ ] Ventana estrecha (menos de 700 px) usable. Los fps se mantienen por encima de 30.
- [ ] Entre dos entidades con varias relaciones se ven curvas separadas (Elena Ferrando Peris y su primer discípulo: «Matrimonio» y «Colaboración»).
