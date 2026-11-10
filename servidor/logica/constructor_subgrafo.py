"""ConstructorSubgrafo (traducción de src/logica/ConstructorSubgrafo.js)."""
import math
from typing import Any

from servidor.datos.repositorio_datos import RepositorioDatos
from servidor.logica.calculador_centralidad import CalculadorCentralidad
from servidor.logica.estrategia_relevancia import EstrategiaRelevancia
from servidor.modelo.nodo_relevante import NodoRelevante
from servidor.modelo.relacion import Relacion
from servidor.modelo.subgrafo import Subgrafo


class ConstructorSubgrafo:
    """Construye el entorno relevante (Subgrafo) de una entidad con una
    búsqueda «primero el mejor»: siempre se trata antes el candidato
    pendiente de mayor relevancia.

    Relaciones con otras clases:
     - usa un RepositorioDatos para leer entidades y relaciones;
     - usa una EstrategiaRelevancia para calcular las relevancias;
     - tiene (composición) un CalculadorCentralidad propio;
     - crea el Subgrafo que devuelve.

    ─────────────────────────────────────────────────────────────────────────
    ¿Por qué «primero el mejor» da a cada nodo su MEJOR relevancia posible?

      1. La relevancia de un nodo es el producto de las relevancias de las
         relaciones del camino. Todas valen entre 0 y 1, y multiplicar por un
         número menor o igual que 1 nunca hace crecer el resultado. Por tanto,
         a lo largo de un camino la relevancia NUNCA crece.

      2. Un nodo NO entra en el subgrafo cuando se descubre, sino cuando sale
         de la lista de pendientes como el candidato más relevante de todos.

      3. Supongamos que el nodo V sale de pendientes con relevancia R. Cualquier
         otro camino hacia V todavía sin explorar tiene que pasar por algún
         candidato que sigue pendiente, y ese candidato tiene relevancia ≤ R
         (si no, habría salido antes que V). Por el punto 1, seguir ese camino
         hasta V solo puede dar una relevancia ≤ R. Luego R ya es la mejor.

      Ejemplo: Central→V vale 0,4 y Central→Y→V vale 0,9 × 0,9 = 0,81.
      Al expandir la Central, V queda pendiente con 0,4 e Y con 0,9.
      Sale Y (0,9), se expande y V vuelve a quedar pendiente, ahora con 0,81.
      Sale V con 0,81, su mejor valor. Cuando más tarde salga la copia con 0,4,
      se descarta porque V ya está dentro.

      Consecuencia: los nodos entran en orden de relevancia de mayor a menor.
      Por eso, si paramos al llegar a max_nodos, nos quedamos justo con los
      más relevantes.
    ─────────────────────────────────────────────────────────────────────────

    Requisitos: RF-08, RF-09, RF-10, RF-11, RF-12; RF-37 (centralidad); RNF-30.
    """

    UMBRAL_POR_DEFECTO = 0.3
    MAX_NODOS_POR_DEFECTO = 150

    def __init__(self, repositorio: RepositorioDatos, estrategia: EstrategiaRelevancia,
                 umbral: float | None = None, max_nodos: int | None = None) -> None:
        """umbral: opcional; 0.3 si no se indica. max_nodos: opcional; 150 si no se indica."""
        if not isinstance(repositorio, RepositorioDatos):
            raise ValueError("ConstructorSubgrafo necesita un RepositorioDatos.")
        if not isinstance(estrategia, EstrategiaRelevancia):
            raise ValueError("ConstructorSubgrafo necesita una EstrategiaRelevancia.")
        self.__repositorio = repositorio
        self.__estrategia = estrategia
        # Composición: el calculador nace y muere con este constructor.
        self.__centralidad = CalculadorCentralidad()

        self.__umbral = ConstructorSubgrafo.UMBRAL_POR_DEFECTO
        if umbral is not None:
            self.set_umbral(umbral)

        self.__max_nodos = ConstructorSubgrafo.MAX_NODOS_POR_DEFECTO
        if max_nodos is not None:
            if not isinstance(max_nodos, int) or isinstance(max_nodos, bool) or max_nodos < 1:
                raise ValueError("El máximo de nodos debe ser un número entero mayor que 0.")
            self.__max_nodos = max_nodos

    def set_umbral(self, valor: Any) -> None:
        """valor: umbral entre 0 y 1."""
        # bool es un tipo de int en Python; lo excluimos a propósito.
        if not isinstance(valor, (int, float)) or isinstance(valor, bool):
            raise ValueError("El umbral debe ser un número.")
        if math.isnan(valor):
            raise ValueError("El umbral debe ser un número.")
        if valor < 0 or valor > 1:
            raise ValueError("El umbral debe estar entre 0 y 1 (se ha recibido " + str(valor) + ").")
        self.__umbral = valor

    def get_umbral(self) -> float:
        """Umbral actual."""
        return self.__umbral

    async def construir(self, id_entidad: str) -> Subgrafo:
        """Construye el subgrafo relevante de una entidad (id de la entidad central)."""
        # Copiamos el umbral al empezar: si alguien lo cambia mientras esperamos
        # al repositorio, este subgrafo se termina con el umbral con el que empezó.
        umbral = self.__umbral

        entidad_central = await self.__repositorio.obtener_entidad(id_entidad)
        if entidad_central is None:
            raise ValueError("No existe ninguna entidad con el id \"" + id_entidad + "\".")

        # Paso 1: el subgrafo nace con la central (relevancia 1, nivel 0).
        subgrafo = Subgrafo(entidad_central, umbral)
        nodo_central = subgrafo.get_nodo(entidad_central.get_id())

        # Paso 2: los vecinos de la central son los primeros candidatos pendientes.
        pendientes = await self.__expandir(nodo_central, subgrafo, umbral)

        # Paso 3: búsqueda «primero el mejor» (ver la explicación de arriba).
        while len(pendientes) > 0 and subgrafo.get_numero_nodos() < self.__max_nodos:
            candidato = self.__sacar_el_mas_relevante(pendientes)
            id_candidato = candidato.get_entidad().get_id()

            # Un mismo vecino puede estar varias veces en pendientes (una por cada
            # camino por el que se descubrió). La primera copia que sale es la
            # mejor; las demás se descartan aquí.
            if not subgrafo.contiene_entidad(id_candidato):
                subgrafo.agregar_nodo(candidato)
                nuevos_candidatos = await self.__expandir(candidato, subgrafo, umbral)
                self.__anadir_candidatos(pendientes, nuevos_candidatos)

        # Paso 4: red de seguridad para no pasar nunca de max_nodos.
        self.__podar(subgrafo)

        # Paso 5: con el subgrafo terminado, calculamos la centralidad.
        self.__guardar_centralidad(subgrafo)
        return subgrafo

    async def __expandir(self, nodo: NodoRelevante, subgrafo: Subgrafo, umbral: float) -> list[NodoRelevante]:
        """(Privado) Expande un nodo que ya está en el subgrafo:
         - pide sus relaciones y calcula la relevancia de cada una;
         - descarta las que no superan el umbral;
         - si el vecino ya está en el subgrafo, añade la relación (así se guardan
           todas las relaciones de un mismo par, no solo la mejor);
         - si el vecino no está, se queda con la mejor relación hacia él y lo
           devuelve como candidato si su relevancia supera el umbral.

        Devuelve los candidatos nuevos (aún NO están en el subgrafo).
        """
        entidad_del_nodo = nodo.get_entidad()
        relaciones = await self.__repositorio.obtener_relaciones(entidad_del_nodo.get_id())

        # idVecino → la relación más relevante hacia ese vecino.
        mejor_relacion_por_vecino: dict[str, Relacion] = {}

        for relacion in relaciones:
            relevancia_de_la_relacion = self.__estrategia.calcular_relevancia_relacion(relacion)
            relacion.set_relevancia(relevancia_de_la_relacion)

            vecino = relacion.get_otro_extremo(entidad_del_nodo)
            es_una_relacion_consigo_mismo = vecino.get_id() == entidad_del_nodo.get_id()

            if relevancia_de_la_relacion > umbral and not es_una_relacion_consigo_mismo:
                if subgrafo.contiene_entidad(vecino.get_id()):
                    subgrafo.agregar_relacion(relacion)
                else:
                    self.__guardar_si_es_mejor(mejor_relacion_por_vecino, vecino.get_id(), relacion)

        return self.__crear_candidatos(nodo, mejor_relacion_por_vecino, umbral)

    def __guardar_si_es_mejor(self, mejor_relacion_por_vecino: dict[str, Relacion],
                              id_vecino: str, relacion: Relacion) -> None:
        """(Privado) Guarda la relación para ese vecino si no había ninguna o
        si es más relevante que la guardada. Entre dos entidades puede haber
        varias relaciones: para decidir si el vecino entra se usa la mejor.
        """
        if id_vecino not in mejor_relacion_por_vecino:
            mejor_relacion_por_vecino[id_vecino] = relacion
            return
        relacion_guardada = mejor_relacion_por_vecino[id_vecino]
        if relacion.get_relevancia() > relacion_guardada.get_relevancia():
            mejor_relacion_por_vecino[id_vecino] = relacion

    def __crear_candidatos(self, nodo_padre: NodoRelevante, mejor_relacion_por_vecino: dict[str, Relacion],
                           umbral: float) -> list[NodoRelevante]:
        """(Privado) Convierte cada vecino en un candidato (NodoRelevante) con
        relevancia = relevancia del padre × mejor relación, y
        nivel = nivel del padre + 1. Solo devuelve los que superan el umbral.
        """
        candidatos = []
        entidad_del_padre = nodo_padre.get_entidad()
        nivel_del_vecino = nodo_padre.get_nivel() + 1

        for mejor_relacion in mejor_relacion_por_vecino.values():
            vecino = mejor_relacion.get_otro_extremo(entidad_del_padre)
            relevancia_del_vecino = self.__estrategia.calcular_relevancia_nodo(
                nodo_padre.get_relevancia(), mejor_relacion.get_relevancia())
            if relevancia_del_vecino > umbral:
                candidatos.append(NodoRelevante(vecino, relevancia_del_vecino, nivel_del_vecino))
        return candidatos

    def __sacar_el_mas_relevante(self, pendientes: list[NodoRelevante]) -> NodoRelevante:
        """(Privado) Saca de la lista el candidato de mayor relevancia.
        Recorremos la lista buscando el mayor (más fácil de entender que
        mantenerla ordenada). Si hay empate, gana el primero que se añadió.
        La lista se modifica: el elegido se quita.
        """
        posicion_del_mejor = 0
        for i in range(1, len(pendientes)):
            if pendientes[i].get_relevancia() > pendientes[posicion_del_mejor].get_relevancia():
                posicion_del_mejor = i
        el_mejor = pendientes[posicion_del_mejor]
        del pendientes[posicion_del_mejor]
        return el_mejor

    def __anadir_candidatos(self, pendientes: list[NodoRelevante], nuevos_candidatos: list[NodoRelevante]) -> None:
        """(Privado) Añade los candidatos nuevos al final de la lista de pendientes."""
        for candidato in nuevos_candidatos:
            pendientes.append(candidato)

    def __podar(self, subgrafo: Subgrafo) -> None:
        """(Privado) Garantiza que el subgrafo no pasa de max_nodos quitando
        los nodos menos relevantes (nunca la central) junto con sus relaciones.

        Con la búsqueda de construir() el subgrafo nunca llega a pasarse,
        porque los nodos entran de uno en uno y se para al llegar al máximo.
        Aun así lo dejamos como red de seguridad, por si en el futuro cambia la
        forma de construirlo.
        """
        while subgrafo.get_numero_nodos() > self.__max_nodos:
            id_menos_relevante = self.__buscar_menos_relevante(subgrafo)
            subgrafo.eliminar_nodo(id_menos_relevante)

    def __buscar_menos_relevante(self, subgrafo: Subgrafo) -> str:
        """(Privado) Id del nodo menos relevante que no sea la central."""
        id_central = subgrafo.get_entidad_central().get_id()
        nodo_menos_relevante = None
        for nodo in subgrafo.get_nodos():
            es_la_central = nodo.get_entidad().get_id() == id_central
            if not es_la_central:
                if nodo_menos_relevante is None or nodo.get_relevancia() < nodo_menos_relevante.get_relevancia():
                    nodo_menos_relevante = nodo
        return nodo_menos_relevante.get_entidad().get_id()

    def __guardar_centralidad(self, subgrafo: Subgrafo) -> None:
        """(Privado) Calcula la centralidad y la guarda en cada nodo."""
        centralidad_por_nodo = self.__centralidad.calcular(subgrafo)
        for nodo in subgrafo.get_nodos():
            id_entidad = nodo.get_entidad().get_id()
            nodo.set_centralidad(centralidad_por_nodo[id_entidad])
