# Visor de patrimonio 3D · Incremento 2: servidor Python y visualización 3D

Trabajo de Fin de Grado. Aplicación web para explorar en 3D una base de datos de conocimiento sobre patrimonio cultural (grupo IRTIC, Universitat de València).

El desarrollo se divide en cuatro incrementos:

1. Modelo y subgrafo (O1): datos simulados, cálculo de la relevancia y construcción del subgrafo. ✔
2. Visualización 3D (O2): servidor Python, Three.js y disposición con un grafo dirigido por fuerzas. ✔ (este)
3. Exploración (O3): buscador, información de nodos, navegación y filtros.
4. Datos reales y validación (O4): conexión con la base de datos y pruebas de rendimiento y usabilidad.

## Arquitectura

```
┌──────────────── NAVEGADOR (JavaScript + Three.js) ────────────────┐
│  main.js ─► EscenaGrafo (3D, fuerzas)   Leyenda   barra de estado │
│                 ▲                                                 │
│           ClienteServicio  (convierte el JSON en objetos)         │
└─────────────────┼─────────────────────────────────────────────────┘
                  │  HTTP + JSON: UNA petición por subgrafo
                  │  GET /api/subgrafo/p01?umbral=0.3
┌─────────────────▼──────────── SERVIDOR (Python + FastAPI) ────────┐
│  app.py (rutas) ─► ConversorJson                                  │
│        │                                                          │
│        ▼                                                          │
│  ConstructorSubgrafo ─► RelevanciaDesdeBD, CalculadorCentralidad  │
│        │                                                          │
│        ▼                                                          │
│  RepositorioDatos ◄── RepositorioSimulado (datos_ejemplo.json)    │
│                   ◄── (incremento 4: base de datos real)          │
└───────────────────────────────────────────────────────────────────┘
```

- **Python** hace todo el trabajo con los datos: acceso al repositorio, relevancia, construcción del subgrafo, centralidad y colores.
- **JavaScript** solo dibuja: modelo para dibujar, disposición por fuerzas, escena 3D y leyenda.

### Por qué la lógica está en Python

- Cuando se conecte la base de datos real, las consultas y la contraseña tienen que estar en el servidor, no en el navegador (cualquiera puede leer el código del navegador).
- Construir el subgrafo en el navegador obligaría a hacer una petición por cada nodo expandido (hasta 150). En el servidor, el navegador hace una sola petición por subgrafo.

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

- **Python** (lógica del subgrafo y API): `python -m pytest` (con el entorno virtual activado). Están en `servidor/tests/`.
- **Navegador** (modelo, cliente, simulación, disposición, nodos, enlaces y leyenda): con `npm run dev` en marcha, abre `http://localhost:5173/pruebas.html`. Arriba aparece «X de Y pruebas correctas» y debajo cada prueba en verde o en rojo con el motivo. Estas pruebas no necesitan el servidor Python.

`EscenaGrafo` necesita WebGL y se comprueba a mano con la lista de abajo.

## Publicar

```
npm run build
python -m uvicorn servidor.app:app --port 8000
```

`npm run build` deja la página en `dist/`. Si existe esa carpeta, el servidor Python la sirve en `/` además de la API, así que en el servidor real basta con un solo programa: hace falta Python, pero no Node. La aplicación queda en `http://localhost:8000/`.

En un servidor con varios núcleos se pueden arrancar varios procesos para atender a más usuarios a la vez (cada uno con su propia caché): `python -m uvicorn servidor.app:app --port 8000 --workers 4`. `--workers` no se puede usar junto con `--reload`.

## Rendimiento con muchos usuarios a la vez (RNF-01)

El cálculo del subgrafo se queda en el servidor (por seguridad y para hacer una sola petición por subgrafo), pero se ha hecho que cada petición cueste lo mínimo:

