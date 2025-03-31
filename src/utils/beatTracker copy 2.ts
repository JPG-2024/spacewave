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
  return new Promise((resolve, reject) => {
    // Configuración inicial igual que antes...
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const offlineContext = new OfflineAudioContext(1, length, sampleRate);

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    const lowPassFilter = offlineContext.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = 150;

    source.connect(lowPassFilter);
    lowPassFilter.connect(offlineContext.destination);

    source.start(0);
    offlineContext
      .startRendering()
      .then(renderedBuffer => {
        const channelData = renderedBuffer.getChannelData(0);

        // Encontrar el pico máximo en el buffer de manera optimizada
        let maxPeak = 0;
        for (let i = 0; i < channelData.length; i++) {
          const absValue = Math.abs(channelData[i]);
          if (absValue > maxPeak) {
            maxPeak = absValue;
          }
        }
        console.log('Pico máximo detectado:', maxPeak);

        // Función para detectar picos similares al máximo
        function findSimilarPeaks(
          data: Float32Array<ArrayBufferLike>,
          maxValue: number,
          tolerance: number = 0.8, // 70% del valor máximo
        ) {
          const peaks: {
            position: number;
            amplitude: number;
            timeInSeconds: number;
          }[] = [];
          const threshold = maxValue * tolerance;
          const minGap = Math.floor(sampleRate * 0.1); // Gap mínimo de 100ms entre picos

          let i = 0;
          while (i < data.length) {
            if (Math.abs(data[i]) > threshold) {
              // Encontrar el valor máximo local en una ventana pequeña
              let localMax = Math.abs(data[i]);
              let localMaxIndex = i;
              const windowSize = 50; // Ventana de 50 muestras

              for (let j = 0; j < windowSize && i + j < data.length; j++) {
                if (Math.abs(data[i + j]) > localMax) {
                  localMax = Math.abs(data[i + j]);
                  localMaxIndex = i + j;
                }
              }

              peaks.push({
                position: localMaxIndex,
                amplitude: localMax,
                timeInSeconds: localMaxIndex / sampleRate,
              });

              i += minGap; // Saltamos el gap mínimo
            } else {
              i++;
            }
          }

          return peaks;
        }

        // Encontrar picos similares al máximo
        const similarPeaks = findSimilarPeaks(channelData, maxPeak);
        console.log('Picos similares encontrados:', similarPeaks);

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
              i += Math.floor(sampleRate * 0.3);
            } else {
              i++;
            }
          }

          return peaks;
        }

        const threshold = 0.5;
        const peaks = getPeaksAtThreshold(channelData, threshold);

        if (peaks.length === 0) {
          return reject(new Error('No se detectaron picos en el audio.'));
        }

        // 1. Detectar secciones sin beats (armonía)
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
          if (gapInSeconds > (60 / 120) * 1.5) {
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
        if (lastPeak < channelData.length) {
          harmonySections.push({
            start: lastPeak / sampleRate,
            end: channelData.length / sampleRate,
            duration: (channelData.length - lastPeak) / sampleRate,
          });
        }

        // Filtrar secciones muy cortas (menos de 0.5 segundos)
        const significantHarmonySections = harmonySections.filter(
          section => section.duration >= 0.5,
        );

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
