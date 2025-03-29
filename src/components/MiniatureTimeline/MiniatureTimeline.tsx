import { useEffect, useRef, useState } from 'react';
import './MiniatureTimeline.styles.css';
import { generateAudioContextFromURL } from '../../utils/helpers';
import {
  generateWaveformSVG,
  generateWaveformData,
} from '@/utils/waveformTracker';

export const MiniatureTimeline = ({
  url,
  seek,
  getCurrentPositionPercentage,
  getIsPlaying,
  width = 500,
  height = 30,
  density = 2,
}) => {
  // const [isLoading, setIsLoading] = useState(false);
  const miniatureRef = useRef(null);
  const [progressLinePosition, setProgressLinePosition] = useState(0);

  useEffect(() => {
    const curr = setInterval(() => {
      setProgressLinePosition(width * getCurrentPositionPercentage());
    }, 200);
    return () => {
      clearInterval(curr);
    };
  }, []);

  useEffect(() => {
    if (!url) return;

    miniatureRef.current.innerHTML = '';

    const fetchAudio = async () => {
      // setIsLoading(true);

      const { audioBuffer } = await generateAudioContextFromURL(url);

      const waveformData = await generateWaveformData({
        audioBuffer,
        pixelsPerSecond: density,
      });

      const waveformSVG = generateWaveformSVG(waveformData.waveformData, {
        color: '#692536',
        width,
        height: height,
        amplification: 1,
      });

      //setIsLoading(false);
      miniatureRef.current.innerHTML = waveformSVG;
    };

    fetchAudio();
  }, [url]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left; // x position within the element
    const xRatio = x / rect.width; // x position from 0 to 1
    // You can call the seek function here if needed

    seek(xRatio);
  };

  const getProgressLinePosition = () => {
    return width * getCurrentPositionPercentage();
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
