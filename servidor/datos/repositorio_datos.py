"""«interface» RepositorioDatos (traducción de src/datos/RepositorioDatos.js)."""
from abc import ABC, abstractmethod

from servidor.modelo.entidad import Entidad
from servidor.modelo.relacion import Relacion
from servidor.modelo.tipo_entidad import TipoEntidad
from servidor.modelo.tipo_relacion import TipoRelacion
from servidor.modelo.vecindario import Vecindario


class RepositorioDatos(ABC):
    """Todo el acceso a los datos pasa por aquí. El resto de la aplicación no
    sabe si los datos vienen de un archivo de ejemplo (RepositorioSimulado) o
    de la base de datos real (incremento 4): basta con cambiar la implementación.

    Los métodos son asíncronos (async def) porque la base de datos real
    responderá a través de la red y tardará un tiempo. Mientras espera, el
    servidor puede atender otras peticiones.

    Para añadir otra fuente de datos basta con crear una clase nueva que
    herede de esta e implemente sus métodos.

    Requisitos: RNF-17.
    """

    @abstractmethod
    async def buscar_entidades(self, texto: str, tipo: TipoEntidad | None,
                               limite: int | None) -> list[Entidad]:
        """Busca entidades cuyo nombre contenga el texto.
        tipo: None para todos. limite: máximo de resultados, o None para sin límite.
        """

    @abstractmethod
    async def obtener_entidad(self, identificador: str) -> Entidad | None:
        """La entidad, o None si no existe."""

    @abstractmethod
    async def obtener_relaciones(self, id_entidad: str) -> list[Relacion]:
        """Relaciones en las que participa la entidad, sea como origen o como destino."""

    @abstractmethod
    async def obtener_tipos_relacion(self) -> list[TipoRelacion]:
        """Todos los tipos de relación conocidos."""

    @abstractmethod
    async def obtener_vecindario(self, id_entidad: str, umbral: float, max_entidades: int) -> Vecindario:
        """Todas las entidades y relaciones a las que se llega desde la
        entidad siguiendo SOLO relaciones cuyo valor supera el umbral (en los
        dos sentidos), con un máximo de max_entidades entidades.

        Con esto el navegador construye el subgrafo sin hacer una petición
        por cada nodo que expande.

        Con la base de datos real (incremento 4) será UNA sola consulta, con
        caminos de longitud variable filtrados por el valor de la relación.
        Por eso es un método del repositorio: cada base de datos lo hará a su
        manera, y el resto del servidor no tiene que saber cómo.

        Lanza ValueError si la entidad no existe.
        """

    async def cerrar(self) -> None:
        """Libera lo que use el repositorio (por ejemplo, la conexión con la
        base de datos real). El servidor lo llama al pararse. Por defecto no
        hace nada: el repositorio simulado no tiene nada que cerrar.
        """
        return None
