import { useEffect, useState, useRef } from 'react';
import './App.styles.css';
import { Explorer } from '@/components/Explorer/Explorer';
import { DroppableArea } from '@/components/DroppableArea/DroppableArea';
import { PlayPauseButton } from '@/components/PlayPauseButton/PlayPauseButton';
import useMixer from '@/hooks/useMixer';
import { MiniatureTimeline } from '@/components/MiniatureTimeline/MiniatureTimeline';
import VerticalLoading from '@/components/VerticalLoading/VerticalLoading';

const App = () => {
  const mixer = useMixer();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  console.log(currentUrl);
  const webGLRef = useRef(null);
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
    const handleKeyDown = e => {
      e.preventDefault();

      if (e.key === 'ArrowUp') {
        if (cameraRef.current) {
          switchCameraValue('isometric');
        }
      }

      if (e.key === 'ArrowLeft') {
        if (cameraRef.current) {
          switchCameraValue('closeSide');
        }
      }

      if (e.key === 'ArrowRight') {
        if (cameraRef.current) {
          switchCameraValue('closeSideRight');
        }
      }

      if (e.key === 'p') {
        if (mixer.getIsPlaying('deck1') === true) {
          mixer.pause('deck1')();
        } else {
          mixer.play('deck1')();
        }
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (mixer.getIsPlaying('deck1') === true) {
          mixer.pause('deck1')();
        } else {
          mixer.play('deck1')();
        }
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();

        if (cameraRef.current) {
          switchCameraValue('side');
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
    };
  }, [mixer]);

  const handleLoadAudio = async (fileName: string, id: string) => {
    try {
      setIsLoading(true);
      const refs = { cameraRef, timeline };

      await mixer.getDeckInstance(id)?.pause();

      await mixer.loadAudio(id, { refs })(`http://localhost:3000/${fileName}`);

      setCurrentUrl(fileName.replace(/\.[^/.]+$/, ''));
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };

  const switchCameraValue = mode => {
    if (currentCameraMode.current === mode) {
      if (cameraPositionsRef.current[mode] >= 3) {
        cameraPositionsRef.current[mode] = 0;
      } else {
        cameraPositionsRef.current[mode] = cameraPositionsRef.current[mode] + 1;
      }
    } else {
      currentCameraMode.current = mode;
    }

    cameraRef.current.cameraMatrix(mode, cameraPositionsRef.current[mode]);
  };

  return (
    <div className="app">
      <DroppableArea
        id="deck1"
        isLoaded={true}
        notContentMessage="Drop a track here"
        onDropItem={handleLoadAudio}
      >
        <VerticalLoading
          conditionalRender={false}
          width="100%"
          height="100vh"
          isLoading={isLoading}
        >
          <div className="webGLCanvas" id="deck1webfl" ref={webGLRef}></div>
        </VerticalLoading>
      </DroppableArea>

      {mixer.getDeckInstance('deck1') && (
        <div className="app__bottom-bar">
          <img
            className="app__track-cover"
            src={`http://localhost:3000/${currentUrl}.webp`}
            alt="disk-image"
          />
          <div className="miniature-timeline-container">
            <MiniatureTimeline url={currentUrl} mixer={mixer} deckId="deck1" />
            {/*           <PlayPauseButton
            play={mixer.getDeckInstance('deck1').play}
            pause={mixer.getDeckInstance('deck1').pause}
            size="sm"
          /> */}
          </div>
        </div>
      )}

      {/*       <PlayPauseButton
        play={mixer.play("deck1")}
        pause={mixer.pause("deck1")}
      /> */}

      <Explorer />
    </div>
  );
};

export default App;
