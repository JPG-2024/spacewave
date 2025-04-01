import { useEffect, useState, useRef, useCallback } from 'react';
import './App.styles.css';
import { Explorer } from '@/components/Explorer/Explorer';
import { DroppableArea } from '@/components/DroppableArea/DroppableArea';
import { MiniatureTimeline } from '@/components/MiniatureTimeline/MiniatureTimeline';
import VerticalLoading from '@/components/VerticalLoading/VerticalLoading';
import FilterComponent from '@/components/FilterComponent/FilterComponent';
import { useMixerDecks } from '@/contexts/MixerDecksProvider';
import TrackCover from '@/components/TrackCover/TrackCover';
import TempoKnob from './components/TempoKnob/TempoKnob';
import GainFilter from '@/components/GainFIlter/GainFIlter';
import { useFilter } from './hooks/useFilter';
import uiState from '@/store/uiStore';

const App = () => {
  const { addDeck, getDeck } = useMixerDecks();
  const [isLoading, setIsLoading] = useState(false);
  const webGLRef = useRef<HTMLDivElement | null>(null);

  //TODO: only for dev purpose
  useEffect(() => {
    handleLoadAudio(
      'Internet Money, Don Toliver, Gunna & Nav  - Lemonade (Miraj Remix).mp3',
    );
  }, []);

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

  const switchCameraValue = async (
    mode: keyof typeof uiState.camera.positions,
  ) => {
    const { positions } = uiState.camera;
    const ISOMETRIC_POSITIONS = getDeck('deck1').camera?.ISOMETRIC_POSITIONS;

    if (uiState.camera.currentMode === mode) {
      if (
        positions[mode] >=
        Object.keys(ISOMETRIC_POSITIONS[mode]).length - 1
      ) {
        positions[mode] = 0;
      } else {
        positions[mode] = positions[mode] + 1;
      }
    } else {
      uiState.camera.currentMode = mode;
    }

    // Corrected camera matrix call
    await getDeck('deck1')?.camera?.cameraMatrix(
      mode as any, // Cast mode to any if CameraPositionMode type isn't directly available here
      positions[mode],
    );

    const cameraZ = getDeck('deck1')?.camera?.position.z;
    const normalizedCameraZ = cameraZ ? ((cameraZ - 3) / (40 - 3)) * 0.1 : 0;
    handleChangeGain(normalizedCameraZ);
  };

  const handleChangeTempo = useCallback((tempo: number) => {
    getDeck('deck1').changeTempo(tempo);
  }, []);

  const handleGetTempo = () => {
    return getDeck('deck1').initialTempo;
  };

  const handleChangeColorFX = (gain: number) => {
    const adjustedValue = 1000 + gain * 7000; // Scale gain from 0 to 1 to range 1000 to 8000
    getDeck('deck1')?.setColorFX(adjustedValue, gain * 15, gain * 0.1);
  };

  const handleChangeBassGain = (gain: number) => {
    getDeck('deck1')?.setBassGain(gain);
  };

  const handleChangeMidGain = (gain: number) => {
    getDeck('deck1')?.setMidGain(gain);
  };

  const handleChangeTrebleGain = (gain: number) => {
    getDeck('deck1')?.setTrebleGain(gain);
  };

  /*   useFilter({
    key: 't',
    min: 90,
    max: 170,
    initialValue: 140,
    changeOnKeyUp: true,
    sensitivity: 0.1,
    onChange: handleChangeTempo,
  }); */

  useFilter({
    key: 'q',
    name: 'bassGain',
    min: -20,
    max: 15,
    onChange: handleChangeBassGain,
  });

  useFilter({
    key: 'w',
    name: 'midGain',
    min: -20,
    max: 15,
    onChange: handleChangeMidGain,
  });

  useFilter({
    key: 'e',
    name: 'trebleGain',
    min: -20,
    max: 15,
    onChange: handleChangeTrebleGain,
  });

  useFilter({
    name: 'colorFX',
    key: 'r',
    min: -1,
    max: 0.3,
    onChange: handleChangeColorFX,
  });

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

      {/* Conditionally render bottom bar only when a track is loaded */}
      {getDeck('deck1') && (
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
          {/* Ensure this section is not affected by useFilter */}
          <FilterComponent name="bassGain" initialValue={0} />
          <FilterComponent name="midGain" initialValue={0} />
          <FilterComponent name="trebleGain" initialValue={0} />
          <FilterComponent name="colorFX" initialValue={0} />
        </div>
      )}

      <Explorer />
    </div>
  );
};

export default App;
