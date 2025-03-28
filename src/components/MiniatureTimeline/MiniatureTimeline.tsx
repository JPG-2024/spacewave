import { useEffect, useRef, useState } from "react";
import "./MiniatureTimeline.styles.css";
import { generateAudioContextFromURL } from "../../utils/helpers";
import {
  generateWaveformSVG,
  generateWaveformData,
} from "@/utils/waveformTracker";
import VerticalLoading from "../VerticalLoading/VerticalLoading";

export const MiniatureTimeline = ({
  deckId,
  url,
  mixer,
  width = 400,
  height = 30,
  density = 10,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const miniatureRef = useRef(null);

  useEffect(() => {
    if (!url) return;

    miniatureRef.current.innerHTML = "";

    const fetchAudio = async () => {
      setIsLoading(true);

      const { audioBuffer } = await generateAudioContextFromURL(
        `http://localhost:3000/${url}.mp3`
      );

      const waveformData = await generateWaveformData({
        audioBuffer,
        pixelsPerSecond: density,
      });
      const waveformSVG = generateWaveformSVG(waveformData.waveformData, {
        color: "white",
        width,
        height,
      });

      setIsLoading(false);
      miniatureRef.current.innerHTML = waveformSVG;
    };

    fetchAudio();
  }, [url]);

  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left; // x position within the element
    const xRatio = x / rect.width; // x position from 0 to 1
    // You can call the seek function here if needed

    mixer.getDeckInstance(deckId).seek(xRatio);
  };

  return (
    <VerticalLoading
      isLoading={isLoading}
      width={`${width}px`}
      height={`${height}px`}
      ref={miniatureRef}
      conditionalRender={false}
    >
      <div
        id={`miniature-container-${deckId}`}
        className="miniature-timeline"
        onClick={handleClick}
        ref={miniatureRef}
      ></div>
    </VerticalLoading>
  );
};
