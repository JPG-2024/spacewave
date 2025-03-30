interface HarmonySection {
  start: number;
  end: number;
  duration: number;
}

/**
 * detectBeat analiza un AudioBuffer y devuelve una promesa que resuelve un objeto con:
 * - tempo: BPM detectado.
 * - offset: Tiempo (en segundos) del primer beat.
 * - beatInterval: Tiempo (en segundos) entre beats (60 / tempo).
 *
 * Se asume:
 *   • El análisis se realiza en mono.
 *   • Se utiliza un filtro low-pass para enfatizar las percusiones.
 *
 * @param {AudioBuffer} audioBuffer - Buffer original de audio.
 * @returns {Promise<Object>} Objeto con { tempo, offset, beatInterval }.
 */
export async function detectBeat(audioBuffer: AudioBuffer): Promise<{
  tempo: number;
  firstBeatOffset: number;
  beatInterval: number;
  harmonySections: HarmonySection[];
  beats: number[];
}> {
  return new Promise(async (resolve, reject) => {
    // Configuración inicial igual que antes...
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const offlineContext = new OfflineAudioContext(1, length, sampleRate);

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const analysisContext = new OfflineAudioContext(
      1,
      sampleRate * 5,
      sampleRate,
    ); // Analizar 5 segundos
    const analysisSource = analysisContext.createBufferSource();
    // Extraer los primeros 5 segundos del audioBuffer original
    const segmentLength = Math.min(audioBuffer.length, sampleRate * 5);
    const segmentBuffer = analysisContext.createBuffer(
      1,
      segmentLength,
      sampleRate,
    );
    // Copiar datos (asumiendo que audioBuffer ya es mono o tomas un canal)
    audioBuffer.copyFromChannel(segmentBuffer.getChannelData(0), 0, 0); // Copia desde el inicio
    analysisSource.buffer = segmentBuffer;

    const analyser = analysisContext.createAnalyser();
    analyser.fftSize = 2048; // Tamaño común para FFT
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength); // Para guardar los datos de frecuencia

    analysisSource.connect(analyser);
    // No necesitamos conectar al destination si solo queremos analizar
    analysisSource.start(0);

    // Renderizar para obtener los datos del analizador
    await analysisContext.startRendering();
    analyser.getByteFrequencyData(dataArray); // Obtener datos de frecuencia

    // Encontrar el pico en el rango bajo (ej: 40Hz - 200Hz)
    let maxVal = -1;
    let maxIndex = -1;
    const nyquist = sampleRate / 2;
    const lowHz = 40;
    const highHz = 200;

    for (let i = 0; i < bufferLength; i++) {
      const freq = (i * nyquist) / bufferLength;
      if (freq >= lowHz && freq <= highHz) {
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          maxIndex = i;
        }
      }
      if (freq > highHz) break; // Optimización: salir si ya pasamos el rango
    }

    let estimatedFrequency = (maxIndex * nyquist) / bufferLength;
    let dynamicCutoff = 120; // Valor por defecto

    if (maxIndex !== -1) {
      // Calcular el cutoff: un poco por encima del pico detectado
      dynamicCutoff = estimatedFrequency + 40; // Añadir un margen
      // Limitar el valor a un rango razonable
      dynamicCutoff = Math.max(80, Math.min(180, dynamicCutoff));
      console.log(
        `Frecuencia baja dominante estimada: ${estimatedFrequency.toFixed(1)} Hz. Ajustando filtro a: ${dynamicCutoff.toFixed(1)} Hz`,
      );
    } else {
      console.log(
        'No se detectó un pico claro de baja frecuencia, usando valor por defecto.',
      );
    }

    const lowPassFilter = offlineContext.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = dynamicCutoff;

    source.connect(lowPassFilter);
    lowPassFilter.connect(offlineContext.destination);

    source.start(0);
    offlineContext
      .startRendering()
      .then(renderedBuffer => {
        const channelData = renderedBuffer.getChannelData(0);

        function getPeaksAtThreshold(
          data: Float32Array<ArrayBufferLike>,
          threshold: number,
        ) {
          const peaks: number[] = [];
          const len = data.length;
          let i = 0;
          while (i < len) {
            if (data[i] > threshold) {
              peaks.push(i);
              i += Math.floor(sampleRate * 0.25);
            } else {
              i++;
            }
          }
          return peaks;
        }

        const threshold = 0.3;
        const peaks = getPeaksAtThreshold(channelData, threshold);

        if (peaks.length === 0) {
          return reject(new Error('No se detectaron picos en el audio.'));
        }

        // Calculamos los intervalos entre picos. Se analiza, por cada pico, los siguientes 10 para obtener una mejor estadística.
        const intervalCounts: { interval: number; count: number }[] = [];

        peaks.forEach((peak, index) => {
          for (let i = 1; i <= 10; i++) {
            if (index + i < peaks.length) {
              const interval = peaks[index + i] - peak;
              // Buscamos si ya se ha registrado este intervalo (exacto).
              let found = false;
              for (let j = 0; j < intervalCounts.length; j++) {
                if (intervalCounts[j].interval === interval) {
                  intervalCounts[j].count++;
                  found = true;
                  break;
                }
              }
              if (!found) {
                intervalCounts.push({ interval, count: 1 });
              }
            }
          }
        });

        // Agrupamos los intervalos según el tempo que sugieren.
        const tempoCounts: { tempo: number; count: number }[] = [];

        intervalCounts.forEach(({ interval, count }) => {
          // Convertimos el intervalo (en muestras) a segundos.
          const seconds = interval / sampleRate;
          // Teórico tempo en BPM.
          let theoreticalTempo = 60 / seconds;
          // Ajustamos el tempo para que esté entre 90 y 180 BPM (multiplicando o dividiendo por 2).
          while (theoreticalTempo < 90) theoreticalTempo *= 2;
          while (theoreticalTempo > 180) theoreticalTempo /= 2;
          // Redondeamos para evitar pequeñas variaciones.
          theoreticalTempo = Math.round(theoreticalTempo);

          // Sumamos el recuento en el histograma.
          let existing = tempoCounts.find(tc => tc.tempo === theoreticalTempo);
          if (existing) {
            existing.count += count;
          } else {
            tempoCounts.push({ tempo: theoreticalTempo, count });
          }
        });

        tempoCounts.sort((a, b) => b.count - a.count);
        const detectedTempo = tempoCounts.length ? tempoCounts[0].tempo : null;

        if (!detectedTempo) {
          return reject(new Error('No se pudo determinar el tempo.'));
        }

        const beatInterval = 60 / detectedTempo;
        const offset = peaks[0] / sampleRate;

        // Llamar a la función para detectar secciones armónicas
        const significantHarmonySections = detectHarmonySections(
          peaks,
          sampleRate,
          channelData.length,
          detectedTempo,
        );

        // Devolver tanto la información de beats como de secciones armónicas
        resolve({
          tempo: detectedTempo,
          firstBeatOffset: offset,
          beatInterval: beatInterval,
          harmonySections: significantHarmonySections, // Secciones sin beats
          beats: peaks.map(peak => peak / sampleRate), // Todos los beats detectados
        });
      })
      .catch(err => {
        reject(err);
      });
  });
}

