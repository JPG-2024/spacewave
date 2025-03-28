import React, { useState } from "react";

interface DroppableAreaProps {
  id?: string;
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

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedText = event.dataTransfer.getData("text/plain");
    onDropItem(droppedText, id);
    setIsDraggingOver(false);
  };

  const handleDragOver = (event) => {
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
      className={`relative w-full h-full ${
        isDraggingOver ? "border-1 border-green-500" : ""
      }`}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex bg-gray-900 items-center justify-center opacity-90 z-10">
          {notContentMessage}
        </div>
      )}

      <div>{children}</div>
    </div>
  );
};
