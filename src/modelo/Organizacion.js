import { Entidad } from './Entidad.js';
import { TipoEntidad } from './TipoEntidad.js';

/**
 * Una organización (:Organization): museo, academia, taller... La fundación
 * (evento Fund) y la sede (Ubication) no son campos: se ven en el detalle.
 */
export class Organizacion extends Entidad {
  constructor(datos) {
    super(datos);
  }

  getTipo() {
    return TipoEntidad.ORGANIZACION;
  }
}
