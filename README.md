# Visor de patrimonio 3D · Incremento 3: exploración interactiva

Trabajo de Fin de Grado. Aplicación web para explorar en 3D una base de datos de conocimiento sobre patrimonio cultural (grupo IRTIC, Universitat de València).

El desarrollo se divide en cuatro incrementos:

1. Modelo y subgrafo (O1): datos simulados, cálculo de la relevancia y construcción del subgrafo. ✔
2. Visualización 3D (O2): servidor Python, Three.js y disposición con un grafo dirigido por fuerzas. ✔
3. Exploración (O3): buscador, información de nodos, navegación, historial y filtros. ✔ (este)
4. Datos reales y validación (O4): conexión con la base de datos y pruebas de rendimiento y usabilidad.

## Arquitectura: el navegador calcula, el servidor solo da los datos

```
┌──────────────────── NAVEGADOR (JavaScript + Three.js) ── TODO EL CÁLCULO ────────────────────┐
│                                                                                              │
│  Aplicacion ──crea y conecta──▶ ControladorExploracion ◀──avisan── EscenaGrafo (3D)          │
│                                   │    ◆ FiltroVisualizacion        └ SelectorInteraccion    │
│                                   │    ◆ HistorialNavegacion  ◀──── InterfazUsuario (2D)     │
│                                   │                                  buscador, panel,        │
│                  ┌────────────────┴───────┐                          umbral, leyenda...      │
│                  ▼                        ▼                                                  │
│              Buscador              GestorSubgrafos ──▶ RepositorioVecindario (en memoria)    │
│        (índice de nombres)                │           ConstructorSubgrafo, RelevanciaDesdeBD,│
│                                           │           CalculadorCentralidad, PaletaColores   │
│                                           ▼                                                  │
│                                    ClienteServicio                                           │
└───────────────────────────────────────────┼──────────────────────────────────────────────────┘
                 HTTP + JSON:  configuración y nombres (UNA vez al abrir la página)
                               un vecindario por entidad (ninguno si el umbral sube)
┌───────────────────────────────────────────▼─────── SERVIDOR (Python + FastAPI) ── SOLO DATOS ┐
│  app.py (rutas) ─▶ ConversorJson, CacheRespuestas                                            │
│        ▼                                                                                     │
│  RepositorioDatos ◀── RepositorioSimulado (datos_ejemplo.json)                               │
│                   ◀── (incremento 4: base de datos real, con sus credenciales)               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Por qué se ha cambiado el reparto

En el incremento 2 el servidor construía el subgrafo entero. Desde este incremento **el servidor solo da acceso a los datos**: lo que obligatoriamente tiene que estar allí (la conexión con la base de datos, sus credenciales y las consultas). **Todo el cálculo lo hace el navegador**: relevancias, construcción del subgrafo «primero el mejor», poda a 150 nodos, centralidad, colores de los tipos de relación y búsqueda tolerante a errores.

- El servidor apenas consume recursos y atiende a más usuarios a la vez (RNF-05).
- Cambiar el umbral muchas veces no le cuesta nada al servidor: si sube, el navegador recalcula con los datos que ya tiene.
- Las sugerencias del buscador salen al instante, porque se buscan en memoria (RNF-03).
- El código de cálculo es el del incremento 1, que vuelve al navegador casi sin cambios.

### El vecindario y por qué contiene todo lo necesario

Construir el subgrafo en el navegador pidiendo al servidor las relaciones de cada nodo que se expande obligaría a hacer hasta 150 peticiones. Para evitarlo, el servidor entrega **de una sola vez** el *vecindario* de la entidad: el recorrido **en anchura** desde ella siguiendo **solo las relaciones cuyo valor supera el umbral**, en los dos sentidos (`RepositorioDatos.obtener_vecindario`). Con él, el navegador construye el subgrafo igual que en el incremento 1 (`RepositorioVecindario` + `ConstructorSubgrafo`).

**Por qué es correcto.** La relevancia de un nodo es el producto de las relevancias de su camino, y todos los valores están entre 0 y 1. Un producto de números entre 0 y 1 nunca es mayor que ninguno de sus factores. Por tanto, si un nodo supera el umbral, **todas** las relaciones de su camino lo superan también, y ese camino está dentro del vecindario. El vecindario contiene seguro todo lo que el navegador necesita; el navegador descarta lo que sobra (por ejemplo, un nodo a 0,5 × 0,5 = 0,25 con umbral 0,3).

Por el mismo motivo, si se pide **la misma entidad con un umbral igual o mayor**, el vecindario guardado sigue sirviendo y `GestorSubgrafos` no pide nada al servidor.

Con la base de datos real (incremento 4), el vecindario será **una sola consulta** con caminos de longitud variable filtrados por el valor de la relación. Para que nadie pida la base de datos entera, el servidor lo corta en `maxEntidadesVecindario` entidades (2000) y lo marca como `recortado`. El navegador lo avisa en la consola.

### Quién llama a quién en el navegador

- `main.js` → `Aplicacion.main()`: lee `public/config.json`, pide **a la vez** `/api/configuracion` y `/api/nombres` y crea todas las piezas en `crearDependencias` (inyección de dependencias).
- `Aplicacion` → `ControladorExploracion` (patrón modelo–vista–controlador) ↔ `EscenaGrafo` / `InterfazUsuario`. Las vistas avisan al controlador de lo que hace el usuario; el controlador decide y les pide que muestren cosas.
- `InterfazUsuario` es una **fachada**: el controlador solo habla con ella, y ella reparte el trabajo entre `PanelBusqueda`, `PanelInformacion`, `ControlUmbral`, `Leyenda`, `IndicadorEstado` y `BarraNavegacion`.
- `ControladorExploracion` → `GestorSubgrafos` → `ClienteServicio` → API.
- `ControladorExploracion` → `Buscador` (sin red: busca en el índice de nombres).

### Por qué Vite

Con módulos (`import`/`export`) cada clase declara lo que necesita y no hacen falta variables globales ni un `<script>` por clase en un orden concreto. Vite sirve los módulos durante el desarrollo, instala Three.js con npm (versión fija) y, al publicar, junta todo en pocos archivos. Además, su proxy reenvía `/api` al servidor Python, así la página y la API parecen estar en el mismo sitio y el navegador no da errores de CORS.

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
  `http://localhost:8000/api/salud` debe responder `{"estado": "ok"}`. La documentación de la API se genera sola en `http://localhost:8000/docs`.
