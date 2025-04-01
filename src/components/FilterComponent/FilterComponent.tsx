import React from 'react';
import './FilterComponent.styles.css';
import { useSnapshot } from 'valtio';
import uiState, { FiltersNames } from '@/store/uiStore';

interface FilterKnobProps {
  name: FiltersNames;
  initialValue?: number;
  handleReset: () => void;
}

const FilterKnob: React.FC<FilterKnobProps> = ({
  name,
  initialValue = 0,
  handleReset = null,
}) => {
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
        <span className="filter-knob__tempo">{value.toFixed(2)}</span>
        {handleReset && <span className="filter-knob__reset">R</span>}
      </div>
    </div>
  );
};

export default FilterKnob;
