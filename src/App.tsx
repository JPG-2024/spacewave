import { useEffect, useState, useRef, useCallback } from 'react';
import './App.styles.css';
import { Explorer } from '@/components/Explorer/Explorer';
import { DroppableArea } from '@/components/DroppableArea/DroppableArea';
import { PlayPauseButton } from '@/components/PlayPauseButton/PlayPauseButton';
import { MixerDeck } from '@/utils/MixerDeck';
import { MiniatureTimeline } from '@/components/MiniatureTimeline/MiniatureTimeline';
import VerticalLoading from '@/components/VerticalLoading/VerticalLoading';

const App = () => {
  const deck1Ref = useRef<MixerDeck | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [currentFilename, setCurrentFilename] = useState<string>('');

  const webGLRef = useRef<HTMLDivElement | null>(null);
  const timeline = useRef(null);
  const cameraRef = useRef(null);

  const cameraPositionsRef = useRef({
    isometric: 0,
    side: 0,
    closeSide: 0,
    closeSideRight: 0,
  });
  const currentCameraMode = useRef('side');

  useEffect(() => {
    // Initialize MixerDeck instance
    deck1Ref.current = new MixerDeck('deck1', 'deck1webfl');

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
        if (deck1Ref.current?.isPlayingState === true) {
          deck1Ref.current?.pause();
        } else {
          deck1Ref.current?.play();
        }
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (deck1Ref.current?.isPlayingState === true) {
          deck1Ref.current?.pause();
        } else {
          deck1Ref.current?.play();
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
      deck1Ref.current?.dispose();
    };
  }, []);

  const handleLoadAudio = (droppedText: string, id?: string) => {
    setIsLoading(true);
    // Extract filename without extension from the dropped text (assuming format like 'path/to/filename.mp3')
    const fileName =
      droppedText
        .split('/')
        .pop()
        ?.replace(/\.[^/.]+$/, '') || '';

    deck1Ref.current?.pause(); // Pause existing playback if any

    deck1Ref.current
      ?.loadAudio(droppedText) // Load using the full dropped text
      .then(success => {
        if (success) {
          setCurrentFilename(fileName); // Set the filename without extension on success
        } else {
          // Handle loading failure if needed (e.g., clear currentUrl)
          setCurrentFilename('');
        }
      })
      .catch(error => {
        console.error('Error loading audio:', error);
        setCurrentFilename(''); // Clear URL on error
      })
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
    deck1Ref.current?.camera?.cameraMatrix(
      mode as any, // Cast mode to any if CameraPositionMode type isn't directly available here
      cameraPositionsRef.current[
        mode as keyof typeof cameraPositionsRef.current
      ],
    );
  };

  const handleSeek = useCallback(
    (time: number) => deck1Ref.current.seek(time),
    [],
  );

  const handleGetCurrentPositionPercentage = useCallback(
    () => deck1Ref.current.currentPositionPercentage,
    [],
  );

  const handleIsPlaying = useCallback(
    () => deck1Ref.current?.isPlayingState,
    [],
  );

  return (
    <div className="app">
      <DroppableArea
        id="deck1"
        isLoaded={!!deck1Ref.current} // Reflect if deck is initialized
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
      {currentFilename && deck1Ref.current && (
        <div className="app__bottom-bar">
          <img
            className="app__track-cover"
            src={`http://localhost:3000/${currentFilename}.webp`} // Use currentUrl for image
            alt="track-cover"
            onError={e => {
              // Optional: Handle image loading errors (e.g., show a default image)
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="miniature-timeline-container">
            {/* Pass mixer instance and deckId to MiniatureTimeline */}
            <MiniatureTimeline
              getIsPlaying={handleIsPlaying}
              url={deck1Ref.current.currentFileName}
              seek={handleSeek} // Pass the MixerDeck instance
              getCurrentPositionPercentage={handleGetCurrentPositionPercentage}
            />
          </div>
        </div>
      )}

      <Explorer />
    </div>
  );
};

export default App;
