import { proxy } from 'valtio';

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
  camera: { currentMode: string; positions: CameraPositions };
  filters: Filters;
}

const uiState = proxy<UIState>({
  camera: {
    currentMode: 'side',
    positions: {
      isometric: 0,
      side: 0,
      closeSide: 0,
      closeSideRight: 0,
    },
  },
  filters: {
    bassGain: { value: 0, isActive: false },
    midGain: { value: 0, isActive: false },
    trebleGain: { value: 0, isActive: false },
    colorFX: { value: 0, isActive: false },
    tempo: { value: 0, isActive: false },
  },
});

export default uiState;
