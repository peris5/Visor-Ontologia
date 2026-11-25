# Visor de patrimonio 3D · Relevancia artística en tres capas

Trabajo de Fin de Grado. Aplicación web para explorar en 3D una base de datos de conocimiento sobre patrimonio cultural (grupo IRTIC, Universitat de València).

El desarrollo se divide en cuatro incrementos:

1. Modelo y subgrafo (O1): datos simulados, cálculo de la relevancia y construcción del subgrafo. ✔
2. Visualización 3D (O2): servidor Python, Three.js y disposición con un grafo dirigido por fuerzas. ✔
3. Exploración (O3): buscador, información de nodos, navegación, historial y filtros. ✔
   - **3b**: adaptación al diseño de la base de datos real (Neo4j, proyecto REFRACTS). ✔
   - **Relevancia artística**: se calcula **solo en el navegador**, en tres capas. **Versión 2**: fuerza, certeza y relevancia (R, C, S), refuerzo simétrico en lugar del circuito, rol, multiplexidad, penalización de intermediarios y tiempo. ✔
4. Datos reales y validación (O4): conexión con la base de datos y pruebas de rendimiento y usabilidad.

El diseño de la base de datos está en `docs/diseno_bd_refracts.json` (export de arrows.app) y su análisis, en `ANALISIS_BD_NEO4J.md`. La referencia numérica de la relevancia es el prototipo `docs/prototipo_relevancia_v2.mjs` (`node docs/prototipo_relevancia_v2.mjs`, variante `V2`). `docs/prototipo_relevancia.mjs` es el de la versión anterior (el circuito), que se guarda para comparar.

## Arquitectura: el navegador calcula, el servidor solo da los datos

