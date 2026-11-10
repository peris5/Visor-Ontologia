"""Configuracion (traducción de src/logica/Configuracion.js)."""
import json
import math
from pathlib import Path
from typing import Any


class Configuracion:
    """Lee los ajustes del servidor (el archivo servidor/configuracion.json)
    y da un valor por defecto a los que falten o no sean válidos.
    Así el resto del código no tiene que comprobar nada.

    IMPORTANTE: cuando haya base de datos real (incremento 4), su usuario y
    su contraseña NO irán en configuracion.json (que se sube a Git), sino en
    variables de entorno (por ejemplo, en un archivo .env que Git ignora).

    Requisitos: RNF-16.
    """

    ORIGEN_POR_DEFECTO = "simulado"
    URL_POR_DEFECTO = ""
    UMBRAL_POR_DEFECTO = 0.3
    MAX_NODOS_POR_DEFECTO = 150
    ENTIDAD_INICIAL_POR_DEFECTO = ""

    def __init__(self) -> None:
        # Mientras no se llame a cargar, todos los getters dan el valor por defecto.
        self.__datos: dict[str, Any] = {}

    def cargar(self, datos: Any) -> None:
        """datos: normalmente el contenido de servidor/configuracion.json."""
        if not isinstance(datos, dict):
            raise ValueError("La configuración debe ser un objeto (revisa servidor/configuracion.json).")
        self.__datos = datos

    def cargar_archivo(self, ruta: Path) -> None:
        """Lee un archivo JSON y lo carga. Lanza un error si no existe o no
        es un JSON válido (quien llama decide si sigue con los valores por defecto).
        """
        with open(ruta, encoding="utf-8") as archivo:
            datos = json.load(archivo)
        self.cargar(datos)

    def get_origen_datos(self) -> str:
        """"simulado" o el origen indicado."""
        return self.__leer_texto("origenDatos", Configuracion.ORIGEN_POR_DEFECTO)

    def get_url_servicio(self) -> str:
        """Dirección del servicio de la BD real."""
        return self.__leer_texto("urlServicio", Configuracion.URL_POR_DEFECTO)

    def get_umbral_por_defecto(self) -> float:
        """Umbral entre 0 y 1 (0.3 si falta o no es válido)."""
        umbral = self.__datos.get("umbralPorDefecto")
        # bool es un tipo de int en Python; lo excluimos a propósito.
        if not isinstance(umbral, (int, float)) or isinstance(umbral, bool):
            return Configuracion.UMBRAL_POR_DEFECTO
        if math.isnan(umbral):
            return Configuracion.UMBRAL_POR_DEFECTO
        if umbral < 0 or umbral > 1:
            return Configuracion.UMBRAL_POR_DEFECTO
        return umbral

    def get_max_nodos(self) -> int:
        """Número entero mayor que 0 (150 si falta o no es válido)."""
        maximo = self.__datos.get("maxNodos")
        if not isinstance(maximo, int) or isinstance(maximo, bool) or maximo < 1:
            return Configuracion.MAX_NODOS_POR_DEFECTO
        return maximo

    def get_entidad_inicial(self) -> str:
        """Id de la entidad que se muestra al empezar ("" si no hay)."""
        return self.__leer_texto("entidadInicial", Configuracion.ENTIDAD_INICIAL_POR_DEFECTO)

    def __leer_texto(self, nombre_del_campo: str, valor_por_defecto: str) -> str:
        """(Privado) Lee un campo de texto; si no es un texto, devuelve el
        valor por defecto.
        """
        valor = self.__datos.get(nombre_del_campo)
        if not isinstance(valor, str):
            return valor_por_defecto
        return valor