- **Terminal 2, la página** (puerto 5173):
  ```
  npm run dev
  ```
  Abre `http://localhost:5173/`.

Para parar cada uno: `Ctrl + C` en su terminal.

## Pruebas

- **Python** (modelo, repositorio, vecindario, configuración, caché y API): `python -m pytest` (con el entorno virtual activado). Están en `servidor/tests/`.
- **Navegador** (todo el cálculo del subgrafo, buscador, gestor, controlador, filtros, historial, simulación, disposición, nodos, enlaces, leyenda y paneles): con `npm run dev` en marcha, abre `http://localhost:5173/pruebas.html`. Arriba aparece «X de Y pruebas correctas» y debajo cada prueba en verde o en rojo con el motivo. No necesitan el servidor Python: usan **dobles de prueba** (objetos falsos con los mismos métodos) del servidor, de la escena y de la interfaz.

La prueba «Constructor: con los datos de ejemplo da EXACTAMENTE el subgrafo del incremento 2» compara nodo a nodo (relevancia, nivel y centralidad) el subgrafo que calcula el navegador con el que calculaba el servidor Python del incremento 2 (`tests/subgrafoIncremento2.json`).

`EscenaGrafo` y `SelectorInteraccion` necesitan WebGL y se comprueban a mano con la lista del final.

## Publicar

```
npm run build
python -m uvicorn servidor.app:app --port 8000
```

`npm run build` deja la página en `dist/`. Si existe esa carpeta, el servidor Python la sirve en `/` además de la API, así que en el servidor real basta con un solo programa: hace falta Python, pero no Node. La aplicación queda en `http://localhost:8000/`.

