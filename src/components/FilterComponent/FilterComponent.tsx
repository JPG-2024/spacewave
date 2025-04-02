import React from 'react';
import './FilterComponent.styles.css';
import { useSnapshot } from 'valtio';
import uiState, { FiltersNames } from '@/store/uiStore';
import { useFilter } from '@/hooks/useFilter';

interface FilterComponentProps {
  activateKey: string;
  name: FiltersNames;
  min?: number;
  max?: number;
  sensitivity?: number;
  initialValue?: number;
  changeOnKeyUp?: boolean;
  thresholdStick?: number;
  handleReset?: () => void;
  type: 'bassGain' | 'midGain' | 'trebleGain' | 'colorFX' | 'tempo';
  deck: any; // Idealmente deberíamos tipar esto correctamente con el tipo de deck
  showReset?: boolean;
}

const FilterComponent: React.FC<FilterComponentProps> = ({
  name,
  activateKey,
  min = -1,
  max = 1,
  sensitivity,
  initialValue = 0,
  changeOnKeyUp = false,
  thresholdStick,
  type,
  deck,
  showReset = true,
}) => {
  const handleChange = (value: number) => {
    switch (type) {
      case 'bassGain':
        deck?.setBassGain(value * 20);
        break;
      case 'midGain':
        deck?.setMidGain(value * 20);
        break;
      case 'trebleGain':
        deck?.setTrebleGain(value * 20);
        break;
      case 'colorFX':
        const adjustedValue = 1000 + value * 7000;
        deck?.setColorFX(adjustedValue, value * 15, value * 0.1);
        break;
      case 'tempo':
        deck?.changeTempo(value);
        break;
    }
  };

  const handleReset = () => {
    if (!showReset) return;
    uiState.filters[name].value = initialValue;
    handleChange(initialValue);
  };

  useFilter({
    activateKey,
    name,
    onChange: handleChange,
    min,
    max,
    sensitivity,
    initialValue,
    changeOnKeyUp,
    thresholdStick,
  });

  const { isActive, value } = useSnapshot(uiState.filters[name]);
  const threshold = 1;
  const background =
    Math.abs(value - initialValue) > threshold ? '#f882a050' : 'transparent';

  const rotateValue = initialValue ? value / initialValue : value;

  return (
    <div>
      <div
        className={`filter-knob ${isActive ? 'filter-knob--active' : ''}`}
        style={{
          background,
          transform: isActive ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.1s ease-in-out',
          cursor: showReset ? 'pointer' : 'default',
        }}
        onClick={handleReset}
      >
        <div
          className="filter-indicator"
          style={{
            transform: `translateX(-50%) translateY(-50%) rotate(${rotateValue * 120}deg) translateY(-23px)`,
          }}
        />
        <span className="filter-knob__tempo">{value.toFixed(2)}</span>
      </div>
      {isActive && <div className="filter-label">{name}</div>}
    </div>
  );
};

export default FilterComponent;
