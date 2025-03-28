import React, { useState, useEffect, useRef } from "react";
import "./styles.css";
import { DeckInstance } from "../../hooks/useMixer2";

interface TempoKnobProps {
  deck: DeckInstance;
}

const TempoKnob: React.FC<TempoKnobProps> = ({ deck }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [temporaryTempo, setTemporaryTempo] = useState(deck.bpm || 100);
  const needPauseRef = useRef(false);

  const handleMouseDown = (e) => {
    console.log("handleMouseDown");
    if (deck.getIsPlaying()) {
      needPauseRef.current = true;
      deck.pause();
    }

    setIsDragging(true);
    setStartY(e.clientY);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const deltaY = startY - e.clientY;
    const newTempo = Math.max(
      40,
      Math.min(200, temporaryTempo + deltaY * 0.0001)
    );

    setTemporaryTempo(newTempo);
  };

  const handleMouseUp = async () => {
    console.log("handleMouseUPP");
    if (isDragging) {
      await deck.changeTempo(temporaryTempo);
    }
    if (needPauseRef.current === true) {
      deck.play();
      needPauseRef.current = false;
    }
    setIsDragging(false);
  };

  const handleAutosync = async () => {
    const newTempo = await deck.autoSyncTempo();
    setTemporaryTempo(newTempo);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, startY, temporaryTempo]);

  return (
    <div>
      <div
        className="tempo-knob"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? "ns-resize" : "pointer" }}
      >
        {temporaryTempo.toFixed(2)}
      </div>
      <button onClick={handleAutosync}>Autosync</button>
    </div>
  );
};

export default TempoKnob;
