"""Servidor de la aplicación (FastAPI).

El servidor solo da acceso a los datos (la conexión con la base de datos,
sus credenciales y las consultas) y los entrega en bruto. No calcula ninguna
relevancia ni escribe nada en la base de datos: la base de datos no tiene
relevancias y todo el cálculo (relevancia de las relaciones y de los nodos,
centralidad, colores y búsqueda) lo hace el navegador. Así el servidor
apenas consume recursos y puede atender a más usuarios a la vez.

Se arranca desde la carpeta del proyecto con:
    python -m uvicorn servidor.app:app --reload --port 8000

La documentación de la API se genera sola en http://localhost:8000/docs
"""
import json
import logging
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, HTTPException, Query, Request, Response
# Path de FastAPI (parámetros de la ruta) se llama igual que Path de pathlib
# (rutas de archivos), así que se importa con otro nombre.
from fastapi import Path as ParametroDeRuta
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StringConstraints

from servidor.api.cache_respuestas import CacheRespuestas
from servidor.api.conversor_json import ConversorJson
from servidor.datos.repositorio_datos import EntidadNoEncontrada, RepositorioDatos
from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.logica.configuracion import Configuracion
from servidor.simulacion.generador_bd_grande import GeneradorBDGrande

# Las rutas se calculan a partir de este archivo, así el servidor funciona
# aunque se arranque desde otra carpeta.
CARPETA_SERVIDOR = Path(__file__).resolve().parent
CARPETA_PROYECTO = CARPETA_SERVIDOR.parent
ARCHIVO_CONFIGURACION = CARPETA_SERVIDOR / "configuracion.json"
ARCHIVO_DATOS_EJEMPLO = CARPETA_SERVIDOR / "datos" / "datos_ejemplo.json"
CARPETA_PAGINA_PUBLICADA = CARPETA_PROYECTO / "dist"

# Si existe esta variable de entorno, manda sobre "origenDatos" de
# configuracion.json. Sirve para medir en el laboratorio con los datos grandes
# sin cambiar el archivo (y sin dejarlo cambiado):
#     $env:VISOR_ORIGEN_DATOS = "simuladaGrande"      (PowerShell)
VARIABLE_ORIGEN_DATOS = "VISOR_ORIGEN_DATOS"

# Antes, en el navegador, el repositorio simulado esperaba 150 ms para
# parecerse a una red. Ahora entre el navegador y los datos ya hay una red de
# verdad (la petición HTTP), así que no hace falta añadir más espera.
RETARDO_SIMULADO_MS = 0

# Caché de respuestas en el servidor (ver CacheRespuestas). Las relaciones
# se guardan entidad a entidad (una entrada por entidad, de unos pocos KB),
# así que 5000 entradas son unas decenas de MB de memoria.
MAX_RESPUESTAS_EN_CACHE = 5000
SEGUNDOS_VIGENCIA_CACHE = 600

# Máximo de entidades por petición de /api/relaciones. El navegador las pide
# en trozos de este tamaño (ver ClienteServicio.js).
MAX_IDS_POR_PETICION = 200
MAX_LONGITUD_ID = 100
# Máximo de entidades de la muestra del laboratorio.
MAX_MUESTRA = 1000

# Durante cuántos segundos puede el NAVEGADOR reutilizar una respuesta sin
# volver a pedirla (cabecera Cache-Control). Si el usuario vuelve a una
# entidad que ya ha visto, ni siquiera llega una petición al servidor.
SEGUNDOS_CACHE_NAVEGADOR = 120
CABECERA_CACHE_NAVEGADOR = "public, max-age=" + str(SEGUNDOS_CACHE_NAVEGADOR)

registro = logging.getLogger("servidor")
# Que se vean en la consola de uvicorn los mensajes informativos (cuántas
# relaciones se envían en cada petición).
if len(registro.handlers) == 0:
    manejador = logging.StreamHandler()
    manejador.setFormatter(logging.Formatter("%(levelname)s:     %(message)s"))
    registro.addHandler(manejador)
    registro.setLevel(logging.INFO)


def crear_configuracion() -> Configuracion:
    """Lee servidor/configuracion.json y comprueba que tiene todo lo que
    describe la base de datos (clasificación de etiquetas, límites...). Si no
    se puede leer o falta algo, el servidor NO arranca y dice qué pasa: sin
    esos datos no se puede interpretar la base de datos.
    """
    configuracion = Configuracion()
    try:
        configuracion.cargar_archivo(ARCHIVO_CONFIGURACION)
        configuracion.comprobar()
    except (OSError, ValueError) as error:
        raise RuntimeError("No se puede arrancar el servidor: " + str(error)) from error
    origen = os.environ.get(VARIABLE_ORIGEN_DATOS, "")
    if origen != "":
        configuracion.cambiar_origen_datos(origen)
    return configuracion


