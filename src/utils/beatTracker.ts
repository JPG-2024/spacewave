interface HarmonySection {
  start: number;
  end: number;
  duration: number;
}

const MINIMUN_TEMPO = 120.0;
const MAXIMUM_TEMPO = 150.0;

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

        // Find maximum peak
        const maxPeak = channelData.reduce(
          (max, value) => Math.max(max, value),
          0,
        );

        // Find similar peaks function remains unchanged
        function findSimilarPeaks(
          data: Float32Array,
          maxValue: number,
          tolerance: number = 0.8,
        ) {
          const peaks: {
            position: number;
            amplitude: number;
            timeInSeconds: number;
          }[] = [];
          const threshold = maxValue * tolerance;
          const minGap = Math.floor(sampleRate * 0.1);

          let i = 0;
          while (i < data.length) {
            if (Math.abs(data[i]) > threshold) {
              let localMax = Math.abs(data[i]);
              let localMaxIndex = i;
              const windowSize = 50;

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

              i += minGap;
            } else {
              i++;
            }
          }

          return peaks;
        }

        const similarPeaks = findSimilarPeaks(channelData, maxPeak);

        console.log(similarPeaks);
        // Detectar gaps largos (más de 4 segundos)
        const longGapSections: HarmonySection[] = [];
        const LONG_GAP_THRESHOLD = 4; // 4 segundos

        for (let i = 1; i < similarPeaks.length; i++) {
          const prevPeak = similarPeaks[i - 1];
          const currentPeak = similarPeaks[i];
          const gapDuration =
            currentPeak.timeInSeconds - prevPeak.timeInSeconds;

          if (gapDuration > LONG_GAP_THRESHOLD) {
            longGapSections.push({
              start: prevPeak.timeInSeconds,
              end: currentPeak.timeInSeconds,
              duration: gapDuration,
            });
          }
        }

        // También verificar si hay un gap largo al inicio o final del audio
        const audioDuration = channelData.length / sampleRate;

        // Gap al inicio
        if (similarPeaks[0].timeInSeconds > LONG_GAP_THRESHOLD) {
          longGapSections.unshift({
            start: 0,
            end: similarPeaks[0].timeInSeconds,
            duration: similarPeaks[0].timeInSeconds,
          });
        }

        // Gap al final
        const lastPeak = similarPeaks[similarPeaks.length - 1];
        if (audioDuration - lastPeak.timeInSeconds > LONG_GAP_THRESHOLD) {
          longGapSections.push({
            start: lastPeak.timeInSeconds,
            end: audioDuration,
            duration: audioDuration - lastPeak.timeInSeconds,
          });
        }

        if (similarPeaks.length === 0) {
          return reject(new Error('No se detectaron picos en el audio.'));
        }

        // Rest of the tempo calculation remains the same
        const intervalMap = new Map<number, number>();
        for (let i = 0; i < similarPeaks.length - 1; i++) {
          const interval =
            similarPeaks[i + 1].timeInSeconds - similarPeaks[i].timeInSeconds;
          intervalMap.set(interval, (intervalMap.get(interval) || 0) + 1);
        }

        const intervalCounts = Array.from(intervalMap, ([interval, count]) => ({
          interval,
          count,
        }));

        const tempoCounts: { tempo: number; count: number }[] = [];
        intervalCounts.forEach(({ interval, count }) => {
          let theoreticalTempo = 60 / interval;
          theoreticalTempo = Number(theoreticalTempo.toFixed(2));

          let existing = tempoCounts.find(tc => tc.tempo === theoreticalTempo);
          if (existing) {
            existing.count += count;
          } else {
            tempoCounts.push({ tempo: theoreticalTempo, count });
          }
        });

        tempoCounts.sort((a, b) => b.count - a.count);

        console.log(tempoCounts);

        // Con este código:
        const validTempos = tempoCounts.filter(
          tc => tc.tempo >= MINIMUN_TEMPO && tc.tempo <= MAXIMUM_TEMPO,
        );

        let detectedTempo = null;

        if (validTempos.length >= 2) {
          detectedTempo = Number(
            ((validTempos[0].tempo + validTempos[1].tempo) / 2).toFixed(2),
          );
        } else if (validTempos.length === 1) {
          detectedTempo = validTempos[0].tempo;
        } else if (tempoCounts.length >= 2) {
          detectedTempo = Number(
            ((tempoCounts[0].tempo + tempoCounts[1].tempo) / 2).toFixed(2),
          );
        } else if (tempoCounts.length === 1) {
          detectedTempo = tempoCounts[0].tempo;
        }

        if (!detectedTempo) {
          return reject(new Error('No se pudo determinar el tempo.'));
        }

        console.log(detectedTempo);

        const beatInterval = 60 / detectedTempo;
        const offset = similarPeaks[0].timeInSeconds;

        console.log('detectedTempo', detectedTempo);

        resolve({
          tempo: detectedTempo,
          firstBeatOffset: offset,
          beatInterval: beatInterval,
          harmonySections: longGapSections,
          beats: similarPeaks.map(peak => peak.timeInSeconds),
        });
      })
      .catch(err => {
        reject(err);
      });
  });
}
