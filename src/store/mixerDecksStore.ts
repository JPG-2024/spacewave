import { proxy } from 'valtio';
import { MixerDeck } from '@/utils/MixerDeck';

interface MixerDecksState {
  decks: { [id: string]: MixerDeck };
  nextId: number;
}

const state = proxy<MixerDecksState>({
  decks: {},
  nextId: 1,
});

export const mixerDecksStore = {
  state, // Expose state for direct read access if needed (though useSnapshot is preferred in components)

  addDeck: (deck: MixerDeck): string => {
    const id = `deck-${state.nextId}`;
    console.log(`Adding provided deck with ID: ${id}`);
    try {
      // Assign the provided deck instance
      state.decks[id] = deck;
      state.nextId += 1;
      console.log(
        `Deck ${id} added successfully from provided instance. Current decks:`,
        Object.keys(state.decks),
      );
      return id;
    } catch (error) {
      console.error(`Error creating MixerDeck instance for ${id}:`, error);
      // Potentially re-throw or handle the error appropriately
      throw error; // Re-throwing for now
    }
  },

  getDeck: (id: string): MixerDeck | undefined => {
    return state.decks[id];
  },

  removeDeck: (id: string): void => {
    const deck = state.decks[id];
    if (deck) {
      console.log(`Removing and disposing deck ${id}`);
      deck.dispose();
      delete state.decks[id];
      console.log(
        `Deck ${id} removed. Current decks:`,
        Object.keys(state.decks),
      );
    } else {
      console.warn(`Attempted to remove non-existent deck with ID: ${id}`);
    }
  },

  // You might add more actions here later, e.g., playAll, pauseAll, etc.
};

// Optional: Export derived utilities or hooks if needed
// e.g., export const useMixerDeck = (id: string) => useSnapshot(state).decks[id];

export default mixerDecksStore; // Export the whole store object
