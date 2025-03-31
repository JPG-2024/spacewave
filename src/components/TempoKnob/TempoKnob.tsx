import React, { useState, useEffect, useRef } from 'react';
import './styles.css';

interface TempoKnobProps {
  changeTempo: (tempo: number) => void;
  getTempo: () => number;
}

const TempoKnob: React.FC<TempoKnobProps> = ({ changeTempo, getTempo }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [temporaryTempo, setTemporaryTempo] = useState(getTempo() || 140);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const newTempo = Math.max(
      40,
      Math.min(200, temporaryTempo + deltaX * 0.001),
    );

    setTemporaryTempo(newTempo);
  };

  const handleMouseUp = async () => {
    console.log('handleMouseUPP');
    if (isDragging) {
      await changeTempo(temporaryTempo);
    }
    setIsDragging(false);
  };

  const handleReset = async () => {
    const initialTempo = getTempo();
    await changeTempo(initialTempo);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startX, temporaryTempo]);

  return (
    <div>
      <div
        className="tempo-knob"
        style={{ cursor: isDragging ? 'ns-resize' : 'pointer' }}
      >
        <span className="tempo-knob__tempo" onMouseDown={handleMouseDown}>
          {temporaryTempo.toFixed(2)}
        </span>
        <span className="tempo-knob__reset" onClick={handleReset}>
          R
        </span>
      </div>
    </div>
  );
};

export default TempoKnob;
