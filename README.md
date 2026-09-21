# Intérprete en Vivo

Sitio web estático (sin backend) que transcribe voz en tiempo real y traduce cada
frase automáticamente a medida que se habla. Pensado para usarse durante llamadas
(Zoom, Meet, Teams, etc.).

## Cómo funciona

- **Transcripción en vivo:** usa la [Web Speech API](https://developer.mozilla.org/docs/Web/API/Web_Speech_API)
  del navegador (gratis, sin API keys). Solo funciona en **Google Chrome o Microsoft Edge**.
- **Traducción en vivo:** cada frase final detectada se envía a la API gratuita
  [MyMemory](https://mymemory.translated.net/) y el resultado se muestra en cuanto llega.
- **Captura de audio:** puedes elegir entre "Micrófono" (tu propia voz, funciona de
  inmediato) o "Pestaña / pantalla" (usa `getDisplayMedia` para grabar y medir el
  nivel del audio de una llamada; ver limitación abajo).

## Ejecutar localmente

No requiere build ni dependencias. Sirve la carpeta con cualquier servidor estático
(el micrófono solo funciona sobre `https://` o `http://localhost`):

```bash
npx serve .
# o
python3 -m http.server 8080
```

Luego abre `http://localhost:8080` (o el puerto que indique el servidor) en Chrome o Edge.

## Transcribir el audio de una llamada (no solo tu voz)

Los navegadores no permiten conectar un stream arbitrario (como el audio capturado
de una pestaña) directamente al motor de reconocimiento de voz: este solo escucha el
dispositivo de entrada (micrófono) predeterminado del sistema operativo.

La solución estándar es crear un **dispositivo de audio virtual** que reciba la
salida del sistema y usarlo como micrófono predeterminado:

- **Windows:** activa "Mezcla estéreo" en Configuración de sonido, o instala
  [VB-CABLE](https://vb-audio.com/Cable/), y ponlo como dispositivo de grabación
  predeterminado.
- **macOS:** instala [BlackHole](https://existential.audio/blackhole/) o
  [Loopback](https://rogueamoeba.com/loopback/) y configúralo como entrada
  predeterminada.
- **Linux (PulseAudio/PipeWire):** con `pavucontrol`, en la pestaña "Grabación"
  selecciona "Monitor de..." como fuente para la app, o crea un monitor con
  `pactl load-module module-loopback`.

Con ese dispositivo como entrada predeterminada, elige "Micrófono" en la app: se
transcribirá y traducirá en tiempo real todo el audio del sistema, incluida la
llamada. El modo "Pestaña / pantalla" sigue siendo útil para grabar el audio y
descargarlo al finalizar.

## Límites conocidos

- La Web Speech API depende de un servicio en la nube de Google; requiere conexión
  a internet y no está disponible en Firefox/Safari.
- La API de traducción gratuita (MyMemory) tiene un límite diario de uso anónimo.
  Para uso intensivo, se puede sustituir `translateText()` en `app.js` por otra API
  (DeepL, Google Cloud Translation, etc.).
- El modo "Pestaña / pantalla" no transcribe directamente ese audio (ver sección
  anterior); solo lo graba y mide su nivel.

## Estructura

```
index.html    Estructura de la página
styles.css    Estilos (tema oscuro)
app.js        Lógica: captura de audio, reconocimiento de voz, traducción, UI
```
