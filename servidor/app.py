"""Servidor de la aplicación (FastAPI).

Desde el incremento 3 el servidor hace LO MÍNIMO: solo da acceso a los
datos (lo que obligatoriamente tiene que estar aquí: la conexión con la base
de datos, sus credenciales y las consultas). Entrega los datos en bruto y el
cálculo del subgrafo (relevancia de los nodos, centralidad, colores y
búsqueda) lo hace el navegador. Así el servidor apenas consume recursos y
puede atender a más usuarios a la vez (RNF-05).

Desde el incremento 3b los datos tienen la forma de la base de datos Neo4j
del proyecto, y el servidor hace una cosa más: ASIGNA la relevancia a las
relaciones que recorre y no la tienen, y la GUARDA (ver AsignadorRelevancia).
Es lo único del cálculo que va aquí, porque es lo único que hay que guardar
en la base de datos.

Se arranca desde la carpeta del proyecto con:
    python -m uvicorn servidor.app:app --reload --port 8000

La documentación de la API se genera sola en http://localhost:8000/docs

Requisitos: RNF-17 (acceso a datos separado), RNF-16 (configuración),
RNF-05 (usuarios simultáneos), RNF-13 (entradas acotadas y validadas),
RF-09 (relevancia asignada), RF-39 (/api/tipos).
"""
import json
import logging
import math
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request, Response
# Path de FastAPI (parámetros de la ruta) se llama igual que Path de pathlib
# (rutas de archivos), así que se importa con otro nombre.
from fastapi import Path as ParametroDeRuta
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from servidor.api.cache_respuestas import CacheRespuestas
from servidor.api.conversor_json import ConversorJson
from servidor.datos.repositorio_datos import EntidadNoEncontrada, RepositorioDatos
from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.logica.configuracion import Configuracion

# Las rutas se calculan a partir de este archivo, así el servidor funciona
# aunque se arranque desde otra carpeta.
CARPETA_SERVIDOR = Path(__file__).resolve().parent
CARPETA_PROYECTO = CARPETA_SERVIDOR.parent
ARCHIVO_CONFIGURACION = CARPETA_SERVIDOR / "configuracion.json"
ARCHIVO_DATOS_EJEMPLO = CARPETA_SERVIDOR / "datos" / "datos_ejemplo.json"
CARPETA_PAGINA_PUBLICADA = CARPETA_PROYECTO / "dist"

# Antes, en el navegador, el repositorio simulado esperaba 150 ms para
# parecerse a una red. Ahora entre el navegador y los datos ya hay una red de
# verdad (la petición HTTP), así que no hace falta añadir más espera.
RETARDO_SIMULADO_MS = 0

# Caché de respuestas en el servidor (ver CacheRespuestas). Un vecindario
# grande ocupa unos 200 KB, así que 200 respuestas son unos 40 MB de memoria.
MAX_RESPUESTAS_EN_CACHE = 200
SEGUNDOS_VIGENCIA_CACHE = 600

# Durante cuántos segundos puede el NAVEGADOR reutilizar una respuesta sin
# volver a pedirla (cabecera Cache-Control). Si el usuario vuelve a una
# entidad que ya ha visto, ni siquiera llega una petición al servidor.
SEGUNDOS_CACHE_NAVEGADOR = 120
CABECERA_CACHE_NAVEGADOR = "public, max-age=" + str(SEGUNDOS_CACHE_NAVEGADOR)

registro = logging.getLogger("servidor")
# Que se vean en la consola de uvicorn los mensajes informativos (cuántas
# relevancias se asignan en cada vecindario).
if len(registro.handlers) == 0:
    manejador = logging.StreamHandler()
    manejador.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    registro.addHandler(manejador)
    registro.setLevel(logging.INFO)


def crear_configuracion() -> Configuracion:
    """Lee servidor/configuracion.json y comprueba que tiene todo lo que
    describe la base de datos (clasificación de etiquetas, pesos...). Si no
    se puede leer o falta algo, el servidor NO arranca y dice qué pasa
    (RNF-16): sin esos datos no se puede interpretar la base de datos.
    """
    configuracion = Configuracion()
    try:
        configuracion.cargar_archivo(ARCHIVO_CONFIGURACION)
        configuracion.comprobar()
    except (OSError, ValueError) as error:
        raise RuntimeError("No se puede arrancar el servidor: " + str(error)) from error
    return configuracion


