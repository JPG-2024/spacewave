import { useEffect, useState, useRef } from 'react';
import './App.styles.css';
import { Explorer } from '@/components/Explorer/Explorer';
import { DroppableArea } from '@/components/DroppableArea/DroppableArea';

import { MiniatureTimeline } from '@/components/MiniatureTimeline/MiniatureTimeline';
import VerticalLoading from '@/components/VerticalLoading/VerticalLoading';
import { useMixerDecks } from '@/contexts/MixerDecksProvider';
import TrackCover from '@/components/TrackCover/TrackCover';
import TempoKnob from './components/TempoKnob/TempoKnob';

const App = () => {
  const { addDeck, getDeck } = useMixerDecks();

  const [isLoading, setIsLoading] = useState(false);

  const webGLRef = useRef<HTMLDivElement | null>(null);

  const cameraPositionsRef = useRef({
    isometric: 0,
    side: 0,
    closeSide: 0,
    closeSideRight: 0,
  });
  const currentCameraMode = useRef('side');

  useEffect(() => {
    // Initialize MixerDeck instance
    //getDeck('deck1') = new MixerDeck('deck1', 'deck1webfl');
    addDeck('deck1', 'deck1webfl');

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        switchCameraValue('isometric');
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        switchCameraValue('side');
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        switchCameraValue('closeSide');
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        switchCameraValue('closeSideRight');
      }

      if (e.key === 'p') {
        if (getDeck('deck1')?.isPlayingState === true) {
          getDeck('deck1')?.pause();
        } else {
          getDeck('deck1')?.play();
        }
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (getDeck('deck1')?.isPlayingState === true) {
          getDeck('deck1')?.pause();
        } else {
          getDeck('deck1')?.play();
        }
      }
    };

    const handleMouseEnter = () => {
      window.addEventListener('keydown', handleKeyDown);
    };

    const handleMouseLeave = () => {
      window.removeEventListener('keydown', handleKeyDown);
    };

    const webGLNode = webGLRef.current;

    if (webGLNode) {
      webGLNode.addEventListener('mouseenter', handleMouseEnter);
      webGLNode.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (webGLNode) {
        webGLNode.removeEventListener('mouseenter', handleMouseEnter);
        webGLNode.removeEventListener('mouseleave', handleMouseLeave);
      }

      //TODO: verify
      //getDeck('deck1')?.dispose();
    };
  }, []);

  const handleLoadAudio = (droppedText: string, id?: string) => {
    setIsLoading(true);

    getDeck('deck1')?.pause(); // Pause existing playback if any

    getDeck('deck1')
      ?.loadAudio(droppedText)
      .finally(() => {
        setIsLoading(false);
      });
  };

  const switchCameraValue = (mode: string) => {
    if (currentCameraMode.current === mode) {
      if (
        cameraPositionsRef.current[
          mode as keyof typeof cameraPositionsRef.current
        ] >= 3
      ) {
        cameraPositionsRef.current[
          mode as keyof typeof cameraPositionsRef.current
        ] = 0;
      } else {
        cameraPositionsRef.current[
          mode as keyof typeof cameraPositionsRef.current
        ] =
          cameraPositionsRef.current[
            mode as keyof typeof cameraPositionsRef.current
          ] + 1;
      }
    } else {
      currentCameraMode.current = mode;
    }

    // Corrected camera matrix call
    getDeck('deck1')?.camera?.cameraMatrix(
      mode as any, // Cast mode to any if CameraPositionMode type isn't directly available here
      cameraPositionsRef.current[
        mode as keyof typeof cameraPositionsRef.current
      ],
    );
  };

  const handleChangeTempo = (tempo: number) => {
    getDeck('deck1').changeTempo(tempo);
  };

  const handleGetTempo = () => {
    return getDeck('deck1').initialTempo;
  };

  return (
    <div className="app">
      <DroppableArea
        id="deck1"
        isLoaded={!!getDeck('deck1')} // Reflect if deck is initialized
        notContentMessage="Drop a track here"
        onDropItem={handleLoadAudio}
      >
        <VerticalLoading
          conditionalRender={false} // Keep VerticalLoading always rendered
          width="100%"
          height="100vh"
          isLoading={isLoading} // Show loading state
        >
          {/* Canvas for WebGL visualization */}
          <div className="webGLCanvas" id="deck1webfl" ref={webGLRef}></div>
        </VerticalLoading>
      </DroppableArea>

      {/* Conditionally render bottom bar only when a track is loaded (currentUrl is set) */}
      {getDeck('deck1') && getDeck('deck1')?.currentStatus === 'loaded' && (
        <div className="app__bottom-bar">
          <TrackCover fileName={getDeck('deck1')?.currentFileName} />
          <div className="miniature-timeline-container">
            {/* Pass mixer instance and deckId to MiniatureTimeline */}
            <MiniatureTimeline deckId="deck1" />
          </div>
          <TempoKnob
            getTempo={handleGetTempo}
            changeTempo={handleChangeTempo}
          />
        </div>
      )}

      <Explorer />
    </div>
  );
};

export default App;