1. **Índice de relaciones** (`RepositorioSimulado`): las relaciones de cada entidad se agrupan al arrancar, en lugar de recorrer las 1036 cada vez que se expande un nodo. Construir el subgrafo de 150 nodos de `p01` pasó de 58 ms a 12 ms.
2. **Caché de subgrafos** (`CacheSubgrafos`): cada subgrafo se calcula y se convierte a JSON una sola vez; las peticiones iguales reciben el JSON guardado. Si llegan varias iguales mientras se calcula, todas esperan al mismo cálculo. Guarda como mucho 200 subgrafos (unos 20 MB) durante 10 minutos.
3. **Umbral redondeado a 2 decimales**, para que pedir 0,3 y 0,3000001 sea lo mismo y nadie pueda saltarse la caché.
4. **Caché del navegador**: las respuestas llevan `Cache-Control: max-age=120`, así que si el usuario vuelve a una entidad que ya ha visto en los últimos 2 minutos, el navegador no pregunta al servidor. Durante el desarrollo, si regeneras los datos de ejemplo, reinicia el servidor y recarga con `Ctrl + F5`.

Prueba de carga en un portátil de 4 núcleos (el programa que lanza las peticiones corre en el mismo equipo), con subgrafos de hasta 150 nodos:

| | Peticiones por segundo | Espera mediana (50 a la vez) |
|---|---|---|
| Antes | 16–25 | 1,9–3,0 s |
| Después | 150–200 | 0,17 s |

## Datos de ejemplo

`servidor/datos/datos_ejemplo.json` tiene 378 entidades (131 personas, 22 organizaciones y 225 obras) y 1036 relaciones de 14 tipos, todas inventadas. Las 16 entidades y 27 relaciones del incremento 1 siguen al principio del archivo, con los mismos ids, porque las pruebas dependen de ellas.

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

## Configuración

- `servidor/configuracion.json` (la de verdad): `origenDatos`, `umbralPorDefecto`, `maxNodos` y `entidadInicial`. Si falta o tiene valores no válidos, se usan los valores por defecto (RNF-16). Las credenciales de la base de datos real **no** irán aquí, sino en variables de entorno (archivo `.env`, que Git ignora).
- `public/config.json`: solo `urlServicio` (`"/api"`), para que la página sepa dónde está la API. El umbral por defecto y la entidad inicial los pide la página a `/api/configuracion`.

## Cómo añadir otra fuente de datos

Crear en `servidor/datos/` una clase nueva que herede de `RepositorioDatos` e implemente sus cuatro métodos asíncronos (`buscar_entidades`, `obtener_entidad`, `obtener_relaciones`, `obtener_tipos_relacion`) y, si abre conexiones, `cerrar`. Después, en `crear_repositorio` de `servidor/app.py`, crearla cuando `origenDatos` tenga su nombre. El resto del servidor y todo el navegador siguen igual (RNF-17).

## API

| Petición | Respuesta |
|---|---|
| `GET /api/salud` | `{"estado": "ok"}` |
| `GET /api/configuracion` | `{"umbralPorDefecto": 0.3, "entidadInicial": "p01"}` |
| `GET /api/entidades?texto=&tipo=&limite=50` | lista de entidades (`id`, `nombre`, `tipo`) |
| `GET /api/subgrafo/{id}?umbral=0.3` | el subgrafo completo: `idCentral`, `umbral`, `nodos` y `relaciones` |

- `umbral` entre 0 y 1; si no, **422**. Si no se indica, se usa el de la configuración. Se redondea a 2 decimales.
- El máximo de nodos lo pone el servidor y no se puede cambiar desde la petición.
- Entidad inexistente: **404** con `{"detail": "No existe la entidad P99"}`. Cualquier otro error: **500** con un mensaje genérico (el detalle queda en el registro del servidor).

## Carpetas y clases

### Servidor (`servidor/`)

| Ruta | Qué es |
|---|---|
| `app.py` | Rutas de la API, creación del repositorio al arrancar y página publicada. |
| `api/conversor_json.py` | **ConversorJson**: convierte entidades, relaciones y subgrafos en diccionarios (la forma del JSON está solo aquí). |
| `api/cache_subgrafos.py` | **CacheSubgrafos**: guarda los subgrafos ya calculados (en JSON) para no repetir el trabajo con muchos usuarios (RNF-01). |
| `herramientas/generador_datos_ejemplo.py` | **GeneradorDatosEjemplo**: herramienta que genera los datos de ejemplo grandes (no la usa la aplicación). |
| `modelo/` | Traducción del modelo del incremento 1 (`TipoEntidad`, `Entidad`, `Persona`, `Organizacion`, `ObraDeArte`, `TipoRelacion`, `Relacion`, `NodoRelevante`, `Subgrafo`). |
| `datos/` | `RepositorioDatos` (interfaz), `RepositorioSimulado`, `FabricaEntidades` y `datos_ejemplo.json`. |
| `logica/` | `Configuracion`, `EstrategiaRelevancia`, `RelevanciaDesdeBD`, `CalculadorCentralidad`, `PaletaColores` y `ConstructorSubgrafo` (con la explicación de la búsqueda «primero el mejor»). |
| `tests/` | Pruebas de pytest. |

