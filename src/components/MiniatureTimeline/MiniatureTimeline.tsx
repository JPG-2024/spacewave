import React, { useEffect, useRef, useState } from 'react';
import './MiniatureTimeline.styles.css';
import { generateAudioContextFromURL } from '../../utils/helpers';
import { generateWaveformData } from '@/utils/waveformTracker';
import { useMixerDecks } from '@/contexts/MixerDecksProvider';
import { generateWaveformSVG } from '@/utils/generateWaveformSVG';

interface MiniatureTimelineProps {
  deckId: string;
  width?: number;
  height?: number;
  density?: number;
}

export const MiniatureTimeline: React.FC<MiniatureTimelineProps> = ({
  deckId,
  width = 500,
  height = 30,
  density = 2,
}) => {
  const { getDeck } = useMixerDecks();
  // const [isLoading, setIsLoading] = useState(false);
  const miniatureRef = useRef<HTMLDivElement>(null);
  const [progressLinePosition, setProgressLinePosition] = useState(0);

  useEffect(() => {
    const curr = setInterval(() => {
      setProgressLinePosition(
        width * getDeck(deckId)?.currentPositionPercentage,
      );
    }, 200);
    return () => {
      clearInterval(curr);
    };
  }, []);

  useEffect(() => {
    const fileName = getDeck(deckId)?.currentFileName;

    if (!fileName) return;

    if (miniatureRef.current) miniatureRef.current.innerHTML = '';
    const fetchAudio = async () => {
      const { audioBuffer } = await generateAudioContextFromURL(fileName);

      const waveformData = await generateWaveformData({
        audioBuffer,
        pixelsPerSecond: density,
      });

      const waveformSVG = generateWaveformSVG(waveformData.waveformData, {
        color: '#ff4271',
        width,
        height: height,
        amplification: 1,
      });

      //setIsLoading(false);
      if (miniatureRef.current) miniatureRef.current.innerHTML = waveformSVG;
    };

    fetchAudio();
  }, [getDeck(deckId)?.currentFileName]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left; // x position within the element
    const xRatio = x / rect.width; // x position from 0 to 1
    // You can call the seek function here if needed

    getDeck(deckId)?.seek(xRatio);
  };

  return (
    <div className="miniature-timeline">
      <div
        className="miniature-timeline__svg"
        onClick={handleClick}
        ref={miniatureRef}
      />
      <div
        style={{ left: progressLinePosition }}
        className="miniature-timeline__progress-line"
      />
    </div>
  );
};