En un servidor con varios núcleos se pueden arrancar varios procesos para atender a más usuarios a la vez (cada uno con su propia caché): `python -m uvicorn servidor.app:app --port 8000 --workers 4`. `--workers` no se puede usar junto con `--reload`.

## Rendimiento

En el **servidor** (RNF-01, RNF-05):

1. **Ya no calcula subgrafos**: solo recorre el vecindario y lo envía.
2. **Índice de relaciones** (`RepositorioSimulado`): las relaciones de cada entidad se agrupan al arrancar, en lugar de recorrer las 1036 cada vez.
3. **Caché de respuestas** (`CacheRespuestas`, antes `CacheSubgrafos`): cada vecindario y la lista de nombres se preparan y se convierten a JSON una sola vez. Si llegan varias peticiones iguales mientras se prepara, todas esperan al mismo cálculo. Como mucho 200 respuestas, durante 10 minutos.
4. **Umbral redondeado hacia abajo a 2 decimales**, para que 0,3 y 0,3000001 sean la misma petición. Tiene que ser hacia abajo: con un umbral menor el vecindario es igual o más grande, así que sigue sirviendo.
5. **Caché del navegador**: las respuestas llevan `Cache-Control: max-age=120`. Durante el desarrollo, si regeneras los datos de ejemplo, reinicia el servidor y recarga con `Ctrl + F5`.

Prueba de carga en un portátil de 4 núcleos (el programa que lanza las peticiones corre en el mismo equipo), 2000 peticiones con 50 a la vez:

| | Peticiones por segundo | Espera mediana |
|---|---|---|
| Incremento 2, antes de optimizar (`/api/subgrafo`) | 16–25 | 1,9–3,0 s |
| Incremento 2, optimizado (`/api/subgrafo`) | 150–200 | 0,17 s |
| Incremento 3 (`/api/vecindario`, respuestas de unos 150 KB) | unas 220 | 0,13 s |

En el **navegador**, la barra de abajo a la derecha muestra los nodos, las relaciones, los fps, «Estabilizado en X,X s», «Subgrafo calculado en X ms» (sin contar la red) y «Datos recibidos: X KB» (lo que ocupaba el vecindario). Con `p01` y umbral 0,3 se reciben unos 158 KB (el índice de nombres, unos 27 KB, solo al abrir la página) y el subgrafo de 150 nodos se calcula en unos 20 ms la primera vez y en pocos milisegundos al cambiar el umbral.

## Datos de ejemplo

`servidor/datos/datos_ejemplo.json` tiene 378 entidades (131 personas, 22 organizaciones y 225 obras) y 1036 relaciones de 14 tipos, todas inventadas. Las 16 entidades y 27 relaciones del incremento 1 siguen al principio del archivo, con los mismos ids, porque las pruebas dependen de ellas. Las pruebas del navegador usan este mismo archivo (Vite permite importar un JSON).

El resto lo genera `servidor/herramientas/generador_datos_ejemplo.py`, una herramienta de desarrollo que no usa la aplicación:

```
.venv\Scripts\python.exe -m servidor.herramientas.generador_datos_ejemplo
```

Usa una semilla fija, así que siempre genera exactamente los mismos datos (la prueba `test_generador_datos_ejemplo.py` lo comprueba). Crea 12 grupos (talleres, academias, círculos y sociedades), cada uno con su maestro, entre 6 y 10 miembros y sus obras, con relaciones fuertes dentro del grupo, para que se vean cúmulos (RF-40), y a veces dos relaciones en el mismo par (RF-38). Añade además 6 museos, 10 mecenas, 8 restauradoras, retratos y parejas, y relaciones débiles entre grupos para que todo quede conectado.

Tamaño del subgrafo de `p01` según el umbral:

| Umbral | Nodos |
|---|---|
| 0,3 (por defecto) | 150, el máximo: sirve para la prueba de rendimiento |
| 0,5 | 86 |
| 0,7 | 20 |

Como los datos de ejemplo están muy conectados, el vecindario de `p01` con umbral 0,3 contiene las 378 entidades.

## Configuración

