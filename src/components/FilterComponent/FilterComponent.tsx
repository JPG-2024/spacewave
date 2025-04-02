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
  type: 'bassGain' | 'midGain' | 'trebleGain' | 'colorFX';
  deck: any; // Idealmente deberíamos tipar esto correctamente con el tipo de deck
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
  handleReset,
  type,
  deck,
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
    }
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

  return (
    <div>
      <div
        className={`filter-knob ${isActive ? 'filter-knob--active' : ''}`}
        style={{
          background,
          transform: isActive ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.1s ease-in-out',
        }}
      >
        <div
          className="filter-indicator"
          style={{
            transform: `translateX(-50%) translateY(-50%) rotate(${value * 120}deg) translateY(-23px)`,
          }}
        />
        <span className="filter-knob__tempo">{value.toFixed(2)}</span>
        {handleReset && <span className="filter-knob__reset">R</span>}
      </div>
      {isActive && <div className="filter-label">{name}</div>}
    </div>
  );
};

export default FilterComponent;