```
┌──────────────────── NAVEGADOR (JavaScript + Three.js) ── TODO EL CÁLCULO ──────────────────────┐
│  Aplicacion ──crea y conecta──▶ ControladorExploracion ◀──avisan── EscenaGrafo (3D)             │
│                                   │    ◆ FiltroVisualizacion        └ SelectorInteraccion       │
│                                   │    ◆ HistorialNavegacion  ◀──── InterfazUsuario (2D)        │
│                  ┌────────────────┴───────┐                                                     │
│                  ▼                        ▼                                                     │
│              Buscador              GestorSubgrafos ──▶ RepositorioVecindario (caché en memoria) │
│     (todos los nombres)                   │           ConstructorSubgrafo, CalculadorCentralidad │
│                                           │           EstrategiaRelevanciaNodos:               │
│                                           │             RelevanciaNodosTresCapas               │
│                                           │               (CalculadorEvidencia, RefuerzoEntreDirectos,
│                                           │                DeduccionPorTipos, TablaTransferencia...)│
│                                           │             RelevanciaNodosMejorCamino (para comparar)│
│                                           ▼           RelevanciaCompuesta (cada relación)      │
│                                    ClienteServicio                                              │
└───────────────────────────────────────────┼─────────────────────────────────────────────────────┘
   HTTP + JSON: configuración, tipos, jerarquía y nombres (UNA vez) · como mucho 2 tandas de relaciones por
   entidad nueva · un detalle al seleccionar
┌───────────────────────────────────────────▼──────── SERVIDOR (Python + FastAPI) ── SOLO DATOS ──┐
│  app.py (rutas) ─▶ ConversorJson, CacheRespuestas                                               │
│        ▼                                                                                        │
│  RepositorioDatos ◀── RepositorioSimulado (datos_ejemplo.json, con la forma de Neo4j)           │
│        │          ◀── (incremento 4: RepositorioBDConocimiento, Neo4j)                          │
│        └─▶ ClasificadorEtiquetas · ProyectorRelaciones (regla genérica)                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **La base de datos no tiene relevancias** y nadie las da: el navegador las calcula **siempre**.
- **El servidor** solo da acceso a los datos (la conexión, las credenciales y las consultas). **No calcula ni escribe nada** en la base de datos: le basta con permisos de lectura (RNF-11). Ya no existen `AsignadorRelevancia`, `RelevanciaPorTipo` ni `AlmacenRelevancias`.
- **El navegador** hace el resto: la relevancia de cada relación y de cada nodo, el subgrafo, la poda a 150 nodos, la centralidad, los colores, la búsqueda tolerante a errores, la vista 3D y la interfaz.
- El servidor apenas consume recursos y atiende a más usuarios a la vez (RNF-05). Las sugerencias del buscador salen al instante, porque se buscan en memoria (RNF-03).
- Cada entidad se abre con el umbral que da **más o menos `nodosObjetivo` nodos** (`AjustadorUmbral`). Después el deslizador se mueve libremente, **sin ninguna petición**.

## La relevancia artística, en tres capas

La relevancia es **artística**: mide cuánto ayuda una entidad a entender la trayectoria y la obra de la entidad central (formación, autoría, colaboración, circuito de exposiciones, instituciones). Lo personal (pareja, familia, amistad) solo pesa si tiene un lado artístico.

### Tres números por nodo

| | Qué dice | Para qué se usa |
|---|---|---|
| **R, fuerza** | Cuánto importaría la entidad **si la relación fuera segura** | Para calcular S |
| **C, certeza** | Cuánto se sabe **de verdad**: 1 si hay una relación declarada; menos si solo hay coincidencias en eventos o deducciones | Para calcular S, y la **opacidad** del nodo |
| **S = R × C, relevancia** | Lo que importa la entidad, contando las dudas | Quién entra en el subgrafo (umbral y máximo de 150), el orden y la **distancia al centro** |

Separar fuerza y certeza sigue la idea de la **lógica subjetiva** de Jøsang: una probabilidad con un grado de incertidumbre. Tiene un operador de **descuento**, que encadena a lo largo de un camino (los productos de la deducción), y otro de **fusión**, que junta varias fuentes (los «o» de probabilidades).

### Por qué cambia

Antes, la relevancia de un nodo era el **producto del mejor camino** desde la central. Tenía tres problemas:

1. **No sumaba vías**: si alguien está unido a la central por varios caminos, solo contaba el mejor.
2. **No distinguía qué se transmite**: la obra de un amigo salía casi tan relevante como el amigo, aunque artísticamente no diga nada de la central. La obra de su **maestro**, en cambio, sí.
3. **Ignoraba evidencia**: los eventos con más de 10 entidades se descartaban, y coincidir en varias exposiciones no se acumulaba.

### Cada relación

`r = peso(tipo, rol del otro) × (2/n)^β × f_t` (`RelevanciaCompuesta`):

- **peso**: primero `pesosPorRol` con el rol que tiene **el otro** extremo. Si el otro es mi maestro, la mentoría vale 0,95; si es mi alumno, 0,60. Si no hay peso por rol, el del tipo en `pesosRelevancia` o, si no tiene, el de su padre más cercano (`Paint` → `Creation`), o `pesoPorDefecto`. Los roles se normalizan con `rolesEquivalentes` («Maestra», «teacher», «Mestre» → `maestro`; `NormalizadorRoles`).
- **(2/n)^β**: n es el número de participantes del evento. Una relación entre dos vale entera, y coincidir con 40 personas, mucho menos.
- **f_t**, el factor de tiempo: penaliza lo que pasó lejos de la **época de la central**, que va del primer al último año de sus relaciones con fecha. Vale `f_t = mínimo + (1 − mínimo) · e^(−Δ/τ)`, donde Δ son los años de distancia a esa época. Una relación sin fecha recibe `factorTiempoSinFecha`, y los tipos de `tiposSinTiempo` no caducan.

### Capa 0: la evidencia de cada pareja, vista desde un lado

Se juntan **todas** las relaciones y eventos que unen a dos entidades, se dibujen o no (`CalculadorEvidencia`). Por el rol, la evidencia es **dirigida**: la de mi maestro vista desde mí no es la mía vista desde él.

```
por tipo:   fuerza_tipo = 1 − Π_k (1 − r_k · ρ^(k−1))      pruebas del mismo tipo, de mayor a menor
total:      F = 1 − Π_tipos (1 − fuerza_tipo)

certeza:    C = 1                                          si hay alguna relación declarada
            C = 1 − Π_k (1 − pCoincidencia · (2/n_k)^β)    si solo hay coincidencias
