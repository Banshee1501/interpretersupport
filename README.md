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

### Windows + audífonos Bluetooth (solo audio del sistema, sin tu voz)

Si usas audífonos Bluetooth y solo quieres transcribir lo que dicen los demás (no
tu propia voz), "Mezcla estéreo" normalmente **no funciona** con salida Bluetooth
(solo capta la placa de sonido interna). Usa **VB-CABLE** así:

1. Instala [VB-CABLE](https://vb-audio.com/Cable/) (gratis) y reinicia Windows si
   lo pide.
2. *Configuración de sonido* → Salida: pon **"CABLE Input (VB-Audio Virtual
   Cable)"** como dispositivo de reproducción predeterminado. Ahora todo el audio
   del sistema (la llamada incluida) va a VB-CABLE en vez de a tus audífonos.
3. Para seguir escuchando por tus audífonos: *Panel de control* → Sonido →
   pestaña **Grabación** → clic derecho en **"CABLE Output"** → Propiedades →
   pestaña **Escuchar** → marca "Escuchar este dispositivo" → en "Reproducir a
   través de" elige tus audífonos Bluetooth → Aceptar.
4. *Configuración de sonido* → Entrada: pon **"CABLE Output (VB-Audio Virtual
   Cable)"** como dispositivo de grabación predeterminado.
5. En la app de la llamada (Zoom/Meet/Teams), selecciona manualmente tus
   audífonos Bluetooth reales como micrófono (no "Predeterminado"), para que tu
   voz siga yendo normal a la llamada.
6. En el sitio, elige "Micrófono": transcribirá/traducirá solo lo que suena por
   el sistema (los demás participantes), nunca tu propia voz.

Revisa antes de cada llamada que el micrófono de la app de videollamada siga
apuntando a tus audífonos Bluetooth (Windows a veces lo resetea al reconectar el
Bluetooth).

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
