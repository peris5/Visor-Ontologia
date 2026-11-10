import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: así la aplicación publicada funciona aunque esté en una
  // subcarpeta del servidor (por ejemplo https://servidor/visor/).
  base: './',

  build: {
    rollupOptions: {
      // Las dos páginas de la aplicación.
      input: {
        principal: 'index.html',
        pruebas: 'pruebas.html'
      }
    }
  },

  server: {
    // Durante el desarrollo, Vite (puerto 5173) reenvía al servidor Python
    // (puerto 8000) todas las peticiones que empiezan por /api. Así, para el
    // navegador, la página y la API parecen estar en el mismo sitio y no da
    // errores de CORS (que saltan cuando una página pide datos a otro origen).
    //
    // Se escribe 127.0.0.1 y no "localhost": en Windows, Node traduce
    // "localhost" a la dirección IPv6 (::1), mientras que uvicorn escucha
    // solo en IPv4 (127.0.0.1), y el proxy no encontraría el servidor.
    proxy: {
      '/api': 'http://127.0.0.1:8000'
    }
  }
});