```

- **Multiplexidad**: las pruebas repetidas del mismo tipo rinden cada vez menos (ρ). Diez exposiciones juntos no son diez veces una. Los tipos **distintos** se combinan sin descuento.
- Una **coincidencia** es una relación de un evento cuyo tipo exacto (sin herencia) está en `tiposCoincidencia` **y** cuyos dos extremos son personas. Por ejemplo, dos pintores en la misma exposición. Todo lo demás es **declarado**: una relación, el autor y su obra, la obra y el museo de una exposición, los coautores de una obra… `Creation` hereda de `Event`, pero no cuenta como coincidencia.

Un nodo es **directo** si `F(c,X) × C(c,X) × fE(X) ≥ umbralDirecto`.

### Capas 1 y 2: refuerzo simétrico entre directos

```
R(X) = 1 − (1 − F(c,X)·fE(X)) × Π_Y (1 − F(c,Y)·fE(Y) · F(Y,X) · T̄(c,Y → tipo(Y,X)) · fE(X) · h(Y))
C(X) = 1 − (1 − C(c,X))       × Π_Y (1 − C(c,Y) · C(Y,X) · κ)
```

(`RefuerzoEntreDirectos`) Si dos contactos directos de la central están relacionados entre sí, cada uno hace más relevante al otro. Cada directo recibe de **todos** los demás directos con los que tiene relación, usando la evidencia **propia** del otro y no su valor ya reforzado. Es **un solo paso**, sin iterar y sin orden.

- **κ, cierre triádico**: ser amigo de alguien que conoces hace más probable que te conozca (Kossinets y Watts, 2006). Por eso Marta, que solo coincide con Ana en exposiciones, gana certeza por ser amiga de Luis.
- **h**, penalización de los intermediarios muy conectados (idea de Adamic-Adar): `h(P) = min(1, log(2 + gradoReferencia) / log(2 + grado(P)))`. Que dos entidades estén unidas a través de una academia de 300 dice menos que a través de un taller de cinco.

### Capa 3: deducción a dos saltos

```
dR = R(P) · F(P,Z) · T̄(c,P → tipo(P,Z)) · fE(Z) · h(P) · τ(c,P,Z)
dC = C(P) · C(P,Z) · δ

