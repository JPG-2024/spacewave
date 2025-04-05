import { useEffect, useRef } from 'react';
import uiState, { Filters, DeckNames } from '@/store/uiStore';

interface UseFilterOptions {
  deckId: DeckNames;
  activateKey: string; // Tecla que debe mantenerse presionada
  name: keyof Filters;
  onChange?: (value: number) => void; // Función a llamar con el valor actualizado
  min: number; // Valor mínimo permitido
  max: number; // Valor máximo permitido
  sensitivity?: number; // Sensibilidad del movimiento del ratón (opcional, por defecto 1)
  initialValue?: number; // Valor inicial del filtro
  changeOnKeyUp?: boolean; // Cambiar el valor del filtro al soltar la tecla
  thresholdStick?: number; // Umbral para el valor del filtro
}

export function useFilter({
  deckId,
  activateKey,
  name,
  onChange,
  min,
  max,
  sensitivity = (max - min) / 1000,
  initialValue = 0,
  changeOnKeyUp = false,
  thresholdStick = 10,
}: UseFilterOptions) {
  const valueRef = useRef<number>(initialValue); // Valor inicial centrado entre min y max
  const rotationValue = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === activateKey) {
        uiState.decks[deckId].filtersState[name].isActive = true;
        document.body.style.cursor = 'grabbing';
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === activateKey) {
        uiState.decks[deckId].filtersState[name].isActive = false;
        onChange && changeOnKeyUp && onChange(valueRef.current);
        document.body.style.cursor = 'default';
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (uiState.decks[deckId].filtersState[name].isActive) {
        const delta = event.movementX * sensitivity; // Movimiento horizontal del puntero ajustado por sensibilidad

        valueRef.current = valueRef.current + delta;

        let newValue = valueRef.current;

        console.log(
          Math.abs(newValue - initialValue),
          sensitivity * thresholdStick,
        );

        // Threshold logic
        if (Math.abs(newValue - initialValue) < sensitivity * thresholdStick) {
          newValue = initialValue;
        }

        rotationValue.current = rotationValue.current + delta;

        if (newValue < min) newValue = min;
        if (newValue > max) newValue = max;
        valueRef.current = newValue;
        uiState.decks[deckId].filtersState[name].value = newValue;
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
  }, [activateKey, onChange, min, max, sensitivity]);

  return valueRef.current;
}
