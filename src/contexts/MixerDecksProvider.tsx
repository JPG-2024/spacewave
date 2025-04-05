import React, { useRef, createContext, useContext } from 'react';
import { MixerDeck } from '@/utils/MixerDeck';
import { TimelineGenerator } from '@/utils/generateTimeline';
import { DeckNames } from '@/store/uiStore';

// Definir la interfaz del contexto
interface MixerDecksContextType {
  addDeck: (id: DeckNames) => void;
  getDeck: (id: DeckNames) => MixerDeck;
  removeDeck: (id: DeckNames) => void;
  addScene: (containerId: string) => Promise<TimelineGenerator>;
  getScene: () => TimelineGenerator;
}

// Crear el contexto con un valor inicial null
export const MixerDecksContext = createContext<MixerDecksContextType | null>(
  null,
);

export const MixerDecksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const decksRef = useRef<Map<DeckNames, MixerDeck>>(new Map());
  const sceneRef = useRef<TimelineGenerator>(undefined);

  const addDeck = (id: DeckNames) => {
    if (!decksRef.current.has(id) && sceneRef.current) {
      const deck = new MixerDeck(id, sceneRef.current);
      decksRef.current.set(id, deck);
    }
  };

  const getDeck = (id: DeckNames): MixerDeck => {
    return decksRef.current.get(id);
  };

  const removeDeck = (id: DeckNames) => {
    if (decksRef.current.has(id)) {
      decksRef.current.get(id)?.dispose?.();
      decksRef.current.delete(id);
    }
  };

  const addScene = async (containerId: string): Promise<TimelineGenerator> => {
    if (!sceneRef.current) {
      const scene = new TimelineGenerator({
        containerId: containerId,
      });
      await scene.initialize();
      sceneRef.current = scene;
    }
    return sceneRef.current;
  };

  const getScene = (): TimelineGenerator => {
    return sceneRef.current;
  };

  return (
    <MixerDecksContext.Provider
      value={{ addDeck, getDeck, removeDeck, addScene, getScene }}
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
