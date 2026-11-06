(() => {
  "use strict";

  const LANGUAGES = [
    { code: "es", label: "Español", bcp47: "es-ES" },
    { code: "en", label: "Inglés", bcp47: "en-US" },
    { code: "pt", label: "Portugués", bcp47: "pt-PT" },
    { code: "fr", label: "Francés", bcp47: "fr-FR" },
    { code: "de", label: "Alemán", bcp47: "de-DE" },
    { code: "it", label: "Italiano", bcp47: "it-IT" },
    { code: "ja", label: "Japonés", bcp47: "ja-JP" },
    { code: "zh", label: "Chino (mandarín)", bcp47: "zh-CN" },
    { code: "ru", label: "Ruso", bcp47: "ru-RU" },
    { code: "ko", label: "Coreano", bcp47: "ko-KR" },
    { code: "ar", label: "Árabe", bcp47: "ar-SA" },
    { code: "nl", label: "Neerlandés", bcp47: "nl-NL" },
    { code: "pl", label: "Polaco", bcp47: "pl-PL" },
    { code: "tr", label: "Turco", bcp47: "tr-TR" },
    { code: "hi", label: "Hindi", bcp47: "hi-IN" },
  ];

  const el = {
    sourceSelect: document.getElementById("sourceSelect"),
    langFrom: document.getElementById("langFrom"),
    langTo: document.getElementById("langTo"),
    startBtn: document.getElementById("startBtn"),
    stopBtn: document.getElementById("stopBtn"),
    clearBtn: document.getElementById("clearBtn"),
    status: document.getElementById("status"),
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText"),
    banner: document.getElementById("banner"),
    transcriptBody: document.getElementById("transcriptBody"),
    translationBody: document.getElementById("translationBody"),
    levelWrap: document.getElementById("levelWrap"),
    levelFill: document.getElementById("levelFill"),
    downloadLink: document.getElementById("downloadLink"),
  };

  function populateLanguageSelects() {
    for (const lang of LANGUAGES) {
      const opt1 = document.createElement("option");
      opt1.value = lang.code;
      opt1.textContent = lang.label;
      el.langFrom.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = lang.code;
      opt2.textContent = lang.label;
      el.langTo.appendChild(opt2);
    }
    el.langFrom.value = "es";
    el.langTo.value = "en";
  }

  function langByCode(code) {
    return LANGUAGES.find((l) => l.code === code);
  }

  function showBanner(message, type) {
    el.banner.textContent = message;
    el.banner.hidden = false;
    el.banner.className = "banner" + (type === "danger" ? " danger" : "");
  }

  function hideBanner() {
    el.banner.hidden = true;
  }

  function setStatus(state, text) {
    el.statusText.textContent = text;
    el.status.classList.remove("listening", "error");
    if (state) el.status.classList.add(state);
  }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognition = null;
  let shouldListen = false;
  let restartTimer = null;

  let audioStream = null;
  let audioContext = null;
  let analyser = null;
  let levelRafId = null;

  let mediaRecorder = null;
  let recordedChunks = [];

  let interimEl = null;

  function clearPanels() {
    el.transcriptBody.innerHTML = '<p class="placeholder">La transcripción aparecerá aquí en cuanto inicies…</p>';
    el.translationBody.innerHTML = '<p class="placeholder">La traducción aparecerá aquí a medida que se procese cada frase…</p>';
    interimEl = null;
  }

  function ensureEmptyPlaceholderRemoved(container) {
    const ph = container.querySelector(".placeholder");
    if (ph) ph.remove();
  }

  function appendFinalTranscript(text) {
    ensureEmptyPlaceholderRemoved(el.transcriptBody);
    if (interimEl) {
      interimEl.remove();
      interimEl = null;
    }
    const p = document.createElement("p");
    p.className = "final-line";
    p.textContent = text;
    el.transcriptBody.appendChild(p);
    el.transcriptBody.scrollTop = el.transcriptBody.scrollHeight;
    return p;
  }

  function setInterimTranscript(text) {
    ensureEmptyPlaceholderRemoved(el.transcriptBody);
    if (!interimEl) {
      interimEl = document.createElement("p");
      interimEl.className = "interim-line";
      el.transcriptBody.appendChild(interimEl);
    }
    interimEl.textContent = text;
    el.transcriptBody.scrollTop = el.transcriptBody.scrollHeight;
  }

  function appendPendingTranslation() {
    ensureEmptyPlaceholderRemoved(el.translationBody);
    const p = document.createElement("p");
    p.className = "translated-line";
    const span = document.createElement("span");
    span.className = "pending";
    span.textContent = "Traduciendo…";
    p.appendChild(span);
    el.translationBody.appendChild(p);
    el.translationBody.scrollTop = el.translationBody.scrollHeight;
    return p;
  }

  function fillTranslation(node, text) {
    node.textContent = text;
    el.translationBody.scrollTop = el.translationBody.scrollHeight;
  }

  // ---------------------------------------------------------------------
  // Translation (MyMemory free API, no key required)
  // ---------------------------------------------------------------------
  async function translateText(text, fromCode, toCode) {
    if (fromCode === toCode) return text;
    const url =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) +
      "&langpair=" +
      encodeURIComponent(fromCode) +
      "|" +
      encodeURIComponent(toCode);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fallo de red al traducir (" + res.status + ")");
    const data = await res.json();
    const translated = data && data.responseData && data.responseData.translatedText;
    if (!translated) throw new Error("Respuesta de traducción vacía");
    return translated;
  }

  async function handleFinalUtterance(text) {
    if (!text.trim()) return;
    appendFinalTranscript(text);
    const node = appendPendingTranslation();
    try {
      const translated = await translateText(text, el.langFrom.value, el.langTo.value);
      fillTranslation(node, translated);
    } catch (err) {
      fillTranslation(node, "(No se pudo traducir: " + err.message + ")");
    }
  }

  // ---------------------------------------------------------------------
  // Speech recognition
  // ---------------------------------------------------------------------
  function createRecognition() {
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langByCode(el.langFrom.value).bcp47;

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          handleFinalUtterance(text.trim());
        } else {
          interim += text;
        }
      }
      if (interim) setInterimTranscript(interim);
    };

    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        showBanner("Permiso de micrófono denegado. Actívalo para poder transcribir.", "danger");
        stopListening();
        return;
      }
      showBanner("Error del reconocimiento de voz: " + event.error, "danger");
    };

    rec.onend = () => {
      if (shouldListen) {
        restartTimer = setTimeout(() => {
          try {
            rec.start();
          } catch (e) {
            /* already started, ignore */
          }
        }, 250);
      }
    };

    return rec;
  }

  // ---------------------------------------------------------------------
  // Audio level metering
  // ---------------------------------------------------------------------
  function startLevelMeter(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    el.levelWrap.hidden = false;

    function tick() {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const pct = Math.min(100, Math.round(rms * 220));
      el.levelFill.style.width = pct + "%";
      levelRafId = requestAnimationFrame(tick);
    }
    tick();
  }

  function stopLevelMeter() {
    if (levelRafId) cancelAnimationFrame(levelRafId);
    levelRafId = null;
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
    el.levelWrap.hidden = true;
    el.levelFill.style.width = "0%";
  }

  // ---------------------------------------------------------------------
  // Recording (tab/screen mode only, for later playback)
  // ---------------------------------------------------------------------
  function startRecording(stream) {
    recordedChunks = [];
    try {
      mediaRecorder = new MediaRecorder(stream);
    } catch (e) {
      mediaRecorder = null;
      return;
    }
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      if (recordedChunks.length) {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        el.downloadLink.href = url;
        el.downloadLink.hidden = false;
      }
    };
    mediaRecorder.start(1000);
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    mediaRecorder = null;
  }

  // ---------------------------------------------------------------------
  // Start / stop
  // ---------------------------------------------------------------------
  async function startListening() {
    hideBanner();
    el.downloadLink.hidden = true;

    if (!SpeechRecognitionImpl) {
      showBanner(
        "Tu navegador no soporta reconocimiento de voz en vivo. Usa Google Chrome o Microsoft Edge.",
        "danger"
      );
      return;
    }

    const mode = el.sourceSelect.value;

    try {
      if (mode === "tab") {
        audioStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length === 0) {
          showBanner(
            'No se compartió audio. Vuelve a intentar y marca la casilla "Compartir audio de la pestaña/sistema".',
            "danger"
          );
          audioStream.getTracks().forEach((t) => t.stop());
          audioStream = null;
          return;
        }
        audioStream.getVideoTracks().forEach((t) => (t.enabled = false));
        startLevelMeter(audioStream);
        startRecording(audioStream);
        showBanner(
          "Grabando audio de la pestaña/sistema. La transcripción en vivo sigue escuchando el micrófono " +
            "predeterminado del sistema operativo (ver ayuda abajo para enrutar el audio de la llamada como entrada)."
        );
        audioStream.getVideoTracks().forEach((t) =>
          t.addEventListener("ended", () => {
            if (shouldListen) stopListening();
          })
        );
      } else {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startLevelMeter(audioStream);
      }
    } catch (err) {
      showBanner("No se pudo acceder al audio: " + err.message, "danger");
      return;
    }

    recognition = createRecognition();
    shouldListen = true;
    try {
      recognition.start();
    } catch (e) {
      /* ignore double-start */
    }

    setStatus("listening", "Escuchando…");
    el.startBtn.disabled = true;
    el.stopBtn.disabled = false;
    el.sourceSelect.disabled = true;
    el.langFrom.disabled = true;
  }

  function stopListening() {
    shouldListen = false;
    if (restartTimer) clearTimeout(restartTimer);

    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }

    stopRecording();
    stopLevelMeter();

    if (audioStream) {
      audioStream.getTracks().forEach((t) => t.stop());
      audioStream = null;
    }

    setStatus(null, "Detenido");
    el.startBtn.disabled = false;
    el.stopBtn.disabled = true;
    el.sourceSelect.disabled = false;
    el.langFrom.disabled = false;

    if (interimEl) {
      interimEl.remove();
      interimEl = null;
    }
  }

  // ---------------------------------------------------------------------
  // Wire up
  // ---------------------------------------------------------------------
  populateLanguageSelects();

  if (!SpeechRecognitionImpl) {
    showBanner(
      "Tu navegador no soporta reconocimiento de voz en vivo (Web Speech API). Usa Google Chrome o Microsoft Edge para la transcripción en tiempo real.",
      "danger"
    );
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    const tabOption = el.sourceSelect.querySelector('option[value="tab"]');
    if (tabOption) tabOption.disabled = true;
  }

  el.startBtn.addEventListener("click", startListening);
  el.stopBtn.addEventListener("click", stopListening);
  el.clearBtn.addEventListener("click", clearPanels);
})();
