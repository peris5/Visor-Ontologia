"""RepositorioSimulado (traducción de src/datos/RepositorioSimulado.js)."""
import asyncio
from typing import Any

from servidor.datos.fabrica_entidades import FabricaEntidades
from servidor.datos.repositorio_datos import RepositorioDatos
from servidor.logica.paleta_colores import PaletaColores
from servidor.modelo.entidad import Entidad
from servidor.modelo.relacion import Relacion
from servidor.modelo.tipo_entidad import TipoEntidad
from servidor.modelo.tipo_relacion import TipoRelacion


class RepositorioSimulado(RepositorioDatos):
    """Repositorio que lee datos de ejemplo guardados en memoria en lugar de la
    base de datos real. Puede simular la espera de la red con un pequeño
    retardo, para que la aplicación se comporte como lo hará con la BD real.

    Formato de los datos (ver servidor/datos/datos_ejemplo.json):
      {
        "entidades": [ { "id", "tipo", "nombre", "descripcion", ...campos propios } ],
        "relaciones": [ [id, idOrigen, idDestino, idTipoRelacion, valor] ]
      }

    Requisitos: RNF-17; RF-20 y RF-39 (descubre los tipos y les da color).
    """

    def __init__(self, datos: dict[str, Any], retardo_ms: float) -> None:
        """datos: con el formato de arriba. retardo_ms: milisegundos de espera
        simulada (0 en las pruebas).
        """
        if datos is None:
            raise ValueError("El repositorio simulado necesita unos datos.")
        if not isinstance(datos.get("entidades"), list) or not isinstance(datos.get("relaciones"), list):
            raise ValueError("Los datos deben tener una lista 'entidades' y una lista 'relaciones'.")

        self.__retardo_ms = 0.0
        if isinstance(retardo_ms, (int, float)) and retardo_ms > 0:
            self.__retardo_ms = retardo_ms

        # El orden importa: las relaciones necesitan las entidades y los tipos.
        self.__entidades = self.__cargar_entidades(datos["entidades"])
        self.__tipos = self.__descubrir_tipos(datos["relaciones"])
        self.__relaciones = self.__cargar_relaciones(datos["relaciones"])

    async def buscar_entidades(self, texto: str, tipo: TipoEntidad | None,
                               limite: int | None) -> list[Entidad]:
        """Búsqueda simple: nombres que contienen el texto, sin distinguir
        mayúsculas. (Actualizar en el incremento 3.)
        texto "" devuelve todas.
        """
        await self.__esperar()

        texto_en_minusculas = ""
        if isinstance(texto, str):
            texto_en_minusculas = texto.lower()
        hay_limite = False
        if isinstance(limite, int) and limite > 0:
            hay_limite = True

        resultados = []
        for entidad in self.__entidades.values():
            if hay_limite and len(resultados) >= limite:
                break
            if self.__cumple_la_busqueda(entidad, texto_en_minusculas, tipo):
                resultados.append(entidad)
        return resultados

    async def obtener_entidad(self, identificador: str) -> Entidad | None:
        """La entidad, o None si no existe."""
        await self.__esperar()
        if identificador in self.__entidades:
            return self.__entidades[identificador]
        return None

    async def obtener_relaciones(self, id_entidad: str) -> list[Relacion]:
        """Relaciones donde la entidad es el origen O el destino (el grafo se
        recorre en los dos sentidos). Lista vacía si la entidad no existe.
        """
        await self.__esperar()
        relaciones_de_la_entidad = []
        for relacion in self.__relaciones:
            es_el_origen = relacion.get_origen().get_id() == id_entidad
            es_el_destino = relacion.get_destino().get_id() == id_entidad
            if es_el_origen or es_el_destino:
                relaciones_de_la_entidad.append(relacion)
        return relaciones_de_la_entidad

    async def obtener_tipos_relacion(self) -> list[TipoRelacion]:
        """Tipos descubiertos, en orden de aparición."""
        await self.__esperar()
        lista_de_tipos = []
        for tipo in self.__tipos.values():
            lista_de_tipos.append(tipo)
        return lista_de_tipos

    async def __esperar(self) -> None:
        """(Privado) Simula la latencia de la red esperando retardo_ms milisegundos."""
        await asyncio.sleep(self.__retardo_ms / 1000)

    def __cumple_la_busqueda(self, entidad: Entidad, texto_en_minusculas: str,
                             tipo: TipoEntidad | None) -> bool:
        """(Privado) ¿La entidad cumple el tipo y contiene el texto en su nombre?"""
        if tipo is not None and entidad.get_tipo() != tipo:
            return False
        nombre_en_minusculas = entidad.get_nombre().lower()
        return texto_en_minusculas in nombre_en_minusculas

    def __cargar_entidades(self, lista_de_datos: list[dict[str, Any]]) -> dict[str, Entidad]:
        """(Privado) Crea las entidades con la fábrica y las guarda por id."""
        entidades: dict[str, Entidad] = {}
        for datos_de_la_entidad in lista_de_datos:
            entidad = FabricaEntidades.crear_entidad(datos_de_la_entidad.get("tipo"), datos_de_la_entidad)
            if entidad.get_id() in entidades:
                raise ValueError("Hay dos entidades con el mismo id: " + entidad.get_id() + ".")
            entidades[entidad.get_id()] = entidad
        return entidades

    def __descubrir_tipos(self, lista_de_relaciones: list[list[Any]]) -> dict[str, TipoRelacion]:
        """(Privado) Descubre los tipos de relación mirando qué tipos aparecen
        en las relaciones. El nombre sale del id y el color de la paleta.
        """
        # Paso 1: lista de ids de tipo sin repetir, en orden de aparición.
        ids_de_tipos = []
        for fila in lista_de_relaciones:
            id_tipo = fila[3]
            if id_tipo not in ids_de_tipos:
                ids_de_tipos.append(id_tipo)

        # Paso 2: un color para cada uno y el objeto TipoRelacion.
        colores_por_id = PaletaColores.asignar(ids_de_tipos)
        tipos: dict[str, TipoRelacion] = {}
        for id_tipo in ids_de_tipos:
            nombre = TipoRelacion.nombre_desde_id(id_tipo)
            color = colores_por_id[id_tipo]
            tipos[id_tipo] = TipoRelacion(id_tipo, nombre, color)
        return tipos

    def __cargar_relaciones(self, lista_de_relaciones: list[list[Any]]) -> list[Relacion]:
        """(Privado) Convierte cada fila [id, origen, destino, tipo, valor] en una Relacion."""
        relaciones = []
        for fila in lista_de_relaciones:
            relaciones.append(self.__crear_relacion_desde_fila(fila))
        return relaciones

    def __crear_relacion_desde_fila(self, fila: list[Any]) -> Relacion:
        """(Privado) Crea una Relacion a partir de una fila, comprobando que
        sus entidades existen.
        """
        if not isinstance(fila, list) or len(fila) != 5:
            raise ValueError("Cada relación debe ser una lista [id, origen, destino, tipo, valor].")
        id_relacion = fila[0]
        id_origen = fila[1]
        id_destino = fila[2]
        id_tipo = fila[3]
        valor = fila[4]

        if id_origen not in self.__entidades:
            raise ValueError("La relación " + id_relacion + " usa una entidad que no existe: " + id_origen + ".")
        if id_destino not in self.__entidades:
            raise ValueError("La relación " + id_relacion + " usa una entidad que no existe: " + id_destino + ".")
        origen = self.__entidades[id_origen]
        destino = self.__entidades[id_destino]
        tipo = self.__tipos[id_tipo]
        return Relacion(id_relacion, origen, destino, tipo, valor)
