import { proxy } from 'valtio';
import { TimelineGenerator } from '@/utils/generateTimeline';
import { MixerDeck } from '@/utils/MixerDeck';

export enum DeckNames {
  deck1 = 'deck1',
  deck2 = 'deck2',
}

interface CameraPositions {
  isometric: number;
  side: number;
  closeSide: number;
  closeSideRight: number;
}

interface FiltersState {
  value: number;
  isActive: boolean;
}

export type FiltersNames =
  | 'bassGain'
  | 'midGain'
  | 'trebleGain'
  | 'colorFX'
  | 'tempo';

export type Filters = {
  [K in FiltersNames]: FiltersState;
};

interface UIState {
  cameraState: { currentMode: string; positions: CameraPositions };
  scene: { instance: TimelineGenerator | null };
  decks: {
    [key in DeckNames]: {
      instance: MixerDeck | null;
      filtersState: Filters;
    };
  };
}

const uiState = proxy<UIState>({
  cameraState: {
    currentMode: 'side',
    positions: {
      isometric: 0,
      side: 0,
      closeSide: 0,
      closeSideRight: 0,
    },
  },
  scene: { instance: null },
  decks: {
    [DeckNames.deck1]: {
      instance: null,
      filtersState: {
        bassGain: { value: 0, isActive: false },
        midGain: { value: 0, isActive: false },
        trebleGain: { value: 0, isActive: false },
        colorFX: { value: 0, isActive: false },
        tempo: { value: 0, isActive: false },
      },
    },
    [DeckNames.deck2]: {
      instance: null,
      filtersState: {
        bassGain: { value: 0, isActive: false },
        midGain: { value: 0, isActive: false },
        trebleGain: { value: 0, isActive: false },
        colorFX: { value: 0, isActive: false },
        tempo: { value: 0, isActive: false },
      },
    },
  },
});

/**
 * Returns the scene instance from the UI state
 * @returns The TimelineGenerator instance or null if not initialized
 */
export const getSceneInstance = (): TimelineGenerator | null => {
  return uiState.scene.instance;
};

export default uiState;
