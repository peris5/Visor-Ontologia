import * as THREE from 'three';
import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { EnlaceVisual } from '../src/vista3d/EnlaceVisual.js';
import { FabricaNodosVisuales } from '../src/vista3d/FabricaNodosVisuales.js';
import { Persona } from '../src/modelo/Persona.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';

/*
 * Pruebas de EnlaceVisual (src/vista3d/). No necesitan WebGL.
 */

/**
 * Dos nodos visuales colocados a mano y dos relaciones entre ellos (una en
 * cada sentido, para comprobar que las curvas no se montan).
 *
 * @returns {Object}
 */
function crearElementosDePrueba() {
  const persona = new Persona({ id: "P1" });
  const obra = new ObraDeArte({ id: "A1" });
  const fabrica = new FabricaNodosVisuales();
  const visualPersona = fabrica.crear(new NodoRelevante(persona, 1, 0));
  const visualObra = fabrica.crear(new NodoRelevante(obra, 0.8, 1));
  visualPersona.setPosicion(new THREE.Vector3(0, 0, 0));
  visualObra.setPosicion(new THREE.Vector3(10, 2, 4));
  const autorDe = new TipoRelacion("autor_de", "Autor de", "#4c8bf5");
  const restauradorDe = new TipoRelacion("restaurador_de", "Restaurador de", "#f5a623");
  return {
    visualPersona: visualPersona,
    visualObra: visualObra,
    relacionIda: new Relacion("r1", persona, obra, autorDe, 0.8),
    relacionVuelta: new Relacion("r2", obra, persona, restauradorDe, 0.4)
  };
}

/**
 * @param {EnlaceVisual} enlace
 * @param {number} indice
 * @returns {THREE.Vector3} el punto número "indice" de la línea.
 */
function puntoDeLaLinea(enlace, indice) {
  const atributo = enlace.getLinea().geometry.getAttribute("position");
  return new THREE.Vector3(atributo.getX(indice), atributo.getY(indice), atributo.getZ(indice));
}

prueba("Enlace: la geometría tiene 17 puntos, del origen al destino", function () {
  const e = crearElementosDePrueba();
  const enlace = new EnlaceVisual(e.relacionIda, e.visualPersona, e.visualObra, 0, 1);
  comprobarIgual(enlace.getLinea().geometry.getAttribute("position").count, 17, "número de puntos");
  comprobar(puntoDeLaLinea(enlace, 0).distanceTo(e.visualPersona.getPosicion()) < 1e-5, "el primer punto es el origen");
  comprobar(puntoDeLaLinea(enlace, 16).distanceTo(e.visualObra.getPosicion()) < 1e-5, "el último punto es el destino");
  comprobar(enlace.getLinea().userData.visual === enlace, "userData.visual debe ser el EnlaceVisual");
});

prueba("Enlace: con una relación la línea es recta (el punto central es el punto medio)", function () {
  const e = crearElementosDePrueba();
  const enlace = new EnlaceVisual(e.relacionIda, e.visualPersona, e.visualObra, 0, 1);
  const puntoMedio = new THREE.Vector3(5, 1, 2);
  comprobar(puntoDeLaLinea(enlace, 8).distanceTo(puntoMedio) < 1e-5, "el punto central debería ser (5, 1, 2)");
});

prueba("Enlace: dos relaciones del mismo par dan curvas distintas y simétricas", function () {
  const e = crearElementosDePrueba();
  // Una va de P1 a A1 y la otra de A1 a P1.
  const primera = new EnlaceVisual(e.relacionIda, e.visualPersona, e.visualObra, 0, 2);
  const segunda = new EnlaceVisual(e.relacionVuelta, e.visualObra, e.visualPersona, 1, 2);
  const centroPrimera = puntoDeLaLinea(primera, 8);
  const centroSegunda = puntoDeLaLinea(segunda, 8);
  const puntoMedio = new THREE.Vector3(5, 1, 2);

  comprobar(centroPrimera.distanceTo(centroSegunda) > 1, "los puntos centrales deberían ser distintos");
  // Simétricos: el punto medio está justo entre los dos centros.
  const entreLosDos = centroPrimera.clone().add(centroSegunda).multiplyScalar(0.5);
  comprobar(entreLosDos.distanceTo(puntoMedio) < 1e-5, "los centros deberían ser simétricos respecto al punto medio");
  // Cada centro se separa 0,8 de la recta.
  comprobarIgual(redondear(centroPrimera.distanceTo(puntoMedio)), 0.8, "separación de la primera curva");
});

prueba("Enlace: opacidad 0,25 + 0,75 · relevancia y resaltado", function () {
  const e = crearElementosDePrueba();
  const enlace = new EnlaceVisual(e.relacionVuelta, e.visualObra, e.visualPersona, 0, 1);
  const material = enlace.getLinea().material;
  comprobar(material.transparent, "el material debe ser transparente");
  comprobarIgual(redondear(material.opacity), redondear(0.25 + 0.75 * 0.4), "opacidad con relevancia 0.4");
  enlace.resaltar(true);
  comprobarIgual(material.opacity, 1, "opacidad al resaltar");
  enlace.resaltar(false);
  comprobarIgual(redondear(material.opacity), 0.55, "opacidad sin resaltar");
});

prueba("Enlace: color del tipo de relación", function () {
  const e = crearElementosDePrueba();
  const enlace = new EnlaceVisual(e.relacionIda, e.visualPersona, e.visualObra, 0, 1);
  comprobarIgual(enlace.getLinea().material.color.getHexString(), "4c8bf5", "color de autor_de");
});

prueba("Enlace: actualizar sigue a los nodos cuando se mueven", function () {
  const e = crearElementosDePrueba();
  const enlace = new EnlaceVisual(e.relacionIda, e.visualPersona, e.visualObra, 0, 1);
  e.visualObra.setPosicion(new THREE.Vector3(-4, 0, 0));
  enlace.actualizar();
  comprobar(puntoDeLaLinea(enlace, 16).distanceTo(new THREE.Vector3(-4, 0, 0)) < 1e-5, "el último punto debe seguir al destino");
});