- `servidor/configuracion.json` (la de verdad): `origenDatos`, `umbralPorDefecto`, `maxNodos`, `maxEntidadesVecindario` y `entidadInicial`. Si falta o tiene valores no válidos, se usan los valores por defecto (RNF-16). El navegador recibe `umbralPorDefecto`, `maxNodos` y `entidadInicial` en `/api/configuracion`, así que siguen definidos en un solo sitio. Las credenciales de la base de datos real **no** irán aquí, sino en variables de entorno (archivo `.env`, que Git ignora).
- `public/config.json`: solo `urlServicio` (`"/api"`), para que la página sepa dónde está la API.

## Cómo añadir otra fuente de datos

Crear en `servidor/datos/` una clase nueva que herede de `RepositorioDatos` e implemente sus métodos asíncronos (`buscar_entidades`, `obtener_entidad`, `obtener_relaciones`, `obtener_tipos_relacion` y `obtener_vecindario`) y, si abre conexiones, `cerrar`. Después, en `crear_repositorio` de `servidor/app.py`, crearla cuando `origenDatos` tenga su nombre. El resto del servidor y todo el navegador siguen igual (RNF-17).

## API

| Petición | Respuesta |
|---|---|
| `GET /api/salud` | `{"estado": "ok"}` |
| `GET /api/configuracion` | `{"umbralPorDefecto": 0.3, "maxNodos": 150, "entidadInicial": "p01"}` |
| `GET /api/nombres` | todas las entidades, solo con `id`, `nombre` y `tipo` (el índice del buscador) |
| `GET /api/vecindario/{id}?umbral=0.3` | `{"idCentral", "umbral", "recortado", "entidades", "relaciones", "tiposRelacion"}` |

- En `vecindario`, cada entidad va completa (`id`, `nombre`, `tipo`, `descripcion`, `atributos`) y cada relación en bruto: `{"id", "origen", "destino", "tipo": "autor_de", "valor"}`, sin relevancia ni color. `tiposRelacion` lleva los ids de **todos** los tipos de relación de los datos, para que el navegador dé a cada tipo el mismo color en todos los vecindarios.
- `umbral` entre 0 y 1; si no, **422**. Si no se indica, se usa el de la configuración. Se redondea hacia abajo a 2 decimales y la respuesta dice cuál se ha usado.
- El máximo de entidades del vecindario lo pone el servidor (`maxEntidadesVecindario`) y no se puede cambiar desde la petición. El id tiene como mucho 100 caracteres (si no, **422**).
- Entidad inexistente: **404** con `{"detail": "No existe la entidad P99"}`. Cualquier otro error: **500** con un mensaje genérico (el detalle queda en el registro del servidor).
- `/api/subgrafo` y `/api/entidades` (incremento 2) ya no existen.

## Carpetas y clases

### Servidor (`servidor/`): solo acceso a datos

| Ruta | Qué es |
|---|---|
| `app.py` | Rutas de la API, creación del repositorio al arrancar y página publicada. |
| `api/conversor_json.py` | **ConversorJson**: convierte entidades, relaciones y vecindarios en diccionarios, en bruto. |
| `api/cache_respuestas.py` | **CacheRespuestas** (antes `CacheSubgrafos`): guarda las respuestas ya preparadas para no repetir el trabajo (RNF-01). |
| `modelo/vecindario.py` | **Vecindario** (nueva): entidades y relaciones alrededor de una entidad, y si se ha recortado. |
| `modelo/` | El resto del modelo: `TipoEntidad`, `Entidad`, `Persona`, `Organizacion`, `ObraDeArte`, `TipoRelacion` (ahora solo con `id`), `Relacion`, `NodoRelevante` y `Subgrafo`. |
| `datos/` | `RepositorioDatos` (interfaz, con `obtener_vecindario`), `RepositorioSimulado`, `FabricaEntidades` y `datos_ejemplo.json`. |
| `logica/configuracion.py` | **Configuracion**: lo único que queda en `logica/`. |
| `herramientas/generador_datos_ejemplo.py` | **GeneradorDatosEjemplo**: genera los datos de ejemplo (no la usa la aplicación). |
| `tests/` | Pruebas de pytest. |

### Navegador (`src/`): todo el cálculo, la vista 3D y la interfaz

