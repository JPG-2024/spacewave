import { useEffect, useRef, useState } from 'react';

interface UseFilterOptions {
  key: string; // Tecla que debe mantenerse presionada
  onChange?: (value: number) => void; // Función a llamar con el valor actualizado
  min: number; // Valor mínimo permitido
  max: number; // Valor máximo permitido
  sensitivity?: number; // Sensibilidad del movimiento del ratón (opcional, por defecto 1)
}

export function useFilter({
  key,
  onChange,
  min,
  max,
  sensitivity = 0.0005,
}: UseFilterOptions) {
  const [value, setValue] = useState((min + max) / 2); // Valor inicial centrado entre min y max
  const isKeyPressed = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === key) {
        isKeyPressed.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === key) {
        isKeyPressed.current = false;
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isKeyPressed.current) {
        const delta = event.movementX * sensitivity; // Movimiento horizontal del puntero ajustado por sensibilidad
        setValue(prevValue => {
          let newValue = prevValue + delta;
          if (newValue < min) newValue = min;
          if (newValue > max) newValue = max;
          if (onChange) onChange(newValue);

          return newValue;
        });
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

  return value;
}