def crear_repositorio(configuracion: Configuracion) -> RepositorioDatos:
    """Crea el repositorio según el origen de datos configurado: "simulado"
    (los datos pequeños de ejemplo) o "simuladaGrande" (unas 25.000
    entidades inventadas, para el laboratorio).
    """
    origen = configuracion.get_origen_datos()
    registro.info("Origen de los datos: %s.", origen)
    if origen == Configuracion.ORIGEN_SIMULADA_GRANDE:
        inicio = time.perf_counter()
        datos = GeneradorBDGrande(configuracion.get_simulacion_grande()).generar()
        repositorio = RepositorioSimulado(datos, RETARDO_SIMULADO_MS, configuracion)
        registro.info("Datos simulados grandes: %d nodos y %d relaciones, generados y cargados en %.1f s.",
                      len(datos["nodos"]), len(datos["relaciones"]), time.perf_counter() - inicio)
        return repositorio
    if origen != Configuracion.ORIGEN_POR_DEFECTO:
        raise RuntimeError("El origen de datos \"" + origen + "\" aún no está disponible (llegará en el incremento "
                           "4). Usa \"simulado\" o \"simuladaGrande\" en servidor/configuracion.json.")
    with open(ARCHIVO_DATOS_EJEMPLO, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    return RepositorioSimulado(datos, RETARDO_SIMULADO_MS, configuracion)


@asynccontextmanager
async def ciclo_de_vida(aplicacion: FastAPI) -> AsyncIterator[None]:
    """Lo de antes del yield se ejecuta UNA vez al arrancar el servidor y lo
    de después, al pararlo. Así el repositorio (y la conexión con la base de
    datos) se crea una sola vez y se cierra al final.
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
    description=("API del visor: da acceso a los datos (tipos, jerarquía, nombres, relaciones y "
                 "detalles). No calcula relevancias: las calcula el navegador."),
    version="4.0.0",
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
    etiquetas de entidad). Lo que solo usa el servidor (etiquetas auxiliares,
    límites...) no se envía.
    """
    respuesta.headers["Cache-Control"] = CABECERA_CACHE_NAVEGADOR
    return ConversorJson.configuracion_a_diccionario(peticion.app.state.configuracion)


@app.get("/api/tipos")
async def obtener_tipos(peticion: Request) -> Response:
    """Los tipos de relación que hay en los datos, con sus padres.
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


@app.get("/api/jerarquia")
async def obtener_jerarquia(peticion: Request) -> Response:
    """Cada etiqueta con sus padres (los IS_A), del más cercano al más
    lejano. El navegador la usa para heredar por la jerarquía los factores
    de los tipos de entidad (Painter → Creator → Person).
    """
    repositorio = peticion.app.state.repositorio

    async def preparar_json() -> bytes:
        """Solo se ejecuta si no estaba en la caché."""
        return json.dumps(await repositorio.obtener_jerarquia(), ensure_ascii=False).encode("utf-8")

    contenido = await peticion.app.state.cache.obtener("jerarquia", preparar_json)
    return Response(content=contenido, media_type="application/json",
                    headers={"Cache-Control": CABECERA_CACHE_NAVEGADOR})


@app.get("/api/nombres")
async def obtener_nombres(peticion: Request) -> Response:
    """Todas las entidades con sus etiquetas y sus propiedades de nombre, en
    bruto: el índice en el que busca el buscador del navegador (Buscador.js).
    La página lo pide UNA vez al arrancar; así las sugerencias salen al
    instante.

    Si la base de datos real es demasiado grande para enviar todos los
    nombres, habrá que cambiarlo por una ruta que devuelva solo candidatos.
    """
    repositorio = peticion.app.state.repositorio

    async def preparar_json() -> bytes:
        """Solo se ejecuta si no estaba en la caché."""
        return json.dumps(await repositorio.obtener_nombres(), ensure_ascii=False).encode("utf-8")

    contenido = await peticion.app.state.cache.obtener("nombres", preparar_json)
    return Response(content=contenido, media_type="application/json",
                    headers={"Cache-Control": CABECERA_CACHE_NAVEGADOR})


class PeticionRelaciones(BaseModel):
    """Cuerpo de POST /api/relaciones: los ids de las entidades (de 1 a
    MAX_IDS_POR_PETICION, cada uno de MAX_LONGITUD_ID caracteres como
    mucho). FastAPI lo comprueba solo y, si no cumple, responde 422.
    """
    ids: list[Annotated[str, StringConstraints(min_length=1, max_length=MAX_LONGITUD_ID)]] = Field(
        min_length=1, max_length=MAX_IDS_POR_PETICION)


@app.post("/api/relaciones")
async def obtener_relaciones(peticion: Request, cuerpo: PeticionRelaciones) -> Response:
    """Todas las relaciones derivadas de las entidades pedidas y las
    entidades de sus extremos (ver RepositorioDatos.obtener_relaciones).
    Cada relación lleva "participantes", "participantesPorClase", "via" (con
    qué relación de la BD está unido cada extremo al intermediario) y
    "dibujable": las de los intermediarios con más de
    maxParticipantesIntermediario entidades llegan con dibujable = false
    (cuentan para la relevancia pero no se dibujan). Los registros repetidos
    del mismo evento llegan juntados en uno, con "idsIntermediarios".

    Es POST porque la lista de ids puede ser larga (hasta 200) y no cabe
    bien en una URL. Aun así, no cambia nada en el servidor.

    Para que el servidor trabaje lo mínimo, las relaciones se guardan en la
    caché del servidor ENTIDAD A ENTIDAD: si otra persona pide después una
    lista distinta que comparte entidades, esas ya no se vuelven a derivar.
    """
    repositorio = peticion.app.state.repositorio
    cache = peticion.app.state.cache
    ids: list[str] = []
    for id_entidad in cuerpo.ids:
        if id_entidad not in ids:
            ids.append(id_entidad)

    entidades: list[dict[str, Any]] = []
    ids_entidades: set[str] = set()
    relaciones: list[dict[str, Any]] = []
    ids_relaciones: set[str] = set()
    for id_entidad in ids:
        datos = await cache.obtener("relaciones|" + id_entidad, preparador_relaciones(repositorio, id_entidad))
        for entidad in datos["entidades"]:
            if entidad["id"] not in ids_entidades:
                ids_entidades.add(entidad["id"])
                entidades.append(entidad)
        for relacion in datos["relaciones"]:
            if relacion["id"] not in ids_relaciones:
                ids_relaciones.add(relacion["id"])
                relaciones.append(relacion)

    registro.info("Relaciones de %d entidades: %d relaciones y %d entidades.",
                  len(ids), len(relaciones), len(entidades))
    respuesta = ConversorJson.relaciones_a_diccionario(ids, {"entidades": entidades, "relaciones": relaciones})
    contenido = json.dumps(respuesta, ensure_ascii=False).encode("utf-8")
    return Response(content=contenido, media_type="application/json")


def preparador_relaciones(repositorio: RepositorioDatos, id_entidad: str) -> Any:
    """La función que prepara las relaciones de UNA entidad para la caché
    (solo se llama si no estaban guardadas). Si la entidad no existe, 404.
    """
    async def preparar() -> dict[str, Any]:
        try:
            return await repositorio.obtener_relaciones([id_entidad])
        except EntidadNoEncontrada as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    return preparar


@app.get("/api/muestra")
async def obtener_muestra(peticion: Request, n: Annotated[int, Query(ge=1, le=MAX_MUESTRA)] = 325,
                          semilla: int = 7) -> Response:
    """Ids de entidades para el laboratorio (ver
    RepositorioDatos.obtener_muestra): con la misma n y la misma semilla,
    siempre las mismas. No la usa la aplicación.
    """
    muestra = await peticion.app.state.repositorio.obtener_muestra(n, semilla)
    return Response(content=json.dumps(muestra, ensure_ascii=False).encode("utf-8"), media_type="application/json")


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


# ─────────────── Página publicada ───────────────
# Al publicar, "npm run build" deja la página en dist/. Si existe, este mismo
# servidor la sirve en "/", así basta con un solo programa (Python) para la
# página y la API. html=True hace que "/" devuelva index.html.
# Durante el desarrollo no hace falta: la página la sirve Vite (npm run dev).
if CARPETA_PAGINA_PUBLICADA.is_dir():
    app.mount("/", StaticFiles(directory=CARPETA_PAGINA_PUBLICADA, html=True), name="pagina")
