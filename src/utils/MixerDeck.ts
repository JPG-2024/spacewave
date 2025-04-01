import * as THREE from 'three';
import {
  TimelineGenerator,
  PlaybackControls,
  CameraControls,
  // TimelineGeneratorResult // Not directly used here, but controls are
} from '@/utils/generateTimeline'; // Assuming path is correct

// --- Interfaces ---

// State of a single deck instance
export interface DeckState {
  audioContext: AudioContext | null;
  buffer: AudioBuffer | null;
  duration: number;
  currentFileName: string | null;
  gainNode: GainNode | null;
  isPlaying: boolean;
  pausedAt: number; // Time in seconds within the buffer where playback is paused
  playbackRate: number;
  source: AudioBufferSourceNode | null;
  startTime: number; // audioContext.currentTime when the current playback segment started
  tempo: number | null; // Current BPM
  initialTempo: number | null; // BPM detected on load
  timelineGenerator: TimelineGenerator | null;
  timelineControls: PlaybackControls | null;
  cameraControls: CameraControls | null; // Store camera controls if needed
  timelineObject: THREE.Object3D | null; // Store timeline object if needed
  status: 'empty' | 'loading' | 'loaded' | 'playing' | 'paused' | 'error';
  error: string | null;
  bassFilter: BiquadFilterNode | null;
  midFilter: BiquadFilterNode | null;
  trebleFilter: BiquadFilterNode | null;
  colorFXFilter: BiquadFilterNode | null;
}

// --- MixerDeck Class ---

export class MixerDeck {
  private state: DeckState;
  private readonly deckId: string;
  private readonly containerId: string; // DOM element ID for the timeline visualization

  constructor(deckId: string, containerId: string) {
    this.deckId = deckId;
    this.containerId = containerId;
    this.state = this.getInitialState();
    console.log(
      `MixerDeck ${this.deckId} initialized for container #${this.containerId}`,
    );
  }

  private getInitialState(): DeckState {
    // Create AudioContext only once if possible, or handle its lifecycle carefully
    // For simplicity here, we create it on init, but consider sharing or managing it externally.
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    return {
      audioContext: audioContext,
      buffer: null,
      currentFileName: null,
      duration: 0,
      gainNode: null,
      isPlaying: false,
      pausedAt: 0,
      playbackRate: 1,
      source: null,
      startTime: 0,
      tempo: null,
      initialTempo: null,
      timelineGenerator: null,
      timelineControls: null,
      cameraControls: null,
      timelineObject: null,
      status: 'empty',
      error: null,
      bassFilter: null,
      midFilter: null,
      trebleFilter: null,
      colorFXFilter: null,
    };
  }

  // --- Public Methods ---

  /**
   * Loads audio from a URL, analyzes it, and prepares the deck for playback.
   * @param fileName - The URL of the audio file.
   */
  public async loadAudio(fileName: string): Promise<boolean> {
    console.log(`Deck ${this.deckId}: Loading audio from ${fileName}`);
    this.reset(); // Reset state before loading new audio
    this.state.status = 'loading';

    if (!this.state.audioContext) {
      console.error(`Deck ${this.deckId}: AudioContext is not available.`);
      this.state.status = 'error';
      this.state.error = 'AudioContext not available.';
      return false;
    }
    // Ensure AudioContext is running (required after user interaction)
    if (this.state.audioContext.state === 'suspended') {
      try {
        await this.state.audioContext.resume();
      } catch (err) {
        console.error(
          `Deck ${this.deckId}: Failed to resume AudioContext:`,
          err,
        );
        this.state.status = 'error';
        this.state.error = 'Failed to resume AudioContext.';
        return false;
      }
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/${fileName}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      this.state.buffer =
        await this.state.audioContext.decodeAudioData(arrayBuffer);
      this.state.duration = this.state.buffer.duration;
      console.log(
        `Deck ${this.deckId}: Audio decoded, duration: ${this.state.duration.toFixed(2)}s`,
      );

      // Initialize TimelineGenerator
      this.state.timelineGenerator = new TimelineGenerator({
        audioContext: this.state.audioContext,
        containerId: this.containerId,
        audioBuffer: this.state.buffer,
      });

      const { camera, timeLine, playbackControls, tempo } =
        await this.state.timelineGenerator.initialize();

      // Store controls and initial data
      this.state.cameraControls = camera;
      this.state.timelineObject = timeLine;
      this.state.timelineControls = playbackControls;
      this.state.tempo = tempo;
      this.state.initialTempo = tempo; // Store the initial BPM
      this.state.status = 'loaded';
      this.state.error = null;
      this.state.currentFileName = fileName;
      console.log(
        `Deck ${this.deckId}: Audio loaded and timeline initialized. Tempo: ${tempo}`,
      );
      return true;
    } catch (error: any) {
      console.error(`Deck ${this.deckId}: Error loading audio:`, error);
      this.state.status = 'error';
      this.state.error = error.message || 'Unknown error during loading.';
      this.reset(); // Clean up partial state on error
      return false;
    }
  }

