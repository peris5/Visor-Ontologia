/*
 * Datos de ejemplo para el RepositorioSimulado.
 *
 * TODOS LOS DATOS SON INVENTADOS: ninguna persona, organización ni obra es real.
 *
 */
var DATOS_EJEMPLO = {
  entidades: [
    // Personas
    { id: "p01", tipo: "PERSONA", nombre: "Elena Montsalvat", descripcion: "Pintora de retratos y escenas de interior.", fechaNacimiento: "1861", fechaDefuncion: "1932", nacionalidad: "Española" },
    { id: "p02", tipo: "PERSONA", nombre: "Joaquín Albereda", descripcion: "Pintor y maestro de taller.", fechaNacimiento: "1828", fechaDefuncion: "1899", nacionalidad: "Española" },
    { id: "p03", tipo: "PERSONA", nombre: "Lucía Ferrandis", descripcion: "Escultora formada en el Taller del Carmen Viejo.", fechaNacimiento: "1866", fechaDefuncion: "1941", nacionalidad: "Española" },
    { id: "p04", tipo: "PERSONA", nombre: "Tomás Orellana", descripcion: "Comerciante y mecenas de las artes.", fechaNacimiento: "1855", fechaDefuncion: "1920", nacionalidad: "Española" },
    { id: "p05", tipo: "PERSONA", nombre: "Clara Benimar", descripcion: "Grabadora y paisajista.", fechaNacimiento: "1872", fechaDefuncion: "1950", nacionalidad: "Francesa" },
    { id: "p06", tipo: "PERSONA", nombre: "Andrés Vilaflor", descripcion: "Arquitecto de edificios públicos.", fechaNacimiento: "1858", fechaDefuncion: "1927", nacionalidad: "Española" },
    { id: "p07", tipo: "PERSONA", nombre: "Inés Calduch", descripcion: "Restauradora de pintura antigua.", fechaNacimiento: "1890", fechaDefuncion: "1971", nacionalidad: "Española" },

    // Organizaciones
    { id: "o01", tipo: "ORGANIZACION", nombre: "Academia de Bellas Artes de Santa Brígida", descripcion: "Academia de formación artística.", fechaFundacion: "1768", sede: "Ciudad de Almará" },
    { id: "o02", tipo: "ORGANIZACION", nombre: "Taller del Carmen Viejo", descripcion: "Taller de pintura y escultura.", fechaFundacion: "1852", sede: "Ciudad de Almará" },
    { id: "o03", tipo: "ORGANIZACION", nombre: "Fundación Orellana", descripcion: "Fundación dedicada a coleccionar arte.", fechaFundacion: "1901", sede: "Puerto de Sella" },
    { id: "o04", tipo: "ORGANIZACION", nombre: "Museo de la Ribera", descripcion: "Museo de bellas artes.", fechaFundacion: "1913", sede: "Villa de la Ribera" },

    // Obras de arte
    { id: "a01", tipo: "OBRA_DE_ARTE", nombre: "Retablo de las Tres Fuentes", descripcion: "Retablo de madera policromada.", fechaCreacion: "1874", tecnica: "Óleo y temple sobre tabla" },
    { id: "a02", tipo: "OBRA_DE_ARTE", nombre: "La dama del abanico verde", descripcion: "Retrato femenino de interior.", fechaCreacion: "1893", tecnica: "Óleo sobre lienzo" },
    { id: "a03", tipo: "OBRA_DE_ARTE", nombre: "Busto del navegante", descripcion: "Busto en mármol.", fechaCreacion: "1897", tecnica: "Mármol tallado" },
    { id: "a04", tipo: "OBRA_DE_ARTE", nombre: "Puerto al amanecer", descripcion: "Paisaje portuario.", fechaCreacion: "1905", tecnica: "Aguafuerte" },
    { id: "a05", tipo: "OBRA_DE_ARTE", nombre: "Fachada de la Lonja Nueva", descripcion: "Edificio de la lonja de comercio.", fechaCreacion: "1899", tecnica: "Piedra y hierro" }
  ],

  relaciones: [
    ["r01", "p02", "p01", "maestro_de", 0.9],
    ["r02", "p02", "p01", "colaborador_de", 0.6],
    ["r03", "p01", "p04", "pareja_de", 0.85],
    ["r04", "p01", "a02", "autor_de", 0.95],
    ["r05", "p01", "o01", "miembro_de", 0.5],
    ["r06", "p02", "o02", "fundador_de", 0.8],
    ["r07", "p02", "a01", "autor_de", 0.9],
    ["r08", "p03", "o02", "miembro_de", 0.7],
    ["r09", "p02", "p03", "maestro_de", 0.75],
    ["r10", "p03", "a03", "autor_de", 0.9],
    ["r11", "p04", "o03", "fundador_de", 0.9],
    ["r12", "p04", "p01", "mecenas_de", 0.7],
    ["r13", "o03", "a04", "conserva", 0.6],
    ["r14", "p05", "a04", "autor_de", 0.85],
    ["r15", "p05", "o01", "miembro_de", 0.4],
    ["r16", "p06", "a05", "autor_de", 0.9],
    ["r17", "p06", "o01", "miembro_de", 0.25],
    ["r18", "p07", "a01", "restaurador_de", 0.65],
    ["r19", "p07", "o04", "miembro_de", 0.6],
    ["r20", "o04", "a01", "conserva", 0.8],
    ["r21", "o04", "a03", "conserva", 0.55],
    ["r22", "p05", "p03", "colaborador_de", 0.2],
    ["r23", "p04", "p06", "mecenas_de", 0.45],
    ["r24", "p06", "p04", "colaborador_de", 0.3],
    ["r25", "p07", "a02", "restaurador_de", 0.15],
    ["r26", "o01", "a02", "conserva", 0.35],
    ["r27", "p01", "p03", "colaborador_de", 0.1]
  ]
};