R(Z) = 1 − (1 − F(c,Z)·fE(Z)) × Π (1 − dR_k)      F(c,Z) = 0 si Z no tiene evidencia propia
C(Z) = 1 − (1 − C(c,Z))       × Π (1 − dC_k)
```

(`DeduccionPorTipos`) Los nodos sin evidencia propia (o con muy poca) entran a través de un directo P.

- **T̄, transferencia efectiva**: depende de la pareja de tipos del camino y del rol. La obra de tu maestro (`Mentorship:maestro>Creation` = 0,8) dice mucho de ti; la de un amigo (`Friendship>Creation` = 0,2), poco. Si el primer tramo tiene varios tipos (Luis es amigo **y** coexpositor de Ana), es la media ponderada por la fuerza de cada tipo.
- **τ, compatibilidad temporal**: la obra que pintó tu maestro mientras te enseñaba (antes o durante la mentoría) cuenta entera; una 35 años posterior, solo `factorFueraDeTiempo`.
- **δ**: el descuento por deducir.
- Nunca se deduce a tres saltos. Un deducido sin evidencia propia **no supera a su mejor padre**: todos los factores están entre 0 y 1. Con varios padres podría pasarse, así que se le pone un tope (ver «Diferencias con el prototipo»).

### Las nueve propiedades

El cálculo cumple estas propiedades, y son las pruebas de `tests/pruebasPropiedadesRelevancia.js`. También se cumplen al mover ρ, δ y κ: 27 combinaciones.

| | Propiedad |
|---|---|
| P1 | Añadir una relación no baja la relevancia de nadie |
| P2 | Ningún nodo directo baja de su propia evidencia |
| P3 | Un nodo deducido sin evidencia propia no supera a su mejor padre |
| P4 | Cuatro tipos distintos de vínculo pesan más que diez exposiciones repetidas |
| P5 | El compañero de un taller pequeño pesa más que el de una academia enorme |
| P6 | El maestro es más relevante para la alumna que la alumna para el maestro |
| P7 | La obra del maestro de la época de la mentoría pesa más que una muy posterior |
| P8 | En el ejemplo de Ana entra la obra de su maestro y no el marido (no artista) de su amigo |
| P9 | Dos nodos en la misma situación reciben la misma relevancia (el orden de cálculo no influye) |

### Por qué no un circuito ni un modelo solo de muelles

Se evaluaron tres variantes con las nueve propiedades (`node docs/prototipo_relevancia_v2.mjs`):

- **El circuito eléctrico** de la versión anterior (V1) incumple **P1 y P2**. La tensión de cada nodo es una media de la de sus vecinos, así que conectar un nodo a otro con menos tensión le quita corriente. Añadir una relación podía bajar a alguien: Luis pasaba de 0,76 a 0,72 por ser amigo de Marta.
- **Un modelo solo de muelles**, en el que la relevancia saliera de la posición en el dibujo, incumple **P1, P3, P5, P7 y P8**. Además depende del azar de la simulación.
- **El refuerzo simétrico** (V2) cumple las nueve.

El dibujo **nunca** modifica la relevancia: los muelles salen del cálculo y no al revés.

### Para comparar: el mejor camino

Con `"estrategiaNodos": "mejorCamino"` en `public/relevancia.json` vuelve el cálculo anterior (`RelevanciaNodosMejorCamino`), con el mismo algoritmo. No distingue la certeza (C = 1) y cambian dos cosas de lo que recibe:

- cada relación vale `r` completa, no solo su peso;
- solo llega a dos saltos.

Recarga la página después de cambiarlo.

## Carga en dos tandas

Para una entidad nueva, `GestorSubgrafos`:

1. Pide **todas** las relaciones de la central (`POST /api/relaciones`), si no están en la caché.
2. Calcula la evidencia con cada vecino y elige los **directos**. Si hay más de `maxDirectos`, avisa en la consola y se queda con los de más evidencia.
3. Pide **en una sola tanda** las relaciones de los directos que faltan. `ClienteServicio` la parte en trozos de 200 ids.
4. Calcula las relevancias y construye el subgrafo.

**Por qué es exacto.** El refuerzo y la deducción solo miran a dos saltos:

- la evidencia de la central sale de sus relaciones;
- las relaciones entre directos y los vecinos de los directos salen de las relaciones de los directos.

Tras la tanda 2 se tienen **todas** las relaciones de cada directo, así que su grado (el de h) es exacto. Tener más datos no cambiaría ningún número.

**Consecuencias:**

- cambiar el umbral (subirlo o bajarlo) no hace ninguna petición;
- volver a una entidad visitada, tampoco;
- desmarcar «Mostrar deducidos», tampoco;
- cada entidad nueva cuesta como mucho 2 tandas.

La barra de abajo muestra «Tandas: X · Directos: Y · Deducidos: Z».

## Qué se ve

- **Distancia al centro**: `6 + (1 − S) × 40`.
- **Muelles** (`SimulacionFuerzas`): **uno por pareja**, aunque se dibujen varias curvas. Si cada curva tuviera el suyo, una pareja con cinco exposiciones tiraría cinco veces. Su peso es lo que esa pareja transmite en el cálculo:
  - entre dos directos, el mayor de los dos sentidos de `F(Y,X) · T̄ · fE · h`;
  - entre un deducido y su padre, `F(P,Z) · T̄ · fE(Z) · h(P) · τ`;
  - en cualquier otra pareja, `F × C`;
  - con la central no hay muelle.

  `k = 4·peso²` y `longitud = 2 + (1 − peso) × 20`. Así «Paseo» queda junto a Joaquín (peso 0,8).
- **Opacidad** = `opacidadMinima + (1 − opacidadMinima) × C`, continua. Los declarados quedan opacos y los deducidos, con el nombre en cursiva.
- **Línea discontinua**: las parejas sin relación declarada (solo coincidencias) y las aristas sintéticas `COINCIDENCIAS`. Una arista sintética se añade cuando un nodo no tiene ninguna relación que se pueda dibujar. Va hacia la central (o hacia su mejor padre, si es deducido) con el texto «Coinciden en N eventos».
- **Leyenda**: sección «Origen» con las tres muestras (continua, discontinua, semitransparente) y la casilla «Mostrar deducidos». No depende solo del color (RNF-26).
- **Etiqueta y panel**: explican de dónde sale la relevancia:
  - «Mentoría (su maestro)»;
  - «Amistad · 5 exposiciones juntos»;
  - «Coinciden en 3 exposiciones · Amistad con Luis Peris»;
  - «Pintura de Joaquín Mestre (su maestro)».

  El panel muestra además:
  - S, R y C, con la certeza en palabras: «segura» si C ≥ 0,9, «probable» si C ≥ 0,5 y «supuesta» si es menor;
  - el origen, la evidencia propia y el camino;
  - los eventos compartidos que **no** se dibujan.

  **Nunca** se escribe que dos personas «se conocen» si no hay relación declarada (RNF-23).

## Parámetros (`public/relevancia.json`)

> **Todos los valores son una propuesta pendiente de validar con el grupo de investigación.** JSON no admite comentarios, por eso se explican aquí. Vite copia el archivo tal cual al publicar: se puede cambiar sin recompilar (recargando la página).

| Parámetro | Qué es |
|---|---|
| `perfil` | `"artistico"` (de momento el único; deja sitio para otros perfiles) |
| `estrategiaNodos` | `"tresCapas"` (por defecto) o `"mejorCamino"` (el cálculo anterior, para comparar) |
| `pesosRelevancia`, `pesoPorDefecto` | Peso de cada tipo (heredado por los padres) y el de un tipo sin peso |
| `pesosPorRol` | Peso según el rol del otro extremo: `"Mentorship.maestro"` (el otro es mi maestro), `"Mentorship.aprendiz"` |
| `rolesEquivalentes` | Cómo se normalizan los roles de la BD («maestra», «teacher», «mestre» → `maestro`) |
| `betaParticipantes` | β de `(2/n)^β`: cuánto penaliza el tamaño del evento |
| `factorTiempoMinimo`, `tauTiempoAnios` | Mínimo de f_t y años en que la penalización por época cae a ~1/3 de su recorrido |
| `factorTiempoSinFecha` | f_t de una relación sin fecha (si la central tiene época) |
| `tiposSinTiempo` | Tipos (y sus hijos) que no caducan: `Creation`, `Mentorship`, `Related` |
| `tablaTransferencia`, `transferenciaPorDefecto` | Tabla T `"tipo1[:rol1]>tipo2"` (heredada por los padres) y su valor si no hay ninguna |
| `factorEntidad` | Peso de cada tipo de entidad (la etiqueta más específica que tenga, subiendo por los padres; si ninguna, 1) |
| `tiposCoincidencia` | Tipos de evento (exactos) que, entre dos personas, son coincidencia y no relación |
| `probabilidadCoincidencia` | Certeza que da una coincidencia en un evento de 2 |
| `rho` (ρ) | Rendimiento decreciente de las pruebas repetidas del mismo tipo |
| `cierreTriadico` (κ) | Certeza que aporta «es amigo de alguien que conoces» |
| `delta` (δ) | Descuento de la certeza al deducir a dos saltos |
| `gradoReferencia` | A partir de cuántas entidades relacionadas se penaliza a un intermediario (h) |
| `paresTemporales` | Pares de tipos en los que importa el orden en el tiempo: `antesODurante` o `solapa` |
| `margenAnios` | Margen de esas comparaciones |
| `factorFueraDeTiempo` | τ cuando el camino no respeta el tiempo |
| `transferenciaSinFecha` | τ cuando falta alguna fecha |
| `umbralDirecto` | `F × C × fE` mínimo con la central para ser nodo directo |
| `maxDirectos` | Máximo de nodos directos (si hay más, los de más evidencia) |
| `mostrarDeducidosPorDefecto` | Si la casilla «Mostrar deducidos» empieza marcada |
| `opacidadMinima` | Opacidad de un nodo con certeza 0 |

Ya no existen `maxRelacionesCombinadas`, `gamma`, `toleranciaCircuito` ni `maxVueltasCircuito`.

### Valores de referencia (escenario del prototipo)

`escenarioAna()` del prototipo, con los parámetros de arriba, β = 1 y f_t = 1 (`tests/pruebasRelevanciaNodosTresCapas.js` lo comprueba con ± 0,005):

| Nodo | S | R | C | Origen |
|---|---|---|---|---|
| Huerta | 1,000 | 1,000 | 1,000 | DECLARADA |
| Joaquín Mestre | 0,950 | 0,950 | 1,000 | DECLARADA |
| Luis Peris | 0,789 | 0,789 | 1,000 | DECLARADA |
| Taller Valencia | 0,520 | 0,520 | 1,000 | DECLARADA |
| Marta Soler | 0,336 | 0,596 | 0,564 | COINCIDENCIAS |
| Paseo | 0,532 | 0,760 | 0,700 | DEDUCIDA |
| Museo de la Ciudad | 0,314 | 0,448 | 0,700 | DEDUCIDA |
| Retrato | 0,168 | 0,240 | 0,700 | DEDUCIDA |
| Juan Ribes | 0,118 | 0,169 | 0,700 | DEDUCIDA |
| Pedro Navarro | 0,098 | 0,136 | 0,720 | DEDUCIDA |

En los datos simulados (con las 38 personas de relleno que hacen falta para las exposiciones grandes), los valores cambian un poco:

- Luis: 0,783.
- Marta: 0,345.
- Retrato: 0,149.
- Pedro: 0,093.
- «Tardía»: 0,160.

Con umbral 0,3 entran los mismos siete.

### Diferencias con el prototipo

- **Tope de P3 con varios padres** (añadido): si un deducido sin evidencia propia superase al mejor de sus padres, por ejemplo una obra firmada por tres maestros, se le baja R hasta igualarlo. En el ejemplo no cambia nada.
- **Herencia en `paresTemporales`**, como en la tabla T. Así `Mentorship>Paint` usa `Mentorship>Creation`, y «Tardía», que en los datos es `Paint`, se penaliza.
- Los textos usan el rol normalizado: «(su maestro)» también para una maestra.
- El prototipo cuenta el grado con las entidades de su escenario. En los datos simulados, las personas de relleno de las exposiciones también cuentan. Por eso h(Marta) ≈ 0,66 y h(Luis) ≈ 0,90, y salen las pequeñas diferencias de la tabla.

## Los datos con la forma de Neo4j

### Forma de los datos simulados

`servidor/datos/datos_ejemplo.json` es un grafo **inventado** con la misma estructura que el diseño de Neo4j:

```json
{
  "jerarquia": { "Painter": "Creator", "Creator": "Person", "Marriage": "Related", "Related": "Relationship", "...": "..." },
  "nodos":      [ { "id": "n1", "etiquetas": ["Person", "Creator", "Painter"], "propiedades": { "name": "Elena", "lastName": "Ferrando Peris" } } ],
  "relaciones": [ { "id": "r1", "tipo": "HAS_ROLE_IN", "desde": "n1", "hasta": "n227", "propiedades": { "role": "maestra" } } ]
}
```

- Las entidades **no** se relacionan directamente: lo hacen a través de nodos intermediarios (`Relationship`, `Event` y sus subtipos), con sus periodos (`Period`), lugares (`Ubication`), imágenes (`Image`) y fuentes (`ExternalSource`).
- Etiquetas, tipos de relación y propiedades son **exactamente** los del diseño, erratas incluidas (`Ubication`, `Employement`, `OCURRED_AT`, `coworking`).
- **Ninguna relación tiene `relevance`**, igual que la BD real.
- Dos elementos de prueba que **no están en el diseño** (marcados con `"_comentario"`): el subtipo `Apprenticeship` y la relación directa `STUDENT_OF`.
- **Escenario fijo de Ana Ferrer** (ids fijos, nombres inventados, al final del archivo): el ejemplo del prototipo, con Luis Peris, Marta Soler, Pedro Navarro, Joaquín Mestre, Juan Ribes, el Taller Valencia, el Museo de la Ciudad y las obras «Huerta», «Retrato» y «Paseo».
  - Para que las exposiciones tengan 4, 6, 12 y 40 participantes hay **38 personas de relleno**.
  - Por eso, en la aplicación, los valores de Ana se mueven algo respecto al prototipo: Luis 0,68 y Marta 0,49, y salen algunos directos de relleno poco relevantes. La tabla exacta se comprueba en `pruebasRelevanciaNodosTresCapas.js`.

Tiene 164 personas, 27 organizaciones, 63 obras y 15 lugares (1549 nodos y 2620 relaciones). Lo genera, con semilla fija, `servidor/datos/generar_datos_ejemplo.py`:

```
.venv\Scripts\python.exe -m servidor.datos.generar_datos_ejemplo
```

Escribe también `tests/relacionesEjemplo.json`, con todas las entidades y relaciones derivadas tal como las envía el servidor, que usan las pruebas del navegador.

### Clasificación de las etiquetas y regla genérica

La clasificación está en `servidor/configuracion.json`, no en el código (`ClasificadorEtiquetas`):

- **Entidades** (`etiquetasEntidad`): `Person` → persona, `Organization` → organización, `HeritageItem` → obra.
- **Auxiliares** (`etiquetasAuxiliares`, con su papel en `papelesAuxiliares`): `Period`, `Ubication`, `Image`, `ExternalSource`.
- **Intermediarios**: todo lo demás, también cualquier etiqueta nueva.

`ProyectorRelaciones` deriva las relaciones entre entidades con una **regla genérica**:

1. **Por intermediario:** una relación por cada **pareja** de entidades unidas al mismo intermediario. Su tipo es la etiqueta más específica.
2. **Directa:** una relación entre dos entidades se toma tal cual (por ejemplo `STUDENT_OF`).
3. **Límites:** `tiposSinRelacion` (`Birth`, `Death`, `Live`) no crean relaciones.
   - Con más de `maxParticipantesIntermediario` (10) entidades, las relaciones llegan con **`dibujable: false`**: no se dibujan, pero cuentan como evidencia.
   - Con más de `maxParticipantesEvidencia` (200), el intermediario se ignora.
   - Solo se devuelven las parejas de las entidades pedidas, nunca todas las de un evento.
4. **Datos:** roles, nombre del intermediario, periodo, lugar, fecha y `participantes`.

En `servidor/datos/proyector_relaciones.py` hay una consulta Cypher de referencia para el incremento 4.

### Cómo se añade un tipo nuevo

Normalmente, **nada**: sale solo en `/api/tipos`, en la leyenda y en el grafo, hereda el peso y la T de su padre más cercano y se nombra a partir de su id (`STUDENT_OF` → «Student of»). Como mucho, se añade un peso o una T en `public/relevancia.json` y un nombre en `nombresTipos` (`servidor/configuracion.json`).

## Instalación (una vez)

```
npm install
py -m venv .venv
.venv\Scripts\activate
pip install -r servidor/requirements.txt
```

## Desarrollo: dos servidores

- **Terminal 1, servidor Python** (puerto 8000):
  ```
  .venv\Scripts\activate
  python -m uvicorn servidor.app:app --reload --port 8000
  ```
  `http://localhost:8000/api/salud` debe responder `{"estado": "ok"}`. La documentación de la API está en `http://localhost:8000/docs`.