def crear_repositorio(configuracion: Configuracion) -> RepositorioDatos:
    """Crea el repositorio según el origen de datos configurado. De momento
    solo existe el simulado; la base de datos real llegará en el incremento 4
    con una clase nueva que implemente RepositorioDatos.
    """
    origen = configuracion.get_origen_datos()
    if origen != "simulado":
        raise RuntimeError("El origen de datos \"" + origen + "\" aún no está disponible "
                           "(llegará en el incremento 4). Usa \"simulado\" en servidor/configuracion.json.")
    with open(ARCHIVO_DATOS_EJEMPLO, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    # El repositorio crea, UNA sola vez, el AsignadorRelevancia y su almacén.
    return RepositorioSimulado(datos, RETARDO_SIMULADO_MS, configuracion)


@asynccontextmanager
async def ciclo_de_vida(aplicacion: FastAPI) -> AsyncIterator[None]:
    """Lo de antes del yield se ejecuta UNA vez al arrancar el servidor y lo
    de después, al pararlo. Así el repositorio (y, en el incremento 4, la
    conexión con la base de datos) se crea una sola vez y se cierra al final.
    """
    configuracion = crear_configuracion()
    repositorio = crear_repositorio(configuracion)
    aplicacion.state.configuracion = configuracion
    aplicacion.state.repositorio = repositorio
    aplicacion.state.cache = CacheRespuestas(MAX_RESPUESTAS_EN_CACHE, SEGUNDOS_VIGENCIA_CACHE)
    yield
    await repositorio.cerrar()


app = FastAPI(
    title="Visor de patrimonio 3D",
    description=("API del visor: da acceso a los datos (tipos, nombres, vecindarios y detalles) "
                 "y asigna la relevancia de las relaciones que recorre."),
    version="3.1.0",
    lifespan=ciclo_de_vida,
)


@app.exception_handler(Exception)
async def error_inesperado(peticion: Request, error: Exception) -> JSONResponse:
    """Cualquier error que no esté previsto: el detalle se apunta en el
    registro del servidor y al usuario solo se le da un mensaje genérico
    (no se le enseñan errores internos).
    """
    registro.exception("Error inesperado al atender %s", peticion.url.path)
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor."})


# ─────────────── Rutas de la API ───────────────
# Se declaran ANTES de montar la página publicada (al final del archivo),
# para que esta no las tape.


@app.get("/api/salud")
async def salud() -> dict[str, str]:
    """Sirve para comprobar que el servidor está en marcha."""
    return {"estado": "ok"}


@app.get("/api/configuracion")
async def obtener_configuracion(peticion: Request, respuesta: Response) -> dict[str, Any]:
    """Lo que la página necesita saber de la configuración del servidor
    (umbral, máximo de nodos, entidad inicial, idioma, nombres de los tipos y
    etiquetas de entidad). Lo que solo usa el servidor (pesos, etiquetas
    auxiliares, límites...) no se envía.
    """
    respuesta.headers["Cache-Control"] = CABECERA_CACHE_NAVEGADOR
    return ConversorJson.configuracion_a_diccionario(peticion.app.state.configuracion)


@app.get("/api/tipos")
async def obtener_tipos(peticion: Request) -> Response:
    """Los tipos de relación que hay en los datos, con sus padres (RF-39).
    Salen de los datos, no de una lista: un tipo nuevo de la BD aparece aquí
    sin cambiar el código.
    """
    repositorio = peticion.app.state.repositorio

    async def preparar_json() -> bytes:
        """Solo se ejecuta si no estaba en la caché."""
        return json.dumps(await repositorio.obtener_tipos(), ensure_ascii=False).encode("utf-8")

    contenido = await peticion.app.state.cache.obtener("tipos", preparar_json)
    return Response(content=contenido, media_type="application/json",
                    headers={"Cache-Control": CABECERA_CACHE_NAVEGADOR})


@app.get("/api/nombres")
async def obtener_nombres(peticion: Request) -> Response:
    """Todas las entidades con sus etiquetas y sus propiedades de nombre, en
    bruto: el índice en el que busca el buscador del navegador (Buscador.js).
    La página lo pide UNA vez al arrancar; así las sugerencias salen al
    instante (RNF-03).

    Con los datos simulados (205 entidades) se envían todos los nombres y el
    cliente busca entre ellos. Si la base de datos real es demasiado grande
    para esto, en el incremento 4 se cambiará por una ruta que devuelva solo
    candidatos.
    """
    repositorio = peticion.app.state.repositorio

    async def preparar_json() -> bytes:
        """Solo se ejecuta si no estaba en la caché."""
        return json.dumps(await repositorio.obtener_nombres(), ensure_ascii=False).encode("utf-8")

    contenido = await peticion.app.state.cache.obtener("nombres", preparar_json)
    return Response(content=contenido, media_type="application/json",
                    headers={"Cache-Control": CABECERA_CACHE_NAVEGADOR})


@app.get("/api/vecindario/{id_entidad}")
async def obtener_vecindario(
    peticion: Request,
    id_entidad: str = ParametroDeRuta(max_length=100),
    umbral: float | None = Query(None, ge=0, le=1),
) -> Response:
    """Las entidades (en bruto) y las relaciones derivadas alrededor de una
    entidad, cada relación con su relevancia ya asignada (ver
    RepositorioDatos.obtener_vecindario). Con ellos el navegador construye el
    subgrafo.

    FastAPI comprueba que el umbral está entre 0 y 1 (si no, responde 422).
    Si no se indica, se usa el de la configuración. El máximo de entidades
    lo pone el servidor (maxEntidadesVecindario) y no se puede cambiar desde
    la petición (RNF-13).

    Para que el servidor trabaje lo mínimo:
     - El umbral se redondea HACIA ABAJO a 2 decimales: así 0,3 y 0,3000001
       son la misma petición. Tiene que ser hacia abajo: con un umbral menor
       el vecindario es igual o más grande y sigue sirviendo.
     - El vecindario se guarda en la caché del servidor (CacheRespuestas).
       Si se reutiliza de la caché, no se ha asignado nada nuevo: la
       respuesta dice 0 asignadas y todas las del recorrido reutilizadas.
     - NO se guarda en la caché del NAVEGADOR (Cache-Control: no-store), para
       que las estadísticas de asignación de cada petición sean las suyas.
    En el registro del servidor se apunta cuántas relevancias se asignaron y
    cuántas se reutilizaron.
    """
    configuracion = peticion.app.state.configuracion
    repositorio = peticion.app.state.repositorio

    umbral_pedido = configuracion.get_umbral_por_defecto()
    if umbral is not None:
        umbral_pedido = umbral
    umbral_usado = redondear_hacia_abajo(umbral_pedido)
    max_entidades = configuracion.get_max_entidades_vecindario()
    # Una lista para que la función de dentro pueda cambiarla: dice si en
    # esta petición se ha recorrido de verdad o se ha reutilizado la caché.
    recorrido_ahora = [False]

    async def preparar() -> dict[str, Any]:
        """Recorre el vecindario. Solo se ejecuta si no estaba en la caché."""
        try:
            vecindario = await repositorio.obtener_vecindario(id_entidad, umbral_usado, max_entidades)
        except EntidadNoEncontrada as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        recorrido_ahora[0] = True
        return ConversorJson.vecindario_a_diccionario(id_entidad, umbral_usado, vecindario)

    clave = "vecindario|" + id_entidad + "|" + str(umbral_usado)
    guardado = await peticion.app.state.cache.obtener(clave, preparar)
    respuesta = dict(guardado)
    if not recorrido_ahora[0]:
        consultadas = guardado["relevanciasAsignadas"] + guardado["relevanciasReutilizadas"]
        respuesta["relevanciasAsignadas"] = 0
        respuesta["relevanciasReutilizadas"] = consultadas
    registro.info("Vecindario de %s (umbral %s): %d relevancias asignadas y %d reutilizadas%s.",
                  id_entidad, umbral_usado, respuesta["relevanciasAsignadas"],
                  respuesta["relevanciasReutilizadas"], texto_cache(recorrido_ahora[0]))
    contenido = json.dumps(respuesta, ensure_ascii=False).encode("utf-8")
    return Response(content=contenido, media_type="application/json", headers={"Cache-Control": "no-store"})


@app.get("/api/detalle/{id_entidad}")
async def obtener_detalle(peticion: Request, id_entidad: str = ParametroDeRuta(max_length=100)) -> Response:
    """En bruto, lo que se muestra al seleccionar una entidad: eventos
    (nacimiento, muerte, residencia y los demás), imágenes, fuentes externas
    y ubicación (ver RepositorioDatos.obtener_detalle).
    """
    repositorio = peticion.app.state.repositorio

    async def preparar_json() -> bytes:
        """Solo se ejecuta si no estaba en la caché."""
        try:
            detalle = await repositorio.obtener_detalle(id_entidad)
        except EntidadNoEncontrada as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return json.dumps(detalle, ensure_ascii=False).encode("utf-8")

    contenido = await peticion.app.state.cache.obtener("detalle|" + id_entidad, preparar_json)
    return Response(content=contenido, media_type="application/json",
                    headers={"Cache-Control": CABECERA_CACHE_NAVEGADOR})


def texto_cache(recorrido_ahora: bool) -> str:
    """Para el registro: si el vecindario salió de la caché, se dice."""
    if recorrido_ahora:
        return ""
    return " (de la caché)"


def redondear_hacia_abajo(umbral: float) -> float:
    """El umbral redondeado hacia abajo a 2 decimales (0,349 → 0,34).

    Se suma una millonésima antes de quitar los decimales porque los
    ordenadores guardan los decimales con un pequeño error: 0,29 × 100 da
    28,999999999999996, y sin ese ajuste saldría 0,28 en lugar de 0,29.
    """
    centesimas = math.floor(umbral * 100 + 0.000001)
    return centesimas / 100


# ─────────────── Página publicada ───────────────
# Al publicar, "npm run build" deja la página en dist/. Si existe, este mismo
# servidor la sirve en "/", así basta con un solo programa (Python) para la
# página y la API. html=True hace que "/" devuelva index.html.
# Durante el desarrollo no hace falta: la página la sirve Vite (npm run dev).
if CARPETA_PAGINA_PUBLICADA.is_dir():
    app.mount("/", StaticFiles(directory=CARPETA_PAGINA_PUBLICADA, html=True), name="pagina")
