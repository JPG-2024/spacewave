import { useRef, useCallback, MutableRefObject } from 'react';
// Import the new class and potentially its result/control types
import {
  TimelineGenerator,
  // TimelineGeneratorResult, // Not directly used here, but controls are
  PlaybackControls,
  CameraControls,
} from '@/utils/generateTimeline';
import * as THREE from 'three'; // Import THREE if timeline ref holds Object3D

export interface Deck {
  audioContext: AudioContext;
  buffer: AudioBuffer | null;
  duration: number;
  gainNode: GainNode | null;
  isPlaying: boolean;
  pausedAt: number;
  playbackRate: number;
  source: AudioBufferSourceNode | null;
  startTime: number;
  tempo: number | null;
  timelineControls: PlaybackControls | null; // Use specific type
  trackPositionPercentage: number;
  deckState: 'free' | 'loading' | 'mounted';
  bpmOffset?: number;
  bpm: number | null;
  initialBpm?: number | null;
}

// Type for the refs passed to loadAudio
interface LoadAudioRefs {
  cameraRef: MutableRefObject<CameraControls | null>;
  timeline: MutableRefObject<THREE.Object3D | null>; // Assuming timeline ref holds the Object3D
}

export interface DeckInstance extends Deck {
  play: () => Promise<void>;
  pause: () => void;
  changeTempo: (newTempo: number) => Promise<void>;
  getTempo: () => number | null;
  getDeckState: () => 'free' | 'loading' | 'mounted' | undefined; // Allow undefined
  getIsPlaying: () => boolean;
  seek: (offset: number) => number | undefined;
  autoSyncTempo: () => Promise<void>; // Changed return type
  adjustBeat: (direction: 'forward' | 'backward') => void;
  scaleWaveform: (scale: number) => void;
}

// Store deck data separately from the timeline generator instance
interface DeckMap {
  [key: string]: Deck;
}
interface MixerState {
  decks: DeckMap;
  timelineGenerator: TimelineGenerator | null;
}

