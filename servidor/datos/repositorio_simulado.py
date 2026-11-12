"""RepositorioSimulado (traducción de src/datos/RepositorioSimulado.js del incremento 1)."""
import asyncio
import math
from typing import Any

from servidor.datos.fabrica_entidades import FabricaEntidades
from servidor.datos.repositorio_datos import RepositorioDatos
from servidor.modelo.entidad import Entidad
from servidor.modelo.relacion import Relacion
from servidor.modelo.tipo_entidad import TipoEntidad
from servidor.modelo.tipo_relacion import TipoRelacion
from servidor.modelo.vecindario import Vecindario


class RepositorioSimulado(RepositorioDatos):
    """Repositorio que lee datos de ejemplo guardados en memoria en lugar de la
    base de datos real. Puede simular la espera de la red con un pequeño
    retardo, para que la aplicación se comporte como lo hará con la BD real.

    Formato de los datos (ver servidor/datos/datos_ejemplo.json):
      {
        "entidades": [ { "id", "tipo", "nombre", "descripcion", ...campos propios } ],
        "relaciones": [ [id, idOrigen, idDestino, idTipoRelacion, valor] ]
      }

    Requisitos: RNF-17; RF-39 (descubre los tipos de relación de los datos).
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
        self.__relaciones_por_entidad = self.__indexar_relaciones()

    async def buscar_entidades(self, texto: str, tipo: TipoEntidad | None,
                               limite: int | None) -> list[Entidad]:
        """Búsqueda simple: nombres que contienen el texto, sin distinguir
        mayúsculas. texto "" devuelve todas (así la usa /api/nombres).
        La búsqueda tolerante a erratas la hace el navegador (Buscador.js).
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
        # Se busca en el índice (ver __indexar_relaciones) en lugar de recorrer
        # todas las relaciones. Se devuelve una copia de la lista para que
        # quien la reciba no pueda cambiar el índice sin querer.
        relaciones_de_la_entidad = []
        if id_entidad in self.__relaciones_por_entidad:
            for relacion in self.__relaciones_por_entidad[id_entidad]:
                relaciones_de_la_entidad.append(relacion)
        return relaciones_de_la_entidad

    async def obtener_tipos_relacion(self) -> list[TipoRelacion]:
        """Tipos descubiertos, en orden de aparición."""
        await self.__esperar()
        lista_de_tipos = []
        for tipo in self.__tipos.values():
            lista_de_tipos.append(tipo)
        return lista_de_tipos

    async def obtener_vecindario(self, id_entidad: str, umbral: float, max_entidades: int) -> Vecindario:
        """Recorrido EN ANCHURA desde la entidad: primero sus vecinos, después
        los vecinos de sus vecinos, etc. Solo se siguen las relaciones cuyo
        valor supera el umbral, en los dos sentidos. Se para cuando no quedan
        entidades por visitar o cuando se llega a max_entidades (entonces el
        vecindario sale "recortado").

        ¿Por qué el vecindario contiene SEGURO todo lo que necesita el navegador?
          La relevancia de un nodo es el producto de las relevancias de las
          relaciones de su camino, y todas están entre 0 y 1. Un producto de
          números entre 0 y 1 nunca es mayor que ninguno de sus factores
          (multiplicar por algo ≤ 1 no hace crecer). Por tanto, si un nodo
          supera el umbral, TODAS las relaciones de su camino lo superan
          también, y este recorrido, que sigue todas las relaciones que
          superan el umbral, pasa por ese camino. Ejemplo con umbral 0,3: un
          nodo con relevancia 0,9 × 0,5 = 0,45 se alcanza por dos relaciones
          de 0,9 y 0,5, las dos mayores que 0,3.
          Lo contrario no es cierto: puede haber entidades en el vecindario
          que luego no superan el umbral (0,5 × 0,5 = 0,25). Esas las
          descarta el navegador al construir el subgrafo.

        Las entidades y relaciones se devuelven en el MISMO orden que en los
        datos. Así, si dos candidatos empatan en relevancia, el navegador los
        desempata igual que lo hacía el servidor en el incremento 2.

        Lanza ValueError si la entidad no existe.
        """
        await self.__esperar()
        if id_entidad not in self.__entidades:
            raise ValueError("No existe ninguna entidad con el id \"" + id_entidad + "\".")

        # ids de las entidades encontradas y de las relaciones que superan el umbral.
        ids_encontrados: set[str] = set()
        ids_de_relaciones: set[str] = set()
        ids_encontrados.add(id_entidad)
        recortado = False

        # Cola del recorrido en anchura: se van añadiendo al final y se
        # visitan en el orden en que entraron (posicion avanza de uno en uno).
        cola = [id_entidad]
        posicion = 0
        while posicion < len(cola):
            id_actual = cola[posicion]
            posicion = posicion + 1
            entidad_actual = self.__entidades[id_actual]
            for relacion in self.__relaciones_de(id_actual):
                if self.__supera_el_umbral(relacion.get_valor(), umbral):
                    ids_de_relaciones.add(relacion.get_id())
                    id_vecino = relacion.get_otro_extremo(entidad_actual).get_id()
                    if id_vecino not in ids_encontrados:
                        if len(ids_encontrados) < max_entidades:
                            ids_encontrados.add(id_vecino)
                            cola.append(id_vecino)
                        else:
                            # No cabe: el vecindario queda incompleto. Se sigue
                            # recorriendo la cola (sin añadir entidades) para
                            # recoger las relaciones entre las que sí están.
                            recortado = True

        return Vecindario(self.__entidades_en_orden(ids_encontrados),
                          self.__relaciones_en_orden(ids_de_relaciones, ids_encontrados),
                          recortado)

    def __relaciones_de(self, id_entidad: str) -> list[Relacion]:
        """(Privado) Relaciones de la entidad según el índice (sin copiarlas)."""
        if id_entidad in self.__relaciones_por_entidad:
            return self.__relaciones_por_entidad[id_entidad]
        return []

    @staticmethod
    def __supera_el_umbral(valor: Any, umbral: float) -> bool:
        """(Privado) ¿El valor de la relación es un número mayor que el umbral?
        Un valor que no es un número nunca lo supera (igual que en
        RelevanciaDesdeBD del navegador, que le da relevancia 0).
        """
        # bool es un tipo de int en Python; lo excluimos a propósito.
        if not isinstance(valor, (int, float)) or isinstance(valor, bool):
            return False
        if math.isnan(valor):
            return False
        return valor > umbral

    def __entidades_en_orden(self, ids_encontrados: set[str]) -> list[Entidad]:
        """(Privado) Las entidades encontradas, en el orden de los datos."""
        entidades = []
        for entidad in self.__entidades.values():
            if entidad.get_id() in ids_encontrados:
                entidades.append(entidad)
        return entidades

    def __relaciones_en_orden(self, ids_de_relaciones: set[str], ids_encontrados: set[str]) -> list[Relacion]:
        """(Privado) Las relaciones encontradas, en el orden de los datos.
        Solo las que unen dos entidades del vecindario (si el vecindario está
        recortado, alguna relación puede apuntar a una entidad que no cabía).
        """
        relaciones = []
        for relacion in self.__relaciones:
            if relacion.get_id() in ids_de_relaciones:
                origen_dentro = relacion.get_origen().get_id() in ids_encontrados
                destino_dentro = relacion.get_destino().get_id() in ids_encontrados
                if origen_dentro and destino_dentro:
                    relaciones.append(relacion)
        return relaciones

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
        en las relaciones (sin repetir, en orden de aparición). El nombre
        legible y el color los pone el navegador.
        """
        tipos: dict[str, TipoRelacion] = {}
        for fila in lista_de_relaciones:
            id_tipo = fila[3]
            if id_tipo not in tipos:
                tipos[id_tipo] = TipoRelacion(id_tipo)
        return tipos

    def __cargar_relaciones(self, lista_de_relaciones: list[list[Any]]) -> list[Relacion]:
        """(Privado) Convierte cada fila [id, origen, destino, tipo, valor] en una Relacion."""
        relaciones = []
        for fila in lista_de_relaciones:
            relaciones.append(self.__crear_relacion_desde_fila(fila))
        return relaciones

    def __indexar_relaciones(self) -> dict[str, list[Relacion]]:
        """(Privado) Índice idEntidad → relaciones en las que participa (como
        origen o como destino), en el orden de los datos.

        Se prepara UNA vez al crear el repositorio. Sin él, obtener_relaciones
        tendría que recorrer todas las relaciones cada vez que se expande un
        nodo: con 1036 relaciones y 150 nodos son unas 150.000 comparaciones
        por subgrafo, y era el 80 % del tiempo de cada petición. Con el índice,
        encontrar las relaciones de una entidad es inmediato. (La base de datos
        real hará lo mismo con sus propios índices.)
        """
        relaciones_por_entidad: dict[str, list[Relacion]] = {}
        for relacion in self.__relaciones:
            id_origen = relacion.get_origen().get_id()
            id_destino = relacion.get_destino().get_id()
            if id_origen not in relaciones_por_entidad:
                relaciones_por_entidad[id_origen] = []
            relaciones_por_entidad[id_origen].append(relacion)
            # Una relación de una entidad consigo misma solo se apunta una vez.
            if id_destino != id_origen:
                if id_destino not in relaciones_por_entidad:
                    relaciones_por_entidad[id_destino] = []
                relaciones_por_entidad[id_destino].append(relacion)
        return relaciones_por_entidad

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
