import { useEffect, useRef } from 'react';
import uiState from '@/store/uiStore';

interface UseFilterOptions {
  key: string; // Tecla que debe mantenerse presionada
  name: keyof typeof uiState.filters;
  onChange?: (value: number) => void; // Función a llamar con el valor actualizado
  min: number; // Valor mínimo permitido
  max: number; // Valor máximo permitido
  sensitivity?: number; // Sensibilidad del movimiento del ratón (opcional, por defecto 1)
  initialValue?: number; // Valor inicial del filtro
  changeOnKeyUp?: boolean; // Cambiar el valor del filtro al soltar la tecla
  thresholdStick?: number; // Umbral para el valor del filtro
}

export function useFilter({
  key,
  name,
  onChange,
  min,
  max,
  sensitivity = (max - min) / 2000,
  initialValue = 0,
  changeOnKeyUp = false,
}: UseFilterOptions) {
  const valueRef = useRef<number>((initialValue || min + max) / 2); // Valor inicial centrado entre min y max

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === key) {
        uiState.filters[name].isActive = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === key) {
        uiState.filters[name].isActive = false;
        onChange && changeOnKeyUp && onChange(valueRef.current);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (uiState.filters[name].isActive) {
        const delta = event.movementX * sensitivity; // Movimiento horizontal del puntero ajustado por sensibilidad
        valueRef.current = valueRef.current + delta;
        let newValue = valueRef.current;

        // Threshold logic
        if (Math.abs(newValue - initialValue) < sensitivity * 20) {
          newValue = initialValue;
        }

        if (newValue < min) newValue = min;
        if (newValue > max) newValue = max;
        valueRef.current = newValue;
        uiState.filters[name].value = valueRef.current;
        if (!changeOnKeyUp && onChange) {
          onChange(valueRef.current);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [key, onChange, min, max, sensitivity]);

  return valueRef.current;
}