- **Terminal 2, la página** (puerto 5173): `npm run dev` y abre `http://localhost:5173/`.

En Windows, la recarga automática (`--reload`) a veces se queda a medias. Si algo no cambia, para el servidor y arráncalo de nuevo.

## Pruebas

- **Python**: `python -m pytest`. Cubren el clasificador, el proyector (`dibujable`, `participantes`, límites), el repositorio, los datos de ejemplo (y el escenario de Ana Ferrer), la configuración, la caché y la API. También comprueban que el servidor no escribe ninguna propiedad `relevance*`.
- **Navegador**: con `npm run dev` en marcha, abre `http://localhost:5173/pruebas.html`.
  - Incluyen cada pieza de la relevancia (`RelevanciaCompuesta`, `NormalizadorRoles`, `CalculadorEvidencia`, `TablaTransferencia`, `PenalizacionGrado`, `CompatibilidadTemporal`, `RefuerzoEntreDirectos`, `DeduccionPorTipos`), la tabla del prototipo (`pruebasRelevanciaNodosTresCapas.js`) y las **nueve propiedades** (`pruebasPropiedadesRelevancia.js`).
  - También el gestor (tandas y peticiones), el constructor (orden por S, arista sintética, deducidos, máximo, un muelle por pareja), la leyenda y los paneles.
  - No necesitan el servidor: usan un cliente falso y `tests/relacionesEjemplo.json`.

