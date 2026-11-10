# Visor de patrimonio 3D · Incremento 1: modelo y subgrafo

Trabajo de Fin de Grado. Aplicación web para explorar en 3D una base de datos de conocimiento sobre patrimonio cultural (grupo IRTIC, Universitat de València).

El desarrollo se divide en cuatro incrementos:

1. Modelo y subgrafo (O1): datos simulados, cálculo de la relevancia y construcción del subgrafo. Es el que contiene este repositorio.
2. Visualización 3D (O2): Three.js y disposición con un grafo dirigido por fuerzas.
3. Exploración (O3): buscador, información de nodos, navegación y filtros.
4. Datos reales y validación (O4): conexión con la base de datos y pruebas de rendimiento y usabilidad.

## Qué hace este incremento

Dada una entidad central, construye su subgrafo relevante:

- Cada relación trae de la BD un valor de relevancia entre 0 y 1.
- La relevancia de un nodo es el producto de las relevancias del camino desde la central (la central vale 1).
- Solo entran nodos y relaciones cuya relevancia supera el umbral (0,3 por defecto), con un máximo de 150 nodos.
- La búsqueda es «primero el mejor»: un nodo entra en el subgrafo cuando sale de la lista de pendientes como el más relevante. Por eso cada nodo entra con la mejor relevancia que puede tener, y si se llega al máximo, los que quedan fuera son los menos relevantes. La explicación completa está en `src/logica/ConstructorSubgrafo.js`.
- Entre dos entidades se guardan todas las relaciones que superan el umbral, y la más relevante decide si el vecino entra.
- Al final se calcula la centralidad de cada nodo.

## Cómo abrirlo

No hace falta instalar nada (ni Node, ni npm, ni servidor).

- Para la aplicación, abre `index.html` con doble clic. Elige una entidad y mueve el deslizador del umbral; las tablas de nodos y relaciones se recalculan. Es una página provisional que en el incremento 2 se sustituye por la escena 3D.
- Para las pruebas, abre `pruebas.html` con doble clic. Arriba aparece el resumen («X de Y pruebas correctas») y debajo cada prueba, en verde si es correcta o en rojo si falla, con el motivo.

Las clases no usan módulos (`import`/`export`) porque el navegador los bloquea al abrir un archivo con doble clic (`file://`). Cada clase se carga con un `<script>` normal, después de las que necesita.

## Carpetas y clases

| Ruta | Qué es |
|---|---|
| `index.html` | Página provisional de comprobación (tablas, sin 3D). |
| `pruebas.html` | Ejecuta las pruebas en el navegador. |
| `config.js` | Configuración (variable global `CONFIGURACION`). |
| `src/main.js` | Lógica de la página de comprobación. |
| `src/estilos.css` | Estilos de las dos páginas. |
| **`src/modelo/`** | **Modelo de dominio** |
| `TipoEntidad.js` | Enumeración: PERSONA, ORGANIZACION, OBRA_DE_ARTE. |
| `Entidad.js` | Clase abstracta con lo común a todas las entidades. |
| `Persona.js` | Persona (nacimiento, defunción, nacionalidad). |
| `Organizacion.js` | Organización (fundación, sede). |
| `ObraDeArte.js` | Obra de arte (creación, técnica). |
| `TipoRelacion.js` | Tipo de relación que se saca de los datos, con nombre y color. |
| `Relacion.js` | Relación entre dos entidades, con su valor y su relevancia. |
| `NodoRelevante.js` | Entidad dentro de un subgrafo: relevancia, nivel y centralidad. |
| `Subgrafo.js` | Entorno relevante de una entidad: nodos y relaciones. |
| **`src/datos/`** | **Acceso a los datos** |
| `RepositorioDatos.js` | Interfaz de acceso a datos (RNF-17). |
| `RepositorioSimulado.js` | Implementación con datos de ejemplo en memoria y retardo simulado. |
| `FabricaEntidades.js` | Crea la subclase de `Entidad` que corresponde a cada tipo. |
| `datosEjemplo.js` | Datos inventados (variable global `DATOS_EJEMPLO`). |
| **`src/logica/`** | **Lógica de la aplicación** |
| `Configuracion.js` | Lee la configuración y pone valores por defecto (RNF-16). |
| `EstrategiaRelevancia.js` | Interfaz del cálculo de relevancia (RNF-30). |
| `RelevanciaDesdeBD.js` | Relación = valor de la BD acotado; nodo = producto. |
| `CalculadorCentralidad.js` | Centralidad de grado ponderada y normalizada (RF-37). |
| `PaletaColores.js` | Colores distintos y deterministas para los tipos (RF-20, RF-39). |
| `ConstructorSubgrafo.js` | Construye el subgrafo con «primero el mejor» (RF-08 a RF-12). |
| **`tests/`** | **Pruebas** |
| `miniPruebas.js` | Mini sistema de pruebas: `prueba`, `comprobar`, `comprobarIgual`. |
| `pruebas*.js` | Un archivo de pruebas por tema. |