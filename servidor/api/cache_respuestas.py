"""CacheRespuestas: guarda las respuestas ya preparadas para no repetir el trabajo."""
import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from typing import Any


class CacheRespuestas:
    """Memoria de las últimas respuestas preparadas (vecindarios y lista de
    nombres), ya convertidas a JSON.

    Aunque ahora el cálculo lo hace el navegador, preparar un vecindario
    sigue siendo lo más costoso del servidor (con la base de datos real será
    una consulta), y muchos usuarios piden los mismos (la entidad inicial,
    las más conocidas...). Con esta caché, cada respuesta se prepara UNA vez
    y las siguientes peticiones iguales reciben directamente el JSON guardado.

    (En el incremento 2 se llamaba CacheSubgrafos y guardaba subgrafos; la
    clase no ha cambiado, solo lo que se guarda en ella.)

    Tres reglas:
     1. Peticiones a la vez: si llegan varias peticiones iguales mientras la
        respuesta todavía se está preparando, no se prepara varias veces:
        todas esperan al mismo cálculo (se guarda la "tarea" en marcha, no
        solo el resultado).
     2. Tamaño máximo: como mucho max_entradas respuestas. Si se llena, se
        olvida la que lleva más tiempo sin pedirse (política LRU, "la menos
        usada recientemente"), así la memoria del servidor no crece sin límite.
     3. Caducidad: una respuesta guardada vale segundos_vigencia segundos. Con
        los datos simulados nunca cambian, pero con la base de datos real
        (incremento 4) sí pueden cambiar, y así se acaban viendo los cambios.

    Si el cálculo falla (por ejemplo, la entidad no existe), el error no se
    guarda: se olvida la entrada y el error llega a quien la pidió.

    Requisitos: RNF-01 (rendimiento con muchos usuarios a la vez).
    """

    def __init__(self, max_entradas: int, segundos_vigencia: float) -> None:
        """max_entradas: número máximo de respuestas guardadas.
        segundos_vigencia: tiempo que vale cada respuesta guardada.
        """
        if max_entradas < 1:
            raise ValueError("La caché necesita al menos una entrada.")
        self.__max_entradas = max_entradas
        self.__segundos_vigencia = segundos_vigencia
        # clave → {"tarea": cálculo en marcha o terminado, "creada": instante}.
        # OrderedDict recuerda el orden: al principio, lo que lleva más tiempo
        # sin pedirse; al final, lo último que se ha pedido.
        self.__entradas: OrderedDict[str, dict[str, Any]] = OrderedDict()

    async def obtener(self, clave: str, calcular: Callable[[], Awaitable[Any]]) -> Any:
        """Devuelve la respuesta guardada con esa clave (el texto JSON ya
        preparado o, para los vecindarios, el diccionario). Si no está (o ha
        caducado), llama a calcular() para obtenerla y la guarda.

        clave: identifica la respuesta, por ejemplo "vecindario|n1|0.3".
        calcular: función asíncrona que prepara la respuesta.
        """
        entrada = self.__buscar_vigente(clave)
        if entrada is None:
            # asyncio.ensure_future pone el cálculo en marcha como una tarea
            # independiente, que otras peticiones pueden esperar a la vez.
            tarea = asyncio.ensure_future(calcular())
            entrada = {"tarea": tarea, "creada": time.monotonic()}
            self.__entradas[clave] = entrada
            self.__quitar_las_sobrantes()

        try:
            # shield ("escudo"): si el usuario cierra la página y su petición
            # se cancela, el cálculo compartido NO se cancela, porque otras
            # peticiones pueden estar esperándolo.
            return await asyncio.shield(entrada["tarea"])
        except Exception:
            self.__olvidar_si_es(clave, entrada)
            raise

    def get_numero_entradas(self) -> int:
        """Cuántas respuestas hay guardadas (para las pruebas)."""
        return len(self.__entradas)

    def __buscar_vigente(self, clave: str) -> dict[str, Any] | None:
        """(Privado) La entrada de esa clave si existe y no ha caducado. La
        mueve al final de la cola porque se acaba de usar.
        """
        if clave not in self.__entradas:
            return None
        entrada = self.__entradas[clave]
        edad = time.monotonic() - entrada["creada"]
        if edad > self.__segundos_vigencia:
            del self.__entradas[clave]
            return None
        self.__entradas.move_to_end(clave)
        return entrada

    def __quitar_las_sobrantes(self) -> None:
        """(Privado) Si hay más entradas de las permitidas, olvida las que
        llevan más tiempo sin pedirse (las del principio de la cola).
        """
        while len(self.__entradas) > self.__max_entradas:
            self.__entradas.popitem(last=False)

    def __olvidar_si_es(self, clave: str, entrada: dict[str, Any]) -> None:
        """(Privado) Quita la entrada de esa clave, pero solo si sigue siendo
        la misma (puede que otra petición ya la haya sustituido por otra nueva).
        """
        if clave in self.__entradas and self.__entradas[clave] is entrada:
            del self.__entradas[clave]