  /**
   * Starts or resumes playback from the current position.
   */
  public play(): void {
    if (
      this.state.isPlaying ||
      (this.state.status !== 'loaded' && this.state.status !== 'paused')
    ) {
      console.warn(
        `Deck ${this.deckId}: Cannot play in status ${this.state.status}`,
      );
      return;
    }
    if (
      !this.state.buffer ||
      !this.state.audioContext ||
      !this.state.timelineControls
    ) {
      console.error(
        `Deck ${this.deckId}: Cannot play - buffer, context, or timeline controls missing.`,
      );
      return;
    }

    try {
      // Ensure AudioContext is running
      if (this.state.audioContext.state === 'suspended') {
        this.state.audioContext.resume();
      }

      // Create and configure nodes
      this.state.source = this.state.audioContext.createBufferSource();
      this.state.source.buffer = this.state.buffer;
      this.state.gainNode = this.state.audioContext.createGain();
      this.state.gainNode.gain.value = 1; // Set volume (can be adjusted later)

      // --- Create EQ Filters ---
      const bass = this.state.audioContext.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 250;
      bass.gain.value = 0;
      const mid = this.state.audioContext.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1000;
      mid.Q.value = 1;
      mid.gain.value = 0;
      const treble = this.state.audioContext.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 4000;
      treble.gain.value = 0;

      // Store filters in state
      this.state.bassFilter = bass;
      this.state.midFilter = mid;
      this.state.trebleFilter = treble;

      // Create Color FX Filter
      const colorFX = this.state.audioContext.createBiquadFilter();
      colorFX.type = 'bandpass';
      colorFX.frequency.value = 1000;
      colorFX.Q.value = 0.1; // Resonancia mínima inicial
      colorFX.gain.value = -100; // -100dB = efectivamente sin efecto

      this.state.colorFXFilter = colorFX;

      // Connect audio chain: source -> bass -> mid -> treble -> colorFX -> gain -> destination
      this.state.source.connect(bass);
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(colorFX);
      colorFX.connect(this.state.gainNode);
      this.state.gainNode.connect(this.state.audioContext.destination);

      // Apply playback rate
      this.state.source.playbackRate.value = this.state.playbackRate;

      // Handle track ending
      this.state.source.onended = () => {
        if (this.state.isPlaying) {
          // Only reset if it ended naturally, not via pause/stop
          console.log(`Deck ${this.deckId}: Playback ended.`);
          this.state.isPlaying = false;
          this.state.pausedAt = this.state.duration; // Mark as finished
          this.state.status = 'loaded'; // Or 'finished'?
          this.disconnectNodes();
        }
      };

      // Start playback
      const offset = this.state.pausedAt % this.state.duration; // Ensure offset is within bounds
      this.state.source.start(0, offset);
      this.state.startTime = this.state.audioContext.currentTime; // Record the exact start time
      this.state.isPlaying = true;
      this.state.status = 'playing';

      // Notify timeline visualization
      this.state.timelineControls.play(
        this.state.startTime,
        this.state.playbackRate,
      );

      this.state.timelineControls?.updatePlaybackRate(this.state.playbackRate);

      console.log(`Deck ${this.deckId}: Playing from ${offset.toFixed(2)}s`);
    } catch (error) {
      console.error(`Deck ${this.deckId}: Error playing audio:`, error);
      this.state.status = 'error';
      this.state.error = 'Error during playback initiation.';
      this.disconnectNodes();
    }
  }

