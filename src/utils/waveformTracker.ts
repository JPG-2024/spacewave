import { detectBeat } from '@/utils/beatTracker';

export async function generateWaveformData({
  audioBuffer,
  pixelsPerSecond = 500,
}) {
  const tempoData = await detectBeat(audioBuffer);

  return new Promise((resolve, reject) => {
    try {
      const pointsArray = audioBuffer.getChannelData(0);

      const totalPixelsWidth = Math.ceil(
        audioBuffer.duration * pixelsPerSecond,
      ); // Total pixels (unit: pixels)
      const pixelLength = Math.round(pointsArray.length / totalPixelsWidth); // Samples per pixel (unit: samples)
      const samplesPerBeat = Math.ceil(
        audioBuffer.sampleRate * tempoData.beatInterval,
      ); // Samples per beat (unit: samples)
      const sampleSize = Math.min(
        samplesPerBeat,
        Math.ceil(
          (audioBuffer.duration * audioBuffer.sampleRate) / totalPixelsWidth,
        ),
      ); // Sample size (unit: samples)
      const points = []; // Array to store waveform data points
      const maxSampleSize = 1000; // Maximum sample size (unit: samples)

      const _sampleSize = sampleSize || Math.min(pixelLength, maxSampleSize); // Final sample size (unit: samples)

      // Loop through each pixel to calculate the waveform data
      for (let i = 0; i < totalPixelsWidth; i++) {
        let posSum = 0; // Sum of positive values for the current pixel
        let negSum = 0; // Sum of negative values for the current pixel

        // Loop through the audio samples corresponding to the current pixel
        for (let j = 0; j < _sampleSize; j++) {
          const index = Math.min(i * pixelLength + j, pointsArray.length - 1); // Index of the audio sample (unit: index)
          const val = pointsArray[index]; // Value of the audio sample (unit: amplitude)

          // Accumulate positive and negative values separately
          if (val > 0) {
            posSum += val; // Positive amplitude sum
          } else {
            negSum += val; // Negative amplitude sum
          }
        }

        // Calculate the average positive and negative values for the pixel
        points.push(posSum / _sampleSize, negSum / _sampleSize); // Push consecutive normalized amplitudes
      }

      resolve({ waveformData: points, tempoData }); // Resolve the promise with the waveform data
    } catch (error) {
      reject(error); // Reject the promise in case of an error
    }
  });
}

export function generateWaveformSVG(
  waveformData,
  {
    width = 200,
    height = 30,
    color = '#ea31ff',
    normalize = true,
    amplification = 1, // Factor de amplificación para las ondas
  } = {},
) {
  // Extraer solo los valores positivos (índices pares)
  const positiveData = [];
  for (let i = 0; i < waveformData.length; i += 2) {
    positiveData.push(waveformData[i]);
  }

  // Normalizar datos si es necesario
  let displayData = positiveData;
  if (normalize) {
    const maxValue = Math.max(...positiveData, 0.001); // Evitar división por cero
    displayData = positiveData.map(value => value / maxValue);
  }

  // Calcular relación de muestras por píxel
  const samplesPerPixel = Math.max(1, displayData.length / width);
  const svgWidth = Math.min(width, displayData.length);

  // Crear path data optimizado
  let pathData = '';
  for (let i = 0; i < svgWidth; i++) {
    // Promediar muestras para este píxel
    const start = Math.floor(i * samplesPerPixel);
    const end = Math.floor((i + 1) * samplesPerPixel);
    const segment = displayData.slice(start, end);
    const avgValue =
      segment.reduce((sum, val) => sum + val, 0) / segment.length || 0;

    // Aplicar amplificación al valor promedio
    const amplifiedValue = avgValue * amplification;

    const y = height - amplifiedValue * height;

    if (i === 0) {
      pathData += `M ${i} ${y} `;
    } else {
      pathData += `L ${i} ${y} `;
    }
  }

  // Generar SVG
  return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${svgWidth} ${height}" 
             preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path d="${pathData} V ${height} L 0 ${height} Z" fill="${color}" />
        </svg>
    `;
}
