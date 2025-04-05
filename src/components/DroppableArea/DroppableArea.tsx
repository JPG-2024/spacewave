import React, { useState } from 'react';
import './DroppableArea.styles.css';
import { DeckNames } from '@/store/uiStore';

interface DroppableAreaProps {
  id: DeckNames;
  onDropItem: (droppedText: string, id?: string) => void;
  isLoaded: boolean;
  notContentMessage: string;
  children: React.ReactNode;
}

export const DroppableArea: React.FC<DroppableAreaProps> = ({
  id,
  onDropItem,
  children,
  isLoaded,
  notContentMessage,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDrop = event => {
    event.preventDefault();
    const droppedText = event.dataTransfer.getData('text/plain');
    onDropItem(droppedText, id);
    setIsDraggingOver(false);
  };

  const handleDragOver = event => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`droppable ${isDraggingOver ? 'droppable--dragging' : ''}`}
    >
      {!isLoaded && (
        <div className="droppable__overlay">{notContentMessage}</div>
      )}

      <div className="droppable__content">{children}</div>
    </div>
  );
};