  /**
   * Pauses playback at the current position.
   */
  public pause(): void {
    if (
      !this.state.isPlaying ||
      !this.state.source ||
      !this.state.audioContext ||
      !this.state.timelineControls
    ) {
      // console.warn(`Deck ${this.deckId}: Cannot pause, not playing or source invalid.`);
      return;
    }

    try {
      // Calculate elapsed time accurately *before* stopping
      const elapsed =
        (this.state.audioContext.currentTime - this.state.startTime) *
        this.state.playbackRate;
      this.state.pausedAt += elapsed;
      // Clamp pausedAt to duration
      this.state.pausedAt = Math.min(this.state.pausedAt, this.state.duration);

      // Stop the source node
      // Setting onended to null prevents the end-of-track logic from firing on manual pause
      this.state.source.onended = null;
      this.state.source.stop();

      this.state.isPlaying = false;
      this.state.status = 'paused';

      // Notify timeline visualization
      this.state.timelineControls.pause(this.state.pausedAt);

      console.log(
        `Deck ${this.deckId}: Paused at ${this.state.pausedAt.toFixed(2)}s`,
      );
    } catch (error) {
      console.error(`Deck ${this.deckId}: Error pausing audio:`, error);
      // Attempt to clean up even if pausing failed
    } finally {
      // Disconnect nodes after stopping
      this.disconnectNodes();
    }
  }

  /**
   * Seeks to a specific position in the track.
   * @param percentageOffset - The position to seek to, as a value between 0 and 1.
   * @returns The time in seconds seeked to, or undefined if seeking failed.
   */
  public seek(percentageOffset: number): number | undefined {
    if (
      this.state.status === 'loading' ||
      this.state.status === 'empty' ||
      !this.state.buffer
    ) {
      console.warn(
        `Deck ${this.deckId}: Cannot seek in status ${this.state.status} or without buffer.`,
      );
      return undefined;
    }

    try {
      const wasPlaying = this.state.isPlaying;
      if (wasPlaying) {
        this.pause(); // Pause before seeking
      }

      const seekTime = Math.max(
        0,
        Math.min(percentageOffset * this.state.duration, this.state.duration),
      );
      this.state.pausedAt = seekTime;

      console.log(
        `Deck ${this.deckId}: Seeking to ${seekTime.toFixed(2)}s (${(percentageOffset * 100).toFixed(1)}%)`,
      );

      // Update timeline visualization immediately
      this.state.timelineControls?.setSeekPosition(seekTime);

      if (wasPlaying) {
        this.play(); // Resume playback after seeking
      } else {
        // If paused, ensure the timeline reflects the new pausedAt position visually
        // This might already be handled by setSeekPosition, but double-check TimelineGenerator logic
        this.state.timelineControls?.pause(seekTime); // Re-call pause to ensure visual sync
      }

      return seekTime;
    } catch (error) {
      console.error(`Deck ${this.deckId}: Error seeking:`, error);
      return undefined;
    }
  }