function detectHarmonySections(
  peaks: number[],
  sampleRate: number,
  channelLength: number,
  tempo: number = 120,
): HarmonySection[] {
  const harmonySections: HarmonySection[] = [];
  let lastPeak = 0;

  // Añadir sección inicial si existe (desde 0 hasta el primer beat)
  if (peaks[0] > 0) {
    harmonySections.push({
      start: 0,
      end: peaks[0] / sampleRate,
      duration: peaks[0] / sampleRate,
    });
  }

  // Analizar espacios entre beats
  for (let i = 1; i < peaks.length; i++) {
    const prevPeak = peaks[i - 1];
    const currentPeak = peaks[i];
    const gap = currentPeak - prevPeak;
    const gapInSeconds = gap / sampleRate;

    // Consideramos sección de armonía si el gap es significativamente mayor que el beatInterval esperado
    if (gapInSeconds > (60 / tempo) * 1.5) {
      // 1.5 veces el intervalo de un tempo moderado (120 BPM)
      harmonySections.push({
        start: prevPeak / sampleRate,
        end: currentPeak / sampleRate,
        duration: gapInSeconds,
      });
    }
    lastPeak = currentPeak;
  }

  // Añadir sección final si existe (desde el último beat hasta el final)
  if (lastPeak < channelLength) {
    harmonySections.push({
      start: lastPeak / sampleRate,
      end: channelLength / sampleRate,
      duration: (channelLength - lastPeak) / sampleRate,
    });
  }

  // Filtrar secciones muy cortas (menos de 0.5 segundos)
  return harmonySections.filter(section => section.duration >= 0.5); // 0.5 seconds threshold for filtering short sections
}