## Publicar

```
npm run build
python -m uvicorn servidor.app:app --port 8000
```

`npm run build` deja la página en `dist/` y el servidor Python la sirve en `/` además de la API.

## API

| Petición | Respuesta |
|---|---|
| `GET /api/salud` | `{"estado": "ok"}` |
| `GET /api/configuracion` | `umbralPorDefecto`, `maxNodos`, `nodosObjetivo`, `entidadInicial`, `idioma`, `nombresTipos`, `etiquetasEntidad` |
| `GET /api/tipos` | Los tipos de relación con sus padres |
| `GET /api/jerarquia` | **Nueva.** Cada etiqueta con sus padres: `{"Painter": ["Creator", "Person"]}` (para `factorEntidad`) |
| `GET /api/nombres` | Todas las entidades con sus etiquetas y nombres (el índice del buscador) |
| `POST /api/relaciones` `{"ids": [...]}` | **Nueva** (sustituye a `/api/vecindario`). `ids`, `entidades` (en bruto, con todas sus etiquetas) y `relaciones` (derivadas, **sin relevancia**, con `participantes` y `dibujable`) de las entidades pedidas |
| `GET /api/detalle/{id}` | Eventos, imágenes, fuentes y ubicación |

- `ids`: de 1 a 200, de 1 a 100 caracteres cada uno; si no, **422**. Una entidad inexistente da **404**.
- Las relaciones se guardan en la caché del servidor entidad a entidad.