  /**
   * Changes the playback tempo (speed) of the track.
   * @param newTempo - The desired tempo in BPM.
   */
  public changeTempo(newTempo: number): void {
    if (!this.state.initialTempo || this.state.status === 'empty') {
      console.warn(
        `Deck ${this.deckId}: Cannot change tempo without initial BPM or buffer.`,
      );
      return;
    }

    const safeTempo = Math.max(30, Math.min(300, newTempo)); // Clamp tempo
    if (this.state.tempo === safeTempo) return; // No change needed

    const newPlaybackRate = safeTempo / this.state.initialTempo;
    const wasPlaying = this.state.isPlaying;
    let pauseTime = this.state.pausedAt; // Use current pausedAt if not playing

    // --- Pause Logic ---
    if (wasPlaying && this.state.source && this.state.audioContext) {
      // Calculate exact pause time before stopping
      const elapsed =
        (this.state.audioContext.currentTime - this.state.startTime) *
        this.state.playbackRate; // Use current rate for calculation
      pauseTime = this.state.pausedAt + elapsed;
      pauseTime = Math.min(pauseTime, this.state.duration); // Clamp

      // Stop the current audio source
      this.state.source.onended = null; // Prevent natural end logic
      try {
        this.state.source.stop();
      } catch (e) {
        console.warn(
          `Deck ${this.deckId}: Error stopping source during tempo change:`,
          e,
        );
      }

      // Update state to reflect pause
      this.state.isPlaying = false;
      this.state.status = 'paused'; // Temporarily paused

      // Notify timeline visualization to pause
      this.state.timelineControls?.pause(pauseTime);

      // Disconnect nodes
      this.disconnectNodes();
    }

    // --- Update State ---
    this.state.pausedAt = pauseTime; // Update pausedAt to the calculated time
    this.state.playbackRate = newPlaybackRate;
    this.state.tempo = safeTempo;

    // Update timeline controls with the new rate (visual scaling/positioning)
    // This needs to happen regardless of playback state
    this.state.timelineControls?.updatePlaybackRate(newPlaybackRate);

    console.log(
      `Deck ${this.deckId}: Tempo changed to ${safeTempo.toFixed(1)} BPM, Playback Rate: ${newPlaybackRate.toFixed(3)}. Paused at: ${pauseTime.toFixed(2)}s`,
    );
    // --- Resume Logic ---
    if (wasPlaying) {
      this.play(); // Restart playback with new rate from the calculated pauseTime
    }
  }

  /**
   * Temporarily nudges the playback forward or backward for beatmatching.
   * @param direction - 'forward' or 'backward'.
   */
  public adjustBeat(direction: 'forward' | 'backward'): void {
    if (
      !this.state.isPlaying ||
      !this.state.source ||
      !this.state.audioContext ||
      !this.state.timelineControls
    ) {
      console.warn(
        `Deck ${this.deckId}: Cannot adjust beat, not playing or source invalid.`,
      );
      return;
    }

    const now = this.state.audioContext.currentTime;
    const nudgeAmount = 0.05; // How much faster/slower temporarily (e.g., 1.05 or 0.95)
    const nudgeDuration = 0.05; // How long the nudge lasts in seconds
    const visualOffsetAmount = direction === 'forward' ? 0.1 : -0.1; // Arbitrary visual offset

    const targetRate =
      this.state.playbackRate *
      (direction === 'forward' ? 1 + nudgeAmount : 1 - nudgeAmount);
    const originalRate = this.state.playbackRate;

    console.log(`Deck ${this.deckId}: Nudging beat ${direction}`);

    // Apply temporary rate change using automation
    this.state.source.playbackRate.cancelScheduledValues(now); // Clear previous automations
    this.state.source.playbackRate.setValueAtTime(originalRate, now);
    this.state.source.playbackRate.linearRampToValueAtTime(
      targetRate,
      now + nudgeDuration / 2,
    );
    this.state.source.playbackRate.linearRampToValueAtTime(
      originalRate,
      now + nudgeDuration,
    );

    // Apply visual offset via timeline controls
    this.state.timelineControls.setOffset(visualOffsetAmount);
    // The offset in TimelineGenerator is reset automatically in its update loop.
  }

