interface WaveformSVGOptions {
  width?: number;
  height?: number;
  color?: string;
  normalize?: boolean;
  amplification?: number; // Factor de amplificación para las ondas
}

export function generateWaveformSVG(
  waveformData: number[],
  {
    width = 200,
    height = 30,
    color = '#ea31ff',
    normalize = true,
    amplification = 1,
  }: WaveformSVGOptions = {},
): string {
  // Added return type
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