export default function useMixer() {
  // Initialize with separate decks and generator properties
  const mixerState = useRef<MixerState>({
    decks: {},
    timelineGenerator: null,
  });

  const resetState = useCallback((deckId: string) => {
    const deck = mixerState.current.decks[deckId];
    if (!deck) return; // Guard if deck doesn't exist

    Object.assign(deck, {
      pausedAt: 0,
      startTime: 0,
      playbackRate: 1,
      bpm: null,
      timelineControls: null, // Reset controls
      tempo: null,
      deckState: 'free',
      initialBpm: null,
      bpmOffset: 0,
    });
  }, []);

  const initializeDeck = useCallback((deckId: string): Deck => {
    // Added return type
    const deck: Deck = {
      audioContext: new (window.AudioContext ||
        (window as any).webkitAudioContext)(),
      buffer: null,
      duration: 0,
      gainNode: null,
      isPlaying: false,
      pausedAt: 0,
      playbackRate: 1,
      source: null,
      startTime: 0,
      tempo: null,
      timelineControls: null,
      trackPositionPercentage: 0,
      deckState: 'free',
      bpm: null,
      bpmOffset: 0,
      initialBpm: null,
    };

    mixerState.current.decks[deckId] = deck; // Store in decks map

    return deck;
  }, []);

  const isPlaying = useCallback((deckId: string): boolean => {
    // Added return type
    return mixerState.current.decks[deckId]?.isPlaying ?? false; // Added null check
  }, []);

  const loadAudio = useCallback(
    (
      deckId: string,
      { refs }: { refs: LoadAudioRefs }, // Add type for refs
    ) =>
      async (url: string) => {
        try {
          // Ensure deck is initialized if it doesn't exist
          if (!mixerState.current.decks[deckId]) {
            mixerState.current.decks[deckId] = initializeDeck(deckId);
          }
          const deck = mixerState.current.decks[deckId];

          deck.deckState = 'loading';

          if (deck.isPlaying) {
            pause(deckId)();
          }

          // Dispose previous timeline generator if it exists
          if (mixerState.current.timelineGenerator) {
            console.log('Disposing previous timeline generator...');
            mixerState.current.timelineGenerator.dispose();
            mixerState.current.timelineGenerator = null;
          }

          const audioFile = await fetch(url);
          const arrayBuffer = await audioFile.arrayBuffer();
          deck.buffer = await deck.audioContext.decodeAudioData(arrayBuffer); // decodedBuffer
          deck.duration = deck.buffer.duration;

          console.log(
            `Audio decoded for ${deckId}, duration: ${deck.duration.toFixed(
              2,
            )}s`,
          );

          // --- Use the new TimelineGenerator class ---
          const timelineGenerator = new TimelineGenerator({
            audioContext: deck.audioContext,
            containerId: 'deck1webfl', // Make sure this ID exists in your DOM
            audioBuffer: deck.buffer,
          });
          const { camera, timeLine, playbackControls, tempo } =
            await timelineGenerator.initialize();

          refs.cameraRef.current = camera;
          refs.timeline.current = timeLine;
          deck.timelineControls = playbackControls;
          deck.tempo = tempo; // Store tempo if needed
          mixerState.current.timelineGenerator = timelineGenerator; // Store the instance
          deck.deckState = 'mounted';
        } catch (error) {
          console.error('Error loading audio:', error);
          return false;
        }
      },
    [],
  );

  const play = useCallback(
    (deckId: string) => async () => {
      try {
        const deck = mixerState.current.decks[deckId];
        if (!deck) return; // Guard if deck doesn't exist

        if (!deck.isPlaying && deck.buffer && deck.audioContext) {
          deck.source = deck.audioContext.createBufferSource();
          deck.source.buffer = deck.buffer;

          deck.gainNode = deck.audioContext.createGain();
          deck.gainNode.gain.value = 1;

          deck.source.connect(deck.gainNode);
          deck.gainNode.connect(deck.audioContext.destination);

          deck.source.playbackRate.value = deck.playbackRate;

          if (deck.audioContext.state === 'suspended') {
            deck.audioContext.resume();
          }
          deck.source.start(0, deck.pausedAt);
          deck.startTime = deck.audioContext.currentTime;

          // Use the stored timeline controls
          deck.timelineControls?.play(deck.startTime, deck.playbackRate);

          deck.isPlaying = true;

          console.log('Playing audio...', deck);
        }
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    },
    [],
  );

  const pause = useCallback(
    (deckId: string) =>
      (offset: number = 0) => {
        try {
          const deck = mixerState.current.decks[deckId];

          // guard
          if (!deck?.isPlaying || !deck.source || !deck.audioContext) return; // Exit if not playing or source invalid

          deck.isPlaying = false;
          //TODO: Implementar pausa

          if (deck.source) {
            deck.source.stop();
            deck.source.disconnect();
            deck.source = null;
          }

          if (deck.gainNode) {
            deck.gainNode.disconnect();
            deck.gainNode = null;
          }

          // CORRECCIÓN: Calcular tiempo acumulado con playbackRate
          // Calculate elapsed time accurately
          const elapsed =
            deck.audioContext.currentTime - deck.startTime + offset;
          deck.pausedAt += elapsed * deck.playbackRate;
          // Clamp pausedAt to duration
          deck.pausedAt = Math.min(deck.pausedAt, deck.duration);
          // Add null check for deck.buffer
          deck.trackPositionPercentage =
            deck.duration > 0 && deck.buffer
              ? deck.pausedAt / deck.buffer.duration
              : 0;
          // Add optional chaining for timelineControls
          deck.timelineControls?.pause(deck.pausedAt);
        } catch (error) {
          console.error('Error pausing audio:', error);
        }
      },
    [],
  );

  // offset es un valor entre 0 y 1 representando el porcentaje del track
  const seek = useCallback(
    (deckId: string, percentageOffset: number): number | undefined => {
      try {
        const deck = mixerState.current.decks[deckId];
        if (!deck) return undefined; // Guard if deck doesn't exist

        const wasPlaying = deck.isPlaying;

        if (wasPlaying) pause(deckId)(); // Pause before seeking

        if (!deck.buffer || deck.duration <= 0) return undefined; // Return undefined if no buffer

        const seekTime = percentageOffset * deck.buffer.duration;
        deck.pausedAt = seekTime;

        if (wasPlaying) play(deckId)(); // Resume if it was playing

        // Add optional chaining for timelineControls
        deck.timelineControls?.setSeekPosition(seekTime);

        return seekTime;
      } catch (error) {
        console.error('Error adjusting track position:', error);
      }
    },
    [],
  );

  const getTempo = useCallback((deckId: string): number | null => {
    // Added type
    const tempo = mixerState.current.decks[deckId]?.bpm;
    return tempo;
  }, []);

  const getDeckState = useCallback(
    (deckId: string): Deck['deckState'] | undefined => {
      // Added type
      return mixerState.current.decks[deckId]?.deckState;
    },
    [],
  );

  const getIsPlaying = useCallback((deckId: string): boolean => {
    // Added type
    return mixerState.current.decks[deckId]?.isPlaying ?? false; // Added null check
  }, []);

  const autoSyncTempo = useCallback(async (deckId: string): Promise<void> => {
    // Added type, changed return type
    const deck1 = mixerState.current.decks['deck1'];
    const deck2 = mixerState.current.decks['deck2'];
    if (!deck1?.bpm && !deck2?.bpm) {
      // Guard if no tempos available
      console.warn('Cannot autoSyncTempo: No source tempo available.');
      return;
    }

    const newTempo = deckId === 'deck1' ? deck2?.bpm : deck1?.bpm;
    if (newTempo === null || newTempo === undefined) {
      console.warn('Cannot autoSyncTempo: Target tempo is null.');
      return;
    }

    console.warn(
      'AutoSyncTempo calls changeTempo which might not update visualization.',
    );
    await changeTempo(deckId, newTempo);

    // Removed return as function now returns void
  }, []);

  const changeTempo = useCallback(async (deckId: string, newTempo: number) => {
    // Added types
    const deck = mixerState.current.decks[deckId];
    if (!deck) return; // Guard if deck doesn't exist

    if (!deck.buffer || !deck.bpm || !deck.initialBpm) return;

    const safeTempo = Math.max(30, Math.min(300, newTempo)); // Clamp tempo between 30 and 300 BPM
    deck.bpm = newTempo;
    const playbackRate = newTempo / deck.initialBpm; // Calculate the new playback rate
    deck.playbackRate = playbackRate; // Apply the rate
    // The timeline visualization itself doesn't change with tempo in the current setup.
    // If you need visual changes (e.g., stretching waveform), that logic
    // would need to be added to TimelineGenerator or handled here.
    // The generateTimelineGraph call seemed incorrect/incomplete.
    console.warn('changeTempo only adjusts playbackRate, not visualization.');
    // Consider updating the source node's playbackRate if playing
  }, []);

  const adjustBeat = useCallback(
    (deckId: string, direction: 'forward' | 'backward' = 'forward') => {
      const deck = mixerState.current.decks[deckId];
      if (!deck?.source || !deck.audioContext) return; // Added audioContext check

      const now = deck.audioContext.currentTime;
      const speedMultiplier = direction === 'forward' ? 1.5 : 0.5;
      const offsetDirection = direction === 'forward' ? 0.5 : -0.5;

      deck.source.playbackRate.setValueAtTime(1.0, now);
      deck.source.playbackRate.linearRampToValueAtTime(
        speedMultiplier,
        now + 0.01,
      );
      deck.source.playbackRate.linearRampToValueAtTime(1.0, now + 0.02);

      // Use timeline controls to apply visual offset - Added optional chaining
      deck.timelineControls?.setOffset(offsetDirection);
    },
    [],
  );

  const adjustPosition = useCallback((deckId: string, offset: number) => {
    // const deck = decks.current[deckId];

    pause(deckId)();
    setTimeout(() => {
      play(deckId)();
    }, 0.000001);
  }, []);

  const scaleWaveform = useCallback((deckId: string, scale: number) => {
    const deck = mixerState.current.decks[deckId]; // Corrected typo: decks -> mixerState
    // Scaling logic needs to be implemented within TimelineGenerator or here
    console.warn('scaleWaveform is not implemented in TimelineGenerator yet.');
    // deck.timelineControls.scaleWaveform(scale); // Original call, might error if method doesn't exist
  }, []);

  const getDeckInstance = useCallback(
    (deckId: string): DeckInstance | null => {
      const deck = mixerState.current.decks[deckId];
      if (!deck) return null;
      return {
        ...deck,
        play: play(deckId),
        pause: pause(deckId),
        changeTempo: async (newTempo: number) => changeTempo(deckId, newTempo), // Keep async signature if needed elsewhere
        getTempo: () => getTempo(deckId),
        getDeckState: () => getDeckState(deckId),
        getIsPlaying: () => getIsPlaying(deckId),
        seek: (offset: number) => seek(deckId, offset),
        scaleWaveform: (scale: number) => scaleWaveform(deckId, scale),
        autoSyncTempo: () => autoSyncTempo(deckId), // Returns Promise<void> now
        adjustBeat: (direction: 'forward' | 'backward') =>
          adjustBeat(deckId, direction),
      };
    },
    [
      mixerState, // Corrected dependency
      play,
      pause,
      changeTempo,
      getTempo,
      getDeckState,
      getIsPlaying,
      seek,
      scaleWaveform,
      autoSyncTempo,
      adjustBeat,
    ], // Added missing dependencies
  );

  return {
    decks: mixerState.current.decks, // Expose the decks map
    loadAudio,
    play,
    pause,
    isPlaying,
    initializeDeck,
    getTempo,
    changeTempo, // Expose the potentially disabled function
    getDeckState,
    getIsPlaying,
    getDeckInstance,
  };
}
