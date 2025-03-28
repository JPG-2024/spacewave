import React, { useState } from "react";

interface PlayPauseButtonProps {
  size?: "sm" | "md" | "lg";
  initiallyPlaying?: boolean;
  color?: string;
  play: () => void;
  pause: () => void;
}

export const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({
  size = "md",
  initiallyPlaying = false,
  color = "indigo-600",
  play,
  pause,
}) => {
  const [isPlaying, setIsPlaying] = useState(initiallyPlaying);

  const handleClick = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);

    if (newState) {
      play();
    } else {
      pause();
    }
  };

  // Size variants
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  return (
    <button
      onClick={handleClick}
      className={"playpause-button"}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? "❚❚" : "▷"}
    </button>
  );
};
