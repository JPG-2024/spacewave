import React, {
  useRef,
  useEffect,
  useState,
  createContext,
  useContext,
} from 'react';
import { MixerDeck } from '@/utils/MixerDeck';
import { TimelineGenerator } from '@/utils/generateTimeline';
import { DeckNames } from '@/store/uiStore';

export const WEBGL_CANVAS_ID = 'WEBGL_CANVAS_ID';

// Definir la interfaz del contexto
interface MixerDecksContextType {
  addDeck: (id: DeckNames) => void;
  getDeck: (id: DeckNames) => MixerDeck;
  removeDeck: (id: DeckNames) => void;
  getScene: () => TimelineGenerator;
  initScene: () => Promise<void>;
  sceneInitialized: boolean;
}

export const MixerDecksContext = createContext<MixerDecksContextType | null>(
  null,
);

export const MixerDecksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [sceneInitialized, setSceneInitialized] = useState(false);

  const decksRef = useRef<Map<DeckNames, MixerDeck>>(new Map());
  const sceneRef = useRef<TimelineGenerator>(null);

  const initScene = async () => {
    if (!sceneRef.current) {
      const scene = new TimelineGenerator({
        containerId: WEBGL_CANVAS_ID,
      });
      sceneRef.current = scene;
      await scene.initialize();

      await addDeck(DeckNames.deck1);
      await addDeck(DeckNames.deck2);

      setSceneInitialized(true);
      console.log('Scene initialized');
    }
  };

  //TODO: evaluar iniciar la scene en un useEffect
  useEffect(() => {
    if (!sceneInitialized) {
      initScene();
      setSceneInitialized(true);
    }
  }, [sceneInitialized]);

  const addDeck = (id: DeckNames) => {
    if (!decksRef.current.has(id) && sceneRef.current) {
      const deck = new MixerDeck(id, sceneRef.current);
      decksRef.current.set(id, deck);
    }
  };

  const getDeck = (id: DeckNames): MixerDeck => {
    return decksRef.current.get(id)!;
  };

  const removeDeck = (id: DeckNames) => {
    if (decksRef.current.has(id)) {
      decksRef.current.get(id)?.dispose?.();
      decksRef.current.delete(id);
    }
  };

  const getScene = (): TimelineGenerator => {
    return sceneRef.current!;
  };

  return (
    <MixerDecksContext.Provider
      value={{
        addDeck,
        getDeck,
        removeDeck,
        initScene,
        sceneInitialized,
        getScene,
      }}
    >
      {children}
    </MixerDecksContext.Provider>
  );
};

export const useMixerDecks = (): MixerDecksContextType => {
  const context = useContext(MixerDecksContext);
  if (!context) {
    throw new Error(
      'useMixerDecks debe ser usado dentro de un MixerDecksProvider',
    );
  }
  return context;
};