### Navegador (`src/`)

| Ruta | Qué es |
|---|---|
| `main.js` | Punto de entrada: crea y conecta las piezas (en el incremento 3 lo hará `Aplicacion`). |
| `modelo/` | Las clases del modelo, para dibujar. |
| `datos/FabricaEntidades.js` | Crea la subclase de `Entidad` según el tipo. |
| `datos/ClienteServicio.js` | **Nuevo.** Pide los datos a la API y convierte el JSON en objetos del modelo (RNF-17). |
| `vista3d/SimulacionFuerzas.js` | **Nuevo.** Grafo dirigido por fuerzas hecho a mano: repulsión, muelles y restricción radial (RNF-28, RF-17, RF-40). |
| `vista3d/CalculadorDisposicion.js` | **Nuevo.** Posiciones iniciales deterministas para la simulación. |
| `vista3d/NodoVisual.js` | **Nuevo.** Clase abstracta: malla 3D y etiqueta de un nodo (RF-18, RF-22). |
| `vista3d/NodoPersona.js` | **Nuevo.** Esfera azul. |
| `vista3d/NodoOrganizacion.js` | **Nuevo.** Cubo naranja. |
| `vista3d/NodoObra.js` | **Nuevo.** Octaedro verde. |
| `vista3d/FabricaNodosVisuales.js` | **Nuevo.** Crea el `NodoVisual` de cada nodo, con tamaño según la centralidad. |
| `vista3d/EnlaceVisual.js` | **Nuevo.** Línea o curva de una relación, con color por tipo y opacidad por relevancia (RF-20, RF-21, RF-38). |
| `vista3d/EscenaGrafo.js` | **Nuevo.** Escena, cámara, luces, renderizadores, controles y bucle de animación (RF-16 a RF-22, RNF-18). |
| `interfaz/ComponenteUI.js` | **Nuevo.** Clase abstracta de los componentes 2D, con la función auxiliar `crear`. |
| `interfaz/Leyenda.js` | **Nuevo.** Leyenda de los tipos presentes, del tamaño y de la distancia (RF-23, RF-24). |
| `estilos.css` | Estilos de las dos páginas. |

### Pruebas del navegador (`tests/`)

`miniPruebas.js` (mini sistema de pruebas), `ejecutarPruebas.js` (importa y ejecuta todas) y un archivo `pruebas*.js` por tema.

## Lista de comprobación visual (a mano)

Con los dos servidores en marcha y `http://localhost:5173/` abierto:

- [ ] El grafo se mueve unos segundos y se queda quieto, y la barra de abajo muestra «Estabilizado en X,X s».
- [ ] La entidad central está en el centro y los nodos más relevantes, más cerca de ella.
- [ ] Personas = esferas azules, organizaciones = cubos naranjas, obras = octaedros verdes.
- [ ] Los nodos más conectados son más grandes.
- [ ] Las relaciones tienen colores por tipo y las más relevantes se ven más intensas.
- [ ] Entre dos entidades con varias relaciones se ven varias curvas separadas (por ejemplo, Elena Montsalvat y Joaquín Albereda: «Maestro de» y «Colaborador de»).
- [ ] Se forman grupos de entidades muy relacionadas.
- [ ] La leyenda solo muestra los tipos presentes, con sus cantidades.
- [ ] Se puede girar (arrastrando) y hacer zoom (rueda), y «Vista inicial» recoloca la cámara.
- [ ] Al subir el umbral hay menos nodos.
- [ ] Los fps de la barra de estado se mantienen por encima de 30.
- [ ] Si se para el servidor Python (`Ctrl + C`), al cambiar de entidad aparece el aviso rojo «No se puede conectar con el servidor» y la página no se rompe.
