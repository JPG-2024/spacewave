import { DroppableArea } from '@/components/DroppableArea/DroppableArea';
import { Explorer } from '@/components/Explorer/Explorer';
import FilterComponent from '@/components/FilterComponent/FilterComponent';
import { MiniatureTimeline } from '@/components/MiniatureTimeline/MiniatureTimeline';
import TrackCover from '@/components/TrackCover/TrackCover';
import VerticalLoading from '@/components/VerticalLoading/VerticalLoading';
import { useMixerDecks, WEBGL_CANVAS_ID } from '@/contexts/MixerDecksProvider';
import uiState, { DeckNames } from '@/store/uiStore';
import { useEffect, useRef, useState } from 'react';
import './App.styles.css';

const App = () => {
  const { getDeck, getScene, sceneInitialized } = useMixerDecks();
  const [isLoading, setIsLoading] = useState(false);
  const webGLRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sceneInitialized) return;

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
        if (getDeck(DeckNames.deck1)?.isPlayingState === true) {
          getDeck(DeckNames.deck1)?.pause();
        } else {
          getDeck(DeckNames.deck1)?.play();
        }
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (getDeck(DeckNames.deck1)?.isPlayingState === true) {
          getDeck(DeckNames.deck1)?.pause();
        } else {
          getDeck(DeckNames.deck1)?.play();
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
      //getDeck(DeckNames.deck1)?.dispose();
    };
  }, [sceneInitialized]);

  const handleLoadAudio = async (droppedText: string, deckId: DeckNames) => {
    setIsLoading(true);

    if (!sceneInitialized) {
      console.error(`Deck ${deckId}: Deck not available.`);
      return;
    }

    getDeck(deckId).pause();

    const result = await getDeck(deckId)
      .loadAudio(droppedText)
      .finally(() => {
        setIsLoading(false);
      });

    if (result && result.tempo) {
      uiState.decks[deckId].filtersState.tempo.value = result.tempo;
    }
  };

  const switchCameraValue = async (
    mode: keyof typeof uiState.cameraState.positions,
  ) => {
    if (!sceneInitialized) return;

    const { positions } = uiState.cameraState;

    if (uiState.cameraState.currentMode === mode) {
      if (
        positions[mode] >=
        Object.keys(getScene().ISOMETRIC_POSITIONS[mode]).length - 1
      ) {
        positions[mode] = 0;
      } else {
        positions[mode] = positions[mode] + 1;
      }
    } else {
      uiState.cameraState.currentMode = mode;
    }

    const scene = getScene();
    if (!scene) {
      console.warn('Scene not available');
      return;
    }

    console.log('Switching camera:', {
      mode,
      value: positions[mode],
      scene: !!scene,
    });

    await getScene().camera?.cameraMatrix(mode as any, positions[mode]);
  };

  return (
    <div className="app">
      <DroppableArea
        id={DeckNames.deck1}
        isLoaded={!!getDeck(DeckNames.deck1)}
        notContentMessage="Drop a track here"
        onDropItem={(droppedText, id) =>
          handleLoadAudio(droppedText, id as DeckNames)
        }
      >
        <VerticalLoading
          conditionalRender={false}
          width="100%"
          height="100vh"
          isLoading={isLoading}
        >
          <div
            className="webGLCanvas"
            id={WEBGL_CANVAS_ID}
            ref={webGLRef}
          ></div>
        </VerticalLoading>
      </DroppableArea>

      {sceneInitialized && getDeck(DeckNames.deck1) && (
        <div className="app__bottom-bar">
          <TrackCover fileName={getDeck(DeckNames.deck1).currentFileName} />
          <div className="miniature-timeline-container">
            <MiniatureTimeline deckId={DeckNames.deck1} />
          </div>

          <FilterComponent
            deckId={DeckNames.deck1}
            name="bassGain"
            activateKey="q"
            initialValue={0}
            type="bassGain"
            deck={getDeck(DeckNames.deck1)}
          />
          <FilterComponent
            deckId={DeckNames.deck1}
            name="midGain"
            activateKey="w"
            initialValue={0}
            type="midGain"
            deck={getDeck(DeckNames.deck1)}
          />
          <FilterComponent
            deckId={DeckNames.deck1}
            name="trebleGain"
            activateKey="e"
            initialValue={0}
            type="trebleGain"
            deck={getDeck(DeckNames.deck1)}
          />
          <FilterComponent
            deckId={DeckNames.deck1}
            name="colorFX"
            activateKey="r"
            initialValue={0}
            type="colorFX"
            sensitivity={0.0005}
            deck={getDeck(DeckNames.deck1)}
          />
          <FilterComponent
            deckId={DeckNames.deck1}
            name="tempo"
            activateKey="t"
            initialValue={getDeck(DeckNames.deck1).getInitialTempo()!}
            type="tempo"
            min={getDeck(DeckNames.deck1).getInitialTempo()! - 40}
            max={getDeck(DeckNames.deck1).getInitialTempo()! + 40}
            deck={getDeck(DeckNames.deck1)}
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