## Configuración

- **`public/relevancia.json`**: los parámetros de la relevancia (ver arriba).
- **`servidor/configuracion.json`**: ajustes generales (`origenDatos`, `umbralPorDefecto`, `maxNodos`, `nodosObjetivo`, `entidadInicial`, `idioma`), clasificación de etiquetas, límites (`maxParticipantesIntermediario`, `maxParticipantesEvidencia`) y `nombresTipos`. Ya **no** tiene pesos.
- **`public/config.json`**: solo `urlServicio` (`"/api"`).

## Carpetas y clases

### Servidor (`servidor/`)

| Ruta | Qué es |
|---|---|
| `app.py` | Rutas de la API (`/api/relaciones`, `/api/jerarquia`...), configuración comprobada al arrancar y página publicada. |
| `api/conversor_json.py` | **ConversorJson**: forma del JSON. |
| `api/cache_respuestas.py` | **CacheRespuestas**. |
| `logica/configuracion.py` | **Configuracion**. |
| `logica/clasificador_etiquetas.py` | **ClasificadorEtiquetas**. |
| `datos/repositorio_datos.py` | **«interface» RepositorioDatos** (`obtener_tipos`, `obtener_jerarquia`, `obtener_nombres`, `obtener_relaciones`, `obtener_detalle`). |
| `datos/repositorio_simulado.py` | **RepositorioSimulado**: solo lee. |
| `datos/proyector_relaciones.py` | **ProyectorRelaciones**: la regla genérica, con `participantes` y `dibujable`. |
| `datos/generar_datos_ejemplo.py` | Genera los datos de ejemplo y el escenario de Ana Ferrer. |

### Navegador (`src/`)

