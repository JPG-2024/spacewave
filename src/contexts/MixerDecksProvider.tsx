import React, { useRef, createContext, useContext } from 'react';
import { MixerDeck } from '@/utils/MixerDeck';

// Definir la interfaz del contexto
interface MixerDecksContextType {
  addDeck: (id: string, webfl: string) => void;
  getDeck: (id: string) => MixerDeck;
  removeDeck: (id: string) => void;
}

// Crear el contexto con un valor inicial null
export const MixerDecksContext = createContext<MixerDecksContextType | null>(
  null,
);

export const MixerDecksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const decksRef = useRef<Map<string, MixerDeck>>(new Map());

  const addDeck = (id: string, webfl: string) => {
    if (!decksRef.current.has(id)) {
      const deck = new MixerDeck(id, webfl);

      decksRef.current.set(id, deck);
    }
  };

  const getDeck = (id: string): MixerDeck | undefined => {
    return decksRef.current.get(id);
  };

  const removeDeck = (id: string) => {
    if (decksRef.current.has(id)) {
      decksRef.current.get(id)?.dispose?.();
      decksRef.current.delete(id);
    }
  };

  return (
    <MixerDecksContext.Provider value={{ addDeck, getDeck, removeDeck }}>
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
