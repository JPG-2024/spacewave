import { detectBeat } from '@/utils/beatTracker';

export interface WaveformDataGenerator {
  audioBuffer: AudioBuffer;
  pixelsPerSecond?: number;
}

export async function generateWaveformData({
  audioBuffer,
  pixelsPerSecond = 500,
}: WaveformDataGenerator): Promise<{ waveformData: number[]; tempoData: any }> {
  const tempoData = await detectBeat(audioBuffer);

  return new Promise<{ waveformData: number[]; tempoData: any }>(
    (resolve, reject) => {
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
        const points: number[] = []; // Array to store waveform data points
        const maxSampleSize = 200; // Maximum sample size (unit: samples)

        // Use samplesPerBeat directly for the sampling size, capped by maxSampleSize
        const _sampleSize = Math.min(samplesPerBeat, maxSampleSize);

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
    },
  );
}
