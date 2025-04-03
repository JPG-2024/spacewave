import { DroppableArea } from '@/components/DroppableArea/DroppableArea';
import { Explorer } from '@/components/Explorer/Explorer';
import FilterComponent from '@/components/FilterComponent/FilterComponent';
import { MiniatureTimeline } from '@/components/MiniatureTimeline/MiniatureTimeline';
import TrackCover from '@/components/TrackCover/TrackCover';
import VerticalLoading from '@/components/VerticalLoading/VerticalLoading';
import { useMixerDecks } from '@/contexts/MixerDecksProvider';
import uiState from '@/store/uiStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import './App.styles.css';

const App = () => {
  const { addDeck, getDeck } = useMixerDecks();
  const [isLoading, setIsLoading] = useState(false);
  const webGLRef = useRef<HTMLDivElement | null>(null);

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

  const handleLoadAudio = async (droppedText: string, id?: string) => {
    setIsLoading(true);

    getDeck('deck1')?.pause(); // Pause existing playback if any

    const result = await getDeck('deck1')
      ?.loadAudio(droppedText)
      .finally(() => {
        setIsLoading(false);
      });

    if (result) {
      uiState.filters.tempo.value = result.tempo;
    }
  };

  const switchCameraValue = async (
    mode: keyof typeof uiState.camera.positions,
  ) => {
    const { positions } = uiState.camera;
    const deck = getDeck('deck1');
    if (!deck?.camera?.ISOMETRIC_POSITIONS) return;

    const ISOMETRIC_POSITIONS = deck.camera.ISOMETRIC_POSITIONS;

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

    await deck.camera?.cameraMatrix(mode as any, positions[mode]);

    const cameraZ = deck.camera?.position.z;
    const normalizedCameraZ = cameraZ ? ((cameraZ - 3) / (40 - 3)) * 0.1 : 0;
  };

  const handleChangeTempo = useCallback((tempo: number) => {
    getDeck('deck1').changeTempo(tempo);
  }, []);

  const handleGetTempo = () => {
    const deck = getDeck('deck1');
    return deck?.initialTempo ?? 0;
  };

  const isDeckReady = () => {
    const deck = getDeck('deck1');
    if (!deck) return false;
    return !['loading', 'empty'].includes(deck.currentStatus);
  };

  return (
    <div className="app">
      <DroppableArea
        id="deck1"
        isLoaded={!!getDeck('deck1')}
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

      {isDeckReady() && (
        <div className="app__bottom-bar">
          <TrackCover fileName={getDeck('deck1')?.currentFileName} />
          <div className="miniature-timeline-container">
            <MiniatureTimeline deckId="deck1" />
          </div>

          <FilterComponent
            name="bassGain"
            activateKey="q"
            initialValue={0}
            type="bassGain"
            deck={getDeck('deck1')}
          />
          <FilterComponent
            name="midGain"
            activateKey="w"
            initialValue={0}
            type="midGain"
            deck={getDeck('deck1')}
          />
          <FilterComponent
            name="trebleGain"
            activateKey="e"
            initialValue={0}
            type="trebleGain"
            deck={getDeck('deck1')}
          />
          <FilterComponent
            name="colorFX"
            activateKey="r"
            initialValue={0}
            type="colorFX"
            sensitivity={0.0005}
            deck={getDeck('deck1')}
          />
          <FilterComponent
            name="tempo"
            activateKey="t"
            initialValue={getDeck('deck1')?.initialTempo}
            type="tempo"
            min={getDeck('deck1')?.initialTempo - 40}
            max={getDeck('deck1')?.initialTempo + 40}
            deck={getDeck('deck1')}
            changeOnKeyUp={true}
            sensitivity={0.1}
            showReset={true}
          />
        </div>
      )}

      <Explorer />
    </div>
  );
};

export default App;