| Ruta | Qué es |
|---|---|
| `main.js` | Solo `Aplicacion.main()`. |
| `aplicacion/Aplicacion.js` | **Nueva.** Crea y conecta todas las piezas, carga la entidad inicial y lleva la barra de rendimiento. |
| `modelo/` | El modelo del incremento 1 (vuelven `getValor`, `setRelevancia`, `getOtroExtremo`, `eliminarNodo` y `nombreDesdeId`). |
| `datos/RepositorioDatos.js` | **Vuelve** del incremento 1: interfaz de acceso a los datos. |
| `datos/RepositorioVecindario.js` | **Nueva.** El vecindario recibido, en memoria; da nombre y color a los tipos de relación. |
| `datos/ClienteServicio.js` | Solo pide datos: configuración, nombres y vecindarios. |
| `datos/FabricaEntidades.js` | Crea la subclase de `Entidad` según el tipo. |
| `logica/EstrategiaRelevancia.js`, `RelevanciaDesdeBD.js` | **Vuelven** del incremento 1: relevancia de relaciones (valor acotado) y de nodos (producto). |
| `logica/CalculadorCentralidad.js` | **Vuelve**: grado ponderado normalizado (RF-37). |
| `logica/PaletaColores.js` | **Vuelve**: color automático por tipo de relación (RF-20, RF-39). |
| `logica/ConstructorSubgrafo.js` | **Vuelve**: búsqueda «primero el mejor», umbral, poda y centralidad (RF-08 a RF-12). |
| `logica/GestorSubgrafos.js` | **Nueva.** Pide el vecindario solo cuando hace falta y construye el subgrafo. |
| `logica/Buscador.js` | **Nueva.** Búsqueda sin mayúsculas ni tildes y tolerante a erratas (distancia de Levenshtein). |
| `logica/EstadoCarga.js` | **Nueva.** Enumeración: `INACTIVO`, `CARGANDO`, `LISTO`, `ERROR`. |
| `logica/HistorialNavegacion.js` | **Nueva.** Pila de entidades visitadas para «Volver» (RF-31). |
| `logica/FiltroVisualizacion.js` | **Nueva.** Qué tipos de nodo y de relación se ven (RF-32, RF-33). |
| `logica/ControladorExploracion.js` | **Nueva.** El controlador: coordina búsqueda, carga, navegación, umbral, filtros y selección. |
| `vista3d/SelectorInteraccion.js` | **Nueva.** Clic, doble clic, toques y etiqueta flotante con un rayo (Raycaster) (RF-28 a RF-30, RF-41). |
| `vista3d/EscenaGrafo.js` | Escena 3D; ahora también aplica filtros y resalta relaciones. |
| `vista3d/SimulacionFuerzas.js`, `CalculadorDisposicion.js`, `NodoVisual.js` (`NodoPersona`, `NodoOrganizacion`, `NodoObra`), `FabricaNodosVisuales.js`, `EnlaceVisual.js` | La vista 3D del incremento 2, sin cambios de comportamiento. |
| `interfaz/InterfazUsuario.js` | **Nueva.** Fachada de la interfaz 2D. |
| `interfaz/PanelBusqueda.js` | **Nueva.** Buscador con sugerencias, teclado y patrón «combobox» (RF-01 a RF-07). |
| `interfaz/PanelInformacion.js` | **Nueva.** Información de la entidad o relación seleccionada (RF-28 a RF-30). |
| `interfaz/ControlUmbral.js` | **Nueva.** Deslizador del umbral (RF-13). |
| `interfaz/IndicadorEstado.js` | **Nueva.** «Cargando…» y avisos de error (RF-14, RF-15). |
| `interfaz/BarraNavegacion.js` | **Nueva.** «← Volver», «Vista inicial» y sus atajos (RF-27, RF-31). |
| `interfaz/Leyenda.js` | Ahora **interactiva**: casillas para filtrar, «Todas» y «Ninguna». |
| `interfaz/ComponenteUI.js` | Clase abstracta de los componentes 2D. |
| `estilos.css` | Estilos de las dos páginas. |

