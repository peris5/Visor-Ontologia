"""Servidor de la aplicación (FastAPI).

Hace todo el trabajo con los datos: lee el repositorio, calcula la relevancia,
construye el subgrafo y lo envía al navegador en JSON. El navegador hace
UNA sola petición por subgrafo y solo se ocupa de dibujarlo.

Se arranca desde la carpeta del proyecto con:
    python -m uvicorn servidor.app:app --reload --port 8000

La documentación de la API se genera sola en http://localhost:8000/docs

Requisitos: RNF-17 (acceso a datos separado), RNF-16 (configuración),
RF-08 a RF-13, RF-37 y RF-39 (cálculo del subgrafo, ahora en el servidor).
"""
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from servidor.api.conversor_json import ConversorJson
from servidor.datos.repositorio_datos import RepositorioDatos
from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.logica.configuracion import Configuracion
from servidor.logica.constructor_subgrafo import ConstructorSubgrafo
from servidor.logica.relevancia_desde_bd import RelevanciaDesdeBD
from servidor.modelo.tipo_entidad import TipoEntidad

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
    yield
    await repositorio.cerrar()


app = FastAPI(
    title="Visor de patrimonio 3D",
    description="API del visor: busca entidades y construye su subgrafo relevante.",
    version="2.0.0",
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
async def obtener_configuracion(peticion: Request) -> dict[str, Any]:
    """Lo que la página necesita saber de la configuración del servidor.
    El máximo de nodos NO se envía: lo decide solo el servidor.
    """
    configuracion = peticion.app.state.configuracion
    return {
        "umbralPorDefecto": configuracion.get_umbral_por_defecto(),
        "entidadInicial": configuracion.get_entidad_inicial(),
    }


@app.get("/api/entidades")
async def buscar_entidades(
    peticion: Request,
    texto: str = "",
    tipo: TipoEntidad | None = None,
    limite: int = Query(50, ge=1, le=1000),
) -> list[dict[str, Any]]:
    """Entidades cuyo nombre contiene el texto (id, nombre y tipo)."""
    repositorio = peticion.app.state.repositorio
    entidades = await repositorio.buscar_entidades(texto, tipo, limite)
    resultado = []
    for entidad in entidades:
        resultado.append(ConversorJson.entidad_resumida_a_diccionario(entidad))
    return resultado


@app.get("/api/subgrafo/{id_entidad}")
async def obtener_subgrafo(
    peticion: Request,
    id_entidad: str,
    umbral: float | None = Query(None, ge=0, le=1),
) -> dict[str, Any]:
    """El subgrafo relevante de una entidad, ya construido.

    FastAPI comprueba que el umbral está entre 0 y 1 (si no, responde 422).
    Si no se indica, se usa el de la configuración. El máximo de nodos lo
    pone el servidor y no se puede cambiar desde la petición, para que nadie
    pueda pedir un subgrafo enorme.
    """
    configuracion = peticion.app.state.configuracion
    repositorio = peticion.app.state.repositorio

    entidad = await repositorio.obtener_entidad(id_entidad)
    if entidad is None:
        raise HTTPException(status_code=404, detail="No existe la entidad " + id_entidad)

    umbral_usado = configuracion.get_umbral_por_defecto()
    if umbral is not None:
        umbral_usado = umbral

    # Se crea un constructor por petición: es muy ligero y así dos peticiones
    # a la vez con umbrales distintos no se pisan el umbral la una a la otra.
    constructor = ConstructorSubgrafo(repositorio, RelevanciaDesdeBD(), umbral_usado, configuracion.get_max_nodos())
    subgrafo = await constructor.construir(id_entidad)
    return ConversorJson.subgrafo_a_diccionario(subgrafo)


# ─────────────── Página publicada ───────────────
# Al publicar, "npm run build" deja la página en dist/. Si existe, este mismo
# servidor la sirve en "/", así basta con un solo programa (Python) para la
# página y la API. html=True hace que "/" devuelva index.html.
# Durante el desarrollo no hace falta: la página la sirve Vite (npm run dev).
if CARPETA_PAGINA_PUBLICADA.is_dir():
    app.mount("/", StaticFiles(directory=CARPETA_PAGINA_PUBLICADA, html=True), name="pagina")