  /**
   * Resets the deck to its initial state, stopping playback and clearing audio data.
   */
  public reset(): void {
    console.log(`Deck ${this.deckId}: Resetting state.`);
    if (this.state.isPlaying) {
      this.pause(); // Ensure clean stop and node disconnection
    }

    // Dispose timeline generator if it exists
    if (this.state.timelineGenerator) {
      try {
        this.state.timelineGenerator.dispose();
      } catch (err) {
        console.error(
          `Deck ${this.deckId}: Error disposing timeline generator:`,
          err,
        );
      }
      this.state.timelineGenerator = null;
    }

    // Disconnect any remaining nodes (should be handled by pause, but belt-and-suspenders)
    this.disconnectNodes();

    // Close AudioContext if this deck exclusively owns it
    // if (this.state.audioContext && !sharedAudioContext) { // Logic depends on context management
    //     this.state.audioContext.close().catch(err => console.error(`Deck ${this.deckId}: Error closing AudioContext:`, err));
    // }

    // Reset state variables (keep AudioContext instance for potential reuse)
    const initial = this.getInitialState();
    this.state.buffer = initial.buffer;
    this.state.currentFileName = initial.currentFileName;
    this.state.duration = initial.duration;
    this.state.gainNode = initial.gainNode;
    this.state.isPlaying = initial.isPlaying;
    this.state.pausedAt = initial.pausedAt;
    this.state.playbackRate = initial.playbackRate;
    this.state.source = initial.source;
    this.state.startTime = initial.startTime;
    this.state.tempo = initial.tempo;
    this.state.initialTempo = initial.initialTempo;
    this.state.timelineControls = initial.timelineControls;
    this.state.cameraControls = initial.cameraControls;
    this.state.timelineObject = initial.timelineObject;
    this.state.status = 'empty'; // Set status to empty after reset
    this.state.error = initial.error;
    this.state.bassFilter = initial.bassFilter;
    this.state.midFilter = initial.midFilter;
    this.state.trebleFilter = initial.trebleFilter;
    this.state.colorFXFilter = initial.colorFXFilter;
  }

  /**
   * Fully disposes of the deck and its resources, including the AudioContext.
   * Call this when the deck is no longer needed.
   */
  public dispose(): void {
    console.log(`Deck ${this.deckId}: Disposing...`);
    this.reset(); // Perform a reset first to stop playback and dispose timeline

    // Close the AudioContext
    if (this.state.audioContext) {
      this.state.audioContext
        .close()
        .then(() => console.log(`Deck ${this.deckId}: AudioContext closed.`))
        .catch(err =>
          console.error(
            `Deck ${this.deckId}: Error closing AudioContext:`,
            err,
          ),
        );
      this.state.audioContext = null; // Release reference
    }
    console.log(`Deck ${this.deckId}: Disposed.`);
  }

  // --- Private Helpers ---

  private disconnectNodes(): void {
    if (this.state.source) {
      try {
        this.state.source.disconnect();
      } catch (e) {
        /* Ignore errors if already disconnected */
      }
      this.state.source = null;
    }
    if (this.state.gainNode) {
      try {
        this.state.gainNode.disconnect();
      } catch (e) {
        /* Ignore errors if already disconnected */
      }
      this.state.gainNode = null;
    }
    if (this.state.bassFilter) {
      try {
        this.state.bassFilter.disconnect();
      } catch (e) {
        /* Ignore errors if already disconnected */
      }
      this.state.bassFilter = null;
    }
    if (this.state.midFilter) {
      try {
        this.state.midFilter.disconnect();
      } catch (e) {
        /* Ignore errors if already disconnected */
      }
      this.state.midFilter = null;
    }
    if (this.state.trebleFilter) {
      try {
        this.state.trebleFilter.disconnect();
      } catch (e) {
        /* Ignore errors if already disconnected */
      }
      this.state.trebleFilter = null;
    }
    if (this.state.colorFXFilter) {
      try {
        this.state.colorFXFilter.disconnect();
      } catch (e) {
        /* Ignore errors if already disconnected */
      }
      this.state.colorFXFilter = null;
    }
  }

  // --- Getters for State Access ---

  public get id(): string {
    return this.deckId;
  }

