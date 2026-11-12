# Reglas del proyecto
- Stack: Vite + Vanilla JS (sin React/Vue), usando pdf-lib y pdfjs-dist.
- Todo el procesamiento ocurre 100% en el navegador (cero backend).
- Código modular: separa la manipulación de PDFs en src/pdfService.js y la interfaz en src/main.js.
- Respuestas cortas y directas; después de cada cambio importante, verifica que npm run build compile sin errores.