### Pruebas del navegador (`tests/`)

`miniPruebas.js` (mini sistema de pruebas), `ejecutarPruebas.js` (importa y ejecuta todas), `utilidadesPruebas.js` (datos de ejemplo y un vecindario calculado como en el servidor), `subgrafoIncremento2.json` (el subgrafo de referencia del incremento 2) y un archivo `pruebas*.js` por tema.

## Uso

- **Buscar**: escribe en el buscador (basta con 2 letras; da igual escribir con o sin tildes y se toleran erratas). Con las flechas te mueves por las sugerencias, con Intro eliges y con Escape cierras. El desplegable de al lado filtra por tipo.
- **Ver información**: haz clic en un nodo o en una línea. Pasando el puntero se ve su nombre.
- **Navegar**: doble clic en un nodo (o dos toques en una pantalla táctil), o «Explorar su red» en el panel. «← Volver» (o `Alt + ←`) regresa a la entidad anterior.
- **Filtrar**: con las casillas de la leyenda. La entidad central nunca desaparece. Los filtros se mantienen al cambiar de entidad o de umbral (pendiente de confirmar con el tutor).
- **Cámara**: arrastra para girar y usa la rueda para acercar. «Vista inicial» (o la tecla `Inicio`) recoloca la cámara.

## Lista de comprobación del incremento 3 (a mano)

Con los dos servidores en marcha y `http://localhost:5173/` abierto:

- [ ] Para la misma entidad y umbral, el grafo es igual que en el incremento 2: mismos nodos y relaciones (150 y 350 para Elena Montsalvat con 0,30). Los colores de los tipos de relación cambian, porque ahora se reparten por orden alfabético.
- [ ] Al **subir** el umbral, el grafo se recalcula sin ninguna petición nueva (pestaña *Red* de las herramientas del navegador, F12, filtrando por `vecindario`). Al **bajarlo**, sí hay una petición.
- [ ] Una errata encuentra la entidad (por ejemplo «sanchiz» o «belloc»). También sin tildes y en mayúsculas («HORTOLA»). Las sugerencias salen al instante.
- [ ] El filtro de tipo del buscador funciona. Una búsqueda sin resultados («zzqx») lo indica. El buscador se usa solo con el teclado (Tab, flechas, Intro y Escape).
- [ ] Al elegir una sugerencia se ve «Cargando…» y se carga su grafo.
- [ ] Al pasar el puntero se ve el nombre del nodo, o el tipo y los extremos de la relación, y el cursor cambia a una mano.
- [ ] Clic en un nodo → su información. Clic en una relación → su tipo y extremos. Arrastrar para girar **no** selecciona nada.
- [ ] Doble clic o «Explorar su red» cambia de centro. «Volver» regresa y está deshabilitado al principio.
- [ ] Las casillas de la leyenda, «Ninguna» y «Todas» funcionan, y la central nunca desaparece. Un tipo de relación cuyas relaciones quedan ocultas por los nodos sale atenuado.
- [ ] Los filtros se mantienen al cambiar el umbral o de entidad.
- [ ] «Vista inicial» y los atajos de teclado (`Alt + ←`, `Inicio`) funcionan.
- [ ] Con el servidor parado, aparece el aviso de error sin romper la página. Al abrirla sin servidor, sale un aviso en el centro.
- [ ] Con la ventana estrecha (menos de 700 px), todo sigue siendo usable: la leyenda se pliega tras su botón y el panel de información va abajo.
- [ ] Los fps se mantienen por encima de 30 y la barra muestra el tiempo de cálculo y los KB recibidos.

Y de la vista 3D del incremento 2:

- [ ] El grafo se mueve unos segundos y se queda quieto («Estabilizado en X,X s»).
- [ ] La entidad central está en el centro, y los nodos más relevantes, más cerca de ella. Los más conectados son más grandes.
- [ ] Personas = esferas azules, organizaciones = cubos naranjas, obras = octaedros verdes.
- [ ] Entre dos entidades con varias relaciones se ven varias curvas separadas (Elena Montsalvat y Joaquín Albereda: «Maestro de» y «Colaborador de»).