| Ruta | Qué es |
|---|---|
| `aplicacion/Aplicacion.js` | Crea y conecta todo, lee `public/relevancia.json` y elige la estrategia de nodos. |
| `modelo/EvidenciaPareja.js`, `ResultadoRelevanciaNodo.js`, `OrigenRelevancia.js` | Evidencia (dirigida) de una pareja con todos sus tipos; R, C y S de un nodo, sus padres y lo que transmite; su origen. |
| `modelo/Relacion.js`, `NodoRelevante.js`, `Subgrafo.js`, `Entidad.js` | Relación con participantes, `dibujable`, roles y nombre; nodo con su resultado; subgrafo con la evidencia de cada pareja y sus muelles; entidad con sus etiquetas. |
| `datos/RepositorioVecindario.js` | La **caché** de relaciones: va acumulando tandas y sabe qué entidades tiene completas. |
| `datos/ClienteServicio.js` | `obtenerRelaciones` (POST en trozos de 200), `obtenerJerarquia` y el resto. |
| `logica/RelevanciaCompuesta.js` | Cada relación: `peso × (2/n)^β × f_t`. |
| `logica/NormalizadorRoles.js`, `CalculadorEvidencia.js` | Capa 0: roles normalizados y evidencia de cada pareja. |
| `logica/TablaTransferencia.js`, `PenalizacionGrado.js`, `CompatibilidadTemporal.js` | T y T̄ con rol y herencia, factorEntidad; h; τ. |
| `logica/RefuerzoEntreDirectos.js`, `DeduccionPorTipos.js` | Capas 1 y 2 (sustituye a `CircuitoRelevancia`) y capa 3. |
| `logica/EstrategiaRelevanciaNodos.js`, `RelevanciaNodosTresCapas.js`, `RelevanciaNodosMejorCamino.js` | **Nuevas**: la interfaz y sus dos implementaciones. |
| `logica/GestorSubgrafos.js`, `ConstructorSubgrafo.js` | Carga en dos tandas; orden y corte por S, aristas, arista sintética y un muelle por pareja. |
| `vista3d/`, `interfaz/` | Opacidad según C, líneas discontinuas, muelles del cálculo, sección «Origen» de la leyenda y panel con S, R, C y la explicación. |

## Uso

- **Buscar**: escribe en el buscador (2 letras; cualquier idioma o apellido; se toleran erratas).
- **Ver información**: clic en un nodo o en una línea. Al pasar el puntero se ve el nombre y por qué es relevante.
- **Navegar**: doble clic o «Explorar su red»; «← Volver» (o `Alt + ←`).
- **Filtrar**: pulsa un tipo en la leyenda. «Mostrar deducidos» muestra u oculta los nodos deducidos.
- **Cámara** y **Disposición**: como antes.

## Lista de comprobación (a mano)

Con los dos servidores en marcha, abre `http://localhost:5173/`, busca **Ana Ferrer** y pon el umbral en **0,3**:

- [ ] Joaquín Mestre y «Huerta» quedan pegados al centro, y el Taller Valencia claramente más lejos que Luis Peris.
- [ ] Marta Soler aparece semitransparente y con línea discontinua, y su panel dice «probable». También lista la «Exposición colectiva de 1911 (40 artistas)», aunque no se dibuja.
- [ ] «Paseo» y el Museo de la Ciudad aparecen como deducidos. «Retrato», Juan Ribes, Pedro Navarro y «Tardía» **no** aparecen.
- [ ] La etiqueta de «Paseo» dice «Pintura de Joaquín Mestre (su maestro)», y en el dibujo queda junto a Joaquín por el muelle fuerte.
- [ ] Mover el umbral en los dos sentidos no hace ninguna petición en la pestaña *Red* (F12). Desmarcar «Mostrar deducidos», tampoco.
- [ ] Con `"estrategiaNodos": "mejorCamino"` (y recargando) vuelve el comportamiento antiguo: «Paseo» y «Tardía» valen 0,95 y todo se ve opaco.
- [ ] La barra muestra «Tandas: 2 · Directos: … · Deducidos: …» al abrir una entidad nueva, y «Tandas: 0» al volver a ella.

## Pendiente de validar con el grupo de investigación

- Todos los valores de `public/relevancia.json` (pesos, pesos por rol, tabla T, ρ, κ, δ, `gradoReferencia`, pares temporales, factores…).
- La fórmula del factor de tiempo f_t de cada relación (época de la central, `factorTiempoMinimo` 0,5, τ = 25 años, sin fecha 0,9, `tiposSinTiempo`).
- El tope de P3 con varios padres y la herencia en `paresTemporales` (no están en el prototipo).
- Qué roles hay en la BD real, para completar `rolesEquivalentes`.
- Si en la BD real los subtipos son varias etiquetas en el mismo nodo (`:Event:Creation:Paint`).