  public get currentStatus(): DeckState['status'] {
    return this.state.status;
  }

  public get errorMessage(): string | null {
    return this.state.error;
  }

  public get isPlayingState(): boolean {
    return this.state.isPlaying;
  }

  public get initialTempo(): number | null {
    return this.state.initialTempo;
  }

  public get currentTempo(): number | null {
    return this.state.tempo;
  }

  public get currentPlaybackRate(): number {
    return this.state.playbackRate;
  }

  public get trackDuration(): number {
    return this.state.duration;
  }

  /**
   * Gets the current playback time in seconds.
   */
  public get currentTime(): number {
    if (!this.state.audioContext) return this.state.pausedAt;

    if (this.state.isPlaying) {
      const elapsed =
        (this.state.audioContext.currentTime - this.state.startTime) *
        this.state.playbackRate;
      return Math.min(this.state.pausedAt + elapsed, this.state.duration);
    } else {
      return this.state.pausedAt;
    }
  }

  /**
   * Gets the current playback position as a percentage (0 to 1).
   */
  public get currentPositionPercentage(): number {
    if (this.state.duration <= 0) return 0;
    return this.currentTime / this.state.duration;
  }

  /**
   * Provides access to currentFileName, if available.
   */
  public get currentFileName(): string | null {
    return this.state.currentFileName;
  }

  /**
   * Provides access to the timeline's camera controls, if available.
   */
  public get camera(): CameraControls | null {
    return this.state.cameraControls;
  }

  /**
   * Provides access to the THREE.js object representing the timeline, if available.
   */
  public get timeline(): THREE.Object3D | null {
    return this.state.timelineObject;
  }

  // --- Public Methods for EQ Control ---

  public setBassGain(gain: number): void {
    if (this.state.bassFilter && this.state.audioContext) {
      this.state.bassFilter.gain.setValueAtTime(
        gain,
        this.state.audioContext.currentTime,
      );
    }
  }

  public setMidGain(gain: number): void {
    if (this.state.midFilter && this.state.audioContext) {
      this.state.midFilter.gain.setValueAtTime(
        gain,
        this.state.audioContext.currentTime,
      );
    }
  }

  public setTrebleGain(gain: number): void {
    if (this.state.trebleFilter && this.state.audioContext) {
      this.state.trebleFilter.gain.setValueAtTime(
        gain,
        this.state.audioContext.currentTime,
      );
    }
  }

  // --- Public Methods for Color FX Control ---

  /**
   * Controls the Color FX filter parameters
   * @param frequency - Frequency in Hz (range: 20Hz - 20000Hz)
   * @param resonance - Q factor/resonance (range: 0.1 - 25.0)
   * @param mix - Dry/Wet mix (range: 0.0 - 1.0)
   */
  public setColorFX(frequency: number, resonance: number, mix: number): void {
    if (this.state.colorFXFilter && this.state.audioContext) {
      const now = this.state.audioContext.currentTime;

      // Frequency range: 20Hz - 20000Hz (full audible spectrum)
      const safeFreq = Math.max(20, Math.min(20000, frequency));

      // Resonance (Q) range: 0.1 - 25.0 (from subtle to extreme resonance)
      const safeQ = Math.max(0.1, Math.min(25.0, resonance));

      // Mix range: 0.0 - 1.0 (dry to wet)
      const safeMix = Math.max(0, Math.min(1, mix));

      // Aplica los cambios al filtro
      this.state.colorFXFilter.frequency.setValueAtTime(safeFreq, now);
      this.state.colorFXFilter.Q.setValueAtTime(safeQ, now);

      // Convierte el mix a ganancia (dB)
      // 0 = -Infinity dB (silencio total)
      // 0.5 = 0dB (señal original)
      // 1.0 = +20dB (amplificación máxima)
      const gainInDB = safeMix === 0 ? -100 : safeMix * 40 - 20;
      this.state.colorFXFilter.gain.setValueAtTime(gainInDB, now);
    }
  }
}
