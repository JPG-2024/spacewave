import React, { useState, useEffect } from 'react';
import './GainFilter.styles.css';

interface GainFilterProps {
  initialValue?: number;
  min?: number;
  max?: number;
  onChange: (newValue: number) => void;
}

const GainFilter: React.FC<GainFilterProps> = ({
  initialValue = 0,
  min = -30,
  max = 10,
  onChange,
}) => {
  const [value, setValue] = useState(initialValue);
  const [holdingQ, setHoldingQ] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') {
        setHoldingQ(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') {
        setHoldingQ(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    setValue(newValue);
    onChange(newValue);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (holdingQ) {
      e.preventDefault();
      // Sensibilidad de la rueda (ajustar según se requiera)
      const scrollSensitivity = 0.01;
      let newValue = value - e.deltaY * scrollSensitivity;

      if (newValue < min) newValue = min;
      if (newValue > max) newValue = max;

      setValue(newValue / 2);
      onChange(newValue / 2);
    }
  };

  return (
    <div className="gain-filter" onWheel={handleWheel}>
      <label htmlFor="gain">Gain:</label>
      <input
        type="range"
        id="gain"
        min={min}
        max={max}
        step="0.01"
        value={value}
        onChange={handleChange}
      />
      <span>{value.toFixed(2)}</span>
    </div>
  );
};

export default GainFilter;
