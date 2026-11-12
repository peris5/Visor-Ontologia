"""Servidor de la aplicación (FastAPI).

Desde el incremento 3 el servidor hace LO MÍNIMO: solo da acceso a los
datos (lo que obligatoriamente tiene que estar aquí: la conexión con la base
de datos, sus credenciales y las consultas). Entrega los datos en bruto y
todo el cálculo (relevancias, subgrafo, centralidad, colores y búsqueda) lo
hace el navegador. Así el servidor apenas consume recursos y puede atender
a más usuarios a la vez (RNF-05).

Se arranca desde la carpeta del proyecto con:
    python -m uvicorn servidor.app:app --reload --port 8000

La documentación de la API se genera sola en http://localhost:8000/docs

Requisitos: RNF-17 (acceso a datos separado), RNF-16 (configuración),
RNF-05 (usuarios simultáneos), RNF-13 (entradas acotadas y validadas).
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
from servidor.datos.repositorio_datos import RepositorioDatos
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
# grande ocupa unos 100 KB, así que 200 respuestas son unos 20 MB de memoria.
MAX_RESPUESTAS_EN_CACHE = 200
SEGUNDOS_VIGENCIA_CACHE = 600

# Durante cuántos segundos puede el NAVEGADOR reutilizar una respuesta sin
# volver a pedirla (cabecera Cache-Control). Si el usuario vuelve a una
# entidad que ya ha visto, ni siquiera llega una petición al servidor.
SEGUNDOS_CACHE_NAVEGADOR = 120
CABECERA_CACHE_NAVEGADOR = "public, max-age=" + str(SEGUNDOS_CACHE_NAVEGADOR)

registro = logging.getLogger("servidor")


def crear_configuracion() -> Configuracion:
    """Lee servidor/configuracion.json. Si no se puede leer, sigue con los
    valores por defecto y lo apunta en el registro (RNF-16).
    """
    configuracion = Configuracion()
    try:
        configuracion.cargar_archivo(ARCHIVO_CONFIGURACION)
    except (OSError, ValueError) as error:
        registro.warning("No se ha podido leer %s (%s). Se usan los valores por defecto.",
                         ARCHIVO_CONFIGURACION, error)
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
    return RepositorioSimulado(datos, RETARDO_SIMULADO_MS)


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
    description="API del visor: solo da acceso a los datos (nombres y vecindarios).",
    version="3.0.0",
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
    """Lo que la página necesita saber de la configuración del servidor.
    Desde el incremento 3 también se envía maxNodos, porque la poda del
    subgrafo la hace el navegador. Así sigue definido en un solo sitio
    (servidor/configuracion.json, RNF-16).
    """
    respuesta.headers["Cache-Control"] = CABECERA_CACHE_NAVEGADOR
    configuracion = peticion.app.state.configuracion
    return {
        "umbralPorDefecto": configuracion.get_umbral_por_defecto(),
        "maxNodos": configuracion.get_max_nodos(),
        "entidadInicial": configuracion.get_entidad_inicial(),
    }


@app.get("/api/nombres")
async def obtener_nombres(peticion: Request) -> Response:
    """Todas las entidades, solo con id, nombre y tipo: el índice en el que
    busca el buscador del navegador (Buscador.js). La página lo pide UNA vez
    al arrancar; así las sugerencias salen al instante, sin ir al servidor
    cada vez que se escribe una letra (RNF-03).

    Con los datos simulados (unas 400 entidades, unos 25 KB) se envían
    todos los nombres y el cliente busca entre ellos. Si la base de datos
    real es demasiado grande para esto, en el incremento 4 se cambiará por
    una ruta que devuelva solo candidatos.
    """
    repositorio = peticion.app.state.repositorio
    cache = peticion.app.state.cache

    async def preparar_json() -> bytes:
        """Lee todas las entidades y las convierte a JSON. Solo se ejecuta si
        no estaba en la caché.
        """
        entidades = await repositorio.buscar_entidades("", None, None)
        lista = []
        for entidad in entidades:
            lista.append(ConversorJson.entidad_resumida_a_diccionario(entidad))
        return json.dumps(lista, ensure_ascii=False).encode("utf-8")

    contenido = await cache.obtener("nombres", preparar_json)
    return Response(content=contenido, media_type="application/json",
                    headers={"Cache-Control": CABECERA_CACHE_NAVEGADOR})


@app.get("/api/vecindario/{id_entidad}")
async def obtener_vecindario(
    peticion: Request,
    id_entidad: str = ParametroDeRuta(max_length=100),
    umbral: float | None = Query(None, ge=0, le=1),
) -> Response:
    """Los datos EN BRUTO alrededor de una entidad (ver
    RepositorioDatos.obtener_vecindario). Con ellos el navegador construye
    el subgrafo; el servidor no calcula nada más.

    FastAPI comprueba que el umbral está entre 0 y 1 (si no, responde 422).
    Si no se indica, se usa el de la configuración. El máximo de entidades
    lo pone el servidor (maxEntidadesVecindario) y no se puede cambiar desde
    la petición, para que nadie pueda pedir la base de datos entera (RNF-13).

    Para que el servidor trabaje lo mínimo con muchos usuarios a la vez:
     - El umbral se redondea HACIA ABAJO a 2 decimales (el deslizador va de
       0,05 en 0,05). Así 0,3 y 0,3000001 piden el mismo vecindario y nadie
       puede saltarse la caché pidiendo umbrales casi iguales. Tiene que ser
       hacia abajo: con un umbral menor el vecindario es igual o más grande,
       así que sigue conteniendo todo lo necesario (redondeando hacia arriba
       podrían faltar relaciones). La respuesta indica el umbral usado.
     - La respuesta se busca primero en la caché (CacheRespuestas).
     - Lleva Cache-Control para que el navegador la reutilice.
    """
    configuracion = peticion.app.state.configuracion
    repositorio = peticion.app.state.repositorio
    cache = peticion.app.state.cache

    umbral_pedido = configuracion.get_umbral_por_defecto()
    if umbral is not None:
        umbral_pedido = umbral
    umbral_usado = redondear_hacia_abajo(umbral_pedido)
    max_entidades = configuracion.get_max_entidades_vecindario()

    async def preparar_json() -> bytes:
        """Recorre el vecindario y lo convierte a JSON. Solo se ejecuta si
        no estaba en la caché.
        """
        entidad = await repositorio.obtener_entidad(id_entidad)
        if entidad is None:
            raise HTTPException(status_code=404, detail="No existe la entidad " + id_entidad)
        vecindario = await repositorio.obtener_vecindario(id_entidad, umbral_usado, max_entidades)
        tipos = await repositorio.obtener_tipos_relacion()
        diccionario = ConversorJson.vecindario_a_diccionario(id_entidad, umbral_usado, vecindario, tipos)
        # Se guarda ya convertido a texto JSON: así, cuando se reutiliza, el
        # servidor ni siquiera tiene que volver a convertirlo.
        return json.dumps(diccionario, ensure_ascii=False).encode("utf-8")

    clave = "vecindario|" + id_entidad + "|" + str(umbral_usado)
    contenido = await cache.obtener(clave, preparar_json)
    return Response(content=contenido, media_type="application/json",
                    headers={"Cache-Control": CABECERA_CACHE_NAVEGADOR})


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
