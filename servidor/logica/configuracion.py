"""Configuracion (traducción de src/logica/Configuracion.js, ampliada)."""
import json
import math
from pathlib import Path
from typing import Any


class Configuracion:
    """Lee los ajustes del servidor (el archivo servidor/configuracion.json).

    Los ajustes sencillos (umbral, máximos, entidad inicial...) tienen un
    valor por defecto si faltan o no son válidos. Los que describen la base
    de datos (clasificación de etiquetas, pesos, nombres de los tipos...) no
    se pueden inventar: comprobar() los revisa al arrancar y, si falta
    alguno, el servidor no arranca y dice cuál falta.

    IMPORTANTE: cuando haya base de datos real (incremento 4), su usuario y
    su contraseña NO irán en configuracion.json (que se sube a Git), sino en
    variables de entorno (por ejemplo, en un archivo .env que Git ignora).

    Requisitos: RNF-16.
    """

    # Papeles que puede tener un nodo auxiliar (ver papelesAuxiliares).
    PAPELES_AUXILIARES = ["periodo", "lugar", "imagen", "fuente"]

    ORIGEN_POR_DEFECTO = "simulado"
    URL_POR_DEFECTO = ""
    UMBRAL_POR_DEFECTO = 0.3
    MAX_NODOS_POR_DEFECTO = 150
    ENTIDAD_INICIAL_POR_DEFECTO = ""
    MAX_ENTIDADES_VECINDARIO_POR_DEFECTO = 2000

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
        es un JSON válido.
        """
        with open(ruta, encoding="utf-8") as archivo:
            datos = json.load(archivo)
        self.cargar(datos)

    def comprobar(self) -> None:
        """Comprueba que están todos los ajustes que describen la base de
        datos (ANALISIS_BD_NEO4J.md §3.1 y §4.3). Si falta alguno o no tiene
        la forma esperada, lanza ValueError con la lista de problemas.
        """
        problemas: list[str] = []
        self.__comprobar_diccionario("etiquetasEntidad", problemas)
        self.__comprobar_lista("etiquetasAuxiliares", problemas)
        self.__comprobar_diccionario("papelesAuxiliares", problemas)
        self.__comprobar_lista("tiposSinRelacion", problemas)
        self.__comprobar_lista("relacionesIgnoradas", problemas)
        self.__comprobar_entero_positivo("maxParticipantesIntermediario", problemas)
        self.__comprobar_diccionario("pesosRelevancia", problemas)
        self.__comprobar_numero_entre_0_y_1("pesoPorDefecto", problemas)
        self.__comprobar_entero_positivo("versionPesos", problemas)
        self.__comprobar_texto("idioma", problemas)
        self.__comprobar_diccionario("nombresTipos", problemas)

        # Estas dos solo se pueden mirar si lo anterior está bien.
        if len(problemas) == 0:
            self.__comprobar_papeles(problemas)
            self.__comprobar_pesos(problemas)
        if len(problemas) > 0:
            raise ValueError("La configuración (servidor/configuracion.json) no está completa: "
                             + "; ".join(problemas) + ".")

    def get_origen_datos(self) -> str:
        """"simulado" o el origen indicado."""
        return self.__leer_texto("origenDatos", Configuracion.ORIGEN_POR_DEFECTO)

    def get_url_servicio(self) -> str:
        """Dirección del servicio de la BD real."""
        return self.__leer_texto("urlServicio", Configuracion.URL_POR_DEFECTO)

    def get_umbral_por_defecto(self) -> float:
        """Umbral entre 0 y 1 (0.3 si falta o no es válido)."""
        umbral = self.__datos.get("umbralPorDefecto")
        if not Configuracion.__es_numero_entre_0_y_1(umbral):
            return Configuracion.UMBRAL_POR_DEFECTO
        return umbral

    def get_max_nodos(self) -> int:
        """Número entero mayor que 0 (150 si falta o no es válido)."""
        maximo = self.__datos.get("maxNodos")
        if not isinstance(maximo, int) or isinstance(maximo, bool) or maximo < 1:
            return Configuracion.MAX_NODOS_POR_DEFECTO
        return maximo

    def get_max_entidades_vecindario(self) -> int:
        """Máximo de entidades de un vecindario (2000 si falta o no es válido).
        Lo fija solo el servidor, para que nadie pueda pedir la base de datos
        entera (RNF-13).
        """
        maximo = self.__datos.get("maxEntidadesVecindario")
        if not isinstance(maximo, int) or isinstance(maximo, bool) or maximo < 1:
            return Configuracion.MAX_ENTIDADES_VECINDARIO_POR_DEFECTO
        return maximo

    def get_entidad_inicial(self) -> str:
        """Id de la entidad que se muestra al empezar ("" si no hay)."""
        return self.__leer_texto("entidadInicial", Configuracion.ENTIDAD_INICIAL_POR_DEFECTO)

    # Los siguientes solo se pueden usar después de comprobar().

    def get_idioma(self) -> str:
        """Idioma en que se muestran los nombres ("es", "ca" o "en")."""
        return self.__datos["idioma"]

    def get_etiquetas_entidad(self) -> dict[str, str]:
        """Etiqueta de Neo4j → TipoEntidad ("Person" → "PERSONA")."""
        return self.__datos["etiquetasEntidad"]

    def get_etiquetas_auxiliares(self) -> list[str]:
        """Etiquetas de los nodos auxiliares (periodo, lugar, imagen, fuente)."""
        return self.__datos["etiquetasAuxiliares"]

    def get_papeles_auxiliares(self) -> dict[str, str]:
        """Etiqueta auxiliar → su papel ("Period" → "periodo")."""
        return self.__datos["papelesAuxiliares"]

    def get_tipos_sin_relacion(self) -> list[str]:
        """Intermediarios que no crean relaciones (nacimiento, muerte, residencia)."""
        return self.__datos["tiposSinRelacion"]

    def get_relaciones_ignoradas(self) -> list[str]:
        """Tipos de relación de Neo4j que no cuentan para derivar relaciones."""
        return self.__datos["relacionesIgnoradas"]

    def get_max_participantes_intermediario(self) -> int:
        """Un intermediario con más entidades que esto no crea relaciones."""
        return self.__datos["maxParticipantesIntermediario"]

    def get_pesos_relevancia(self) -> dict[str, float]:
        """Tipo → peso (relevancia) para RelevanciaPorTipo."""
        return self.__datos["pesosRelevancia"]

    def get_peso_por_defecto(self) -> float:
        """Peso de un tipo sin peso propio ni padre con peso."""
        return self.__datos["pesoPorDefecto"]

    def get_version_pesos(self) -> int:
        """Versión de la tabla de pesos (se sube al cambiar un peso)."""
        return self.__datos["versionPesos"]

    def get_nombres_tipos(self) -> dict[str, str]:
        """Tipo → nombre en castellano ("Marriage" → "Matrimonio")."""
        return self.__datos["nombresTipos"]

    def __leer_texto(self, nombre_del_campo: str, valor_por_defecto: str) -> str:
        """(Privado) Lee un campo de texto; si no es un texto, devuelve el
        valor por defecto.
        """
        valor = self.__datos.get(nombre_del_campo)
        if not isinstance(valor, str):
            return valor_por_defecto
        return valor

    def __comprobar_diccionario(self, nombre: str, problemas: list[str]) -> None:
        """(Privado) El ajuste tiene que ser un objeto con algún elemento."""
        valor = self.__datos.get(nombre)
        if not isinstance(valor, dict) or len(valor) == 0:
            problemas.append("falta '" + nombre + "' (un objeto)")

    def __comprobar_lista(self, nombre: str, problemas: list[str]) -> None:
        """(Privado) El ajuste tiene que ser una lista de textos."""
        valor = self.__datos.get(nombre)
        if not isinstance(valor, list):
            problemas.append("falta '" + nombre + "' (una lista)")
            return
        for elemento in valor:
            if not isinstance(elemento, str):
                problemas.append("'" + nombre + "' solo puede tener textos")
                return

    def __comprobar_entero_positivo(self, nombre: str, problemas: list[str]) -> None:
        """(Privado) El ajuste tiene que ser un número entero mayor que 0."""
        valor = self.__datos.get(nombre)
        if not isinstance(valor, int) or isinstance(valor, bool) or valor < 1:
            problemas.append("falta '" + nombre + "' (un número entero mayor que 0)")

    def __comprobar_numero_entre_0_y_1(self, nombre: str, problemas: list[str]) -> None:
        """(Privado) El ajuste tiene que ser un número entre 0 y 1."""
        if not Configuracion.__es_numero_entre_0_y_1(self.__datos.get(nombre)):
            problemas.append("falta '" + nombre + "' (un número entre 0 y 1)")

    def __comprobar_texto(self, nombre: str, problemas: list[str]) -> None:
        """(Privado) El ajuste tiene que ser un texto no vacío."""
        valor = self.__datos.get(nombre)
        if not isinstance(valor, str) or valor == "":
            problemas.append("falta '" + nombre + "' (un texto)")

    def __comprobar_papeles(self, problemas: list[str]) -> None:
        """(Privado) Cada auxiliar de papelesAuxiliares está en
        etiquetasAuxiliares y tiene un papel conocido, y cada papel tiene
        alguna etiqueta.
        """
        papeles = self.__datos["papelesAuxiliares"]
        auxiliares = self.__datos["etiquetasAuxiliares"]
        for etiqueta in papeles:
            if etiqueta not in auxiliares:
                problemas.append("'" + etiqueta + "' está en papelesAuxiliares pero no en etiquetasAuxiliares")
            if papeles[etiqueta] not in Configuracion.PAPELES_AUXILIARES:
                problemas.append("el papel '" + str(papeles[etiqueta]) + "' no existe")
        for papel in Configuracion.PAPELES_AUXILIARES:
            encontrado = False
            for etiqueta in papeles:
                if papeles[etiqueta] == papel:
                    encontrado = True
            if not encontrado:
                problemas.append("ninguna etiqueta tiene el papel '" + papel + "' en papelesAuxiliares")

    def __comprobar_pesos(self, problemas: list[str]) -> None:
        """(Privado) Todos los pesos tienen que estar entre 0 y 1."""
        pesos = self.__datos["pesosRelevancia"]
        for tipo in pesos:
            if not Configuracion.__es_numero_entre_0_y_1(pesos[tipo]):
                problemas.append("el peso de '" + tipo + "' no está entre 0 y 1")

    @staticmethod
    def __es_numero_entre_0_y_1(valor: Any) -> bool:
        """(Privado) ¿Es un número (no bool, no NaN) entre 0 y 1?
        (bool es un tipo de int en Python; lo excluimos a propósito.)
        """
        if not isinstance(valor, (int, float)) or isinstance(valor, bool):
            return False
        if math.isnan(valor):
            return False
        return valor >= 0 and valor <= 1
