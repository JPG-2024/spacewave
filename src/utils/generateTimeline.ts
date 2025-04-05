import * as THREE from 'three';
// Assuming WaveformDataResponse is exported from waveformTracker - Using any for now
import {
  generateWaveformData,
  // WaveformDataResponse, // TODO: Export this type from waveformTracker.ts
} from '@/utils/waveformTracker';

const ISOMETRIC_POSITIONS = {
  isometric: [
    [5, 5, 5],
    [-5, 5, 5],
    [-5, 5, -5],
    [5, 5, -5],
  ],
  side: [
    [0, 0, 4],
    [0, 0, 10],
    [0, 0, 40],
    [0, 0, 90],
  ],
  closeSide: [
    [6, 0, 3],
    [20, 0, 4],
    [6, 0, 3],
    [20, 0, 4],
  ],
  closeSideRight: [
    [-6, 0, 3],
    [-90, 90, 90],
  ],
};

// Define colors using THREE.Color for consistency
// Define colors using THREE.Color for consistency
const HARMONIC_COLOR = new THREE.Color(0x3db8ff);
const BEAT_WAVE_COLOR = new THREE.Color(0xff4271);
const BEAT_MARK_COLOR = new THREE.Color(0xffffff);
const CENTER_MARKER_COLOR = new THREE.Color(0xcff075);

// --- Interfaces for better type safety ---
interface GenerateTimelineParams {
  containerId: string;
}

export interface PlaybackControls {
  play: (deckId: string, startTime?: number, playbackRate?: number) => void;
  pause: (deckId: string, pausedAt: number) => void;
  setPosition: (deckId: string) => void; // Consider renaming for clarity if it just updates position
  setOffset: (deckId: string, offset: number) => void;
  setSeekPosition: (deckId: string, seekTime: number) => void;
  updatePlaybackRate: (deckId: string, newRate: number) => void; // Add method to update rate during playback
}

type CameraPositionMode = 'isometric' | 'side' | 'closeSide' | 'closeSideRight';

// Use type intersection to combine PerspectiveCamera with our custom method
export type CameraControls = THREE.PerspectiveCamera & {
  cameraMatrix: (mode: CameraPositionMode, value: number) => void;
  ISOMETRIC_POSITIONS: typeof ISOMETRIC_POSITIONS;
};

interface TimelineGeneratorResult {
  camera: CameraControls;
  playbackControls: PlaybackControls;
  toggleAntialias: (enable: boolean) => void; // Method to toggle antialiasing
}

// Define a basic type for harmony sections until it's properly defined/imported
interface HarmonySection {
  start: number;
  end: number;
}

// Define a type for the waveform data response (using any for now)
// TODO: Replace 'any' with the actual WaveformDataResponse type when available
type WaveformDataResponseType = any;

// --- The main TimelineGenerator Class ---
export class TimelineGenerator {
  // --- Private Properties ---
  private scene: THREE.Scene | null = null;
  private camera: CameraControls | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private animationFrameId: number | null = null;
  private starFieldGroup: THREE.Group | null = null; // Group for the star field
  private centerMarker: THREE.Mesh | null = null; // Separate marker
  private container: HTMLElement | null = null;
  private needsRender: boolean = true; // Flag for conditional rendering
  private readonly scaleLerpFactor: number = 0.1; // Adjust for animation speed (0-1)
  private isRendering: boolean = false;
  private frameId: number | null = null;
  private cameraTargetPosition: THREE.Vector3 | null = null;
  private cameraStartPosition: THREE.Vector3 | null = null;
  private cameraAnimationStartTime: number | null = null;
  private cameraAnimationDuration: number = 1000; // Aumentamos a 1 segundo para ver mejor la animación

  // State object to store deck-specific properties
  private state: Record<
    string,
    {
      timelineGroup: THREE.Group | null;
      audioContext: AudioContext;
      trackDuration: number;
      waveformData: WaveformDataResponseType;
      pausedAt: number;
      startTime: number;
      playbackRate: number;
      offset: number;
      isPlaying: boolean;
      needsRender: boolean;
      currentTimelineScaleX: number;
      targetTimelineScaleX: number;
    }
  > = {};

  // Configuration for camera positions
  public readonly ISOMETRIC_POSITIONS = {
    isometric: [
      [5, 5, 5],
      [-5, 5, 5],
      [-5, 5, -5],
      [5, 5, -5],
    ],
    side: [
      [0, 0, 4],
      [0, 0, 10],
      [0, 0, 40],
      [0, 0, 90],
    ],
    closeSide: [
      [6, 0, 3],
      [20, 0, 4],
      [6, 0, 3],
      [20, 0, 4],
    ],
    closeSideRight: [
      [-6, 0, 3],
      [-150, 20, 60],
    ],
  };

  // --- Constructor ---
  constructor({ containerId }: GenerateTimelineParams) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      // More specific error message
      throw new Error(
        `TimelineGenerator: Container element with id "${containerId}" not found.`,
      );
    }
  }

  // --- Public Initialization Method ---
  public async initialize(): Promise<TimelineGeneratorResult> {
    // Setup Three.js environment
    this.setupScene();
    this.setupRenderer();
    this.setupCamera();

    // Create center marker and star field
    this.createCenterMarker();
    this.starFieldGroup = this.createStarField();

    const initialX = window.innerWidth / 2;
    this.starFieldGroup.position.x = initialX;

    this.scene!.add(this.starFieldGroup);

    // Add event listeners
    this.addEventListeners();

    // Ensure animation loop is running
    if (!this.animationFrameId) {
      this.needsRender = true;
      this.startRenderLoop(); // Iniciar el loop de renderizado
    }

    return {
      camera: this.camera!,
      playbackControls: this.createPlaybackControls(),
      toggleAntialias: this.toggleAntialias.bind(this),
    };
  }

  // --- Public Method to Toggle Antialias ---
  public toggleAntialias(enable: boolean): void {
    if (!this.renderer || !this.container) {
      console.warn('Renderer or container is not initialized.');
      return;
    }

    // Dispose the current renderer
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);

    // Create a new renderer with the updated antialias setting
    this.renderer = new THREE.WebGLRenderer({
      antialias: enable,
      alpha: true, // Preserve transparency
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Append the new renderer's canvas to the container
    this.container.appendChild(this.renderer.domElement);

    console.log(`Antialiasing has been ${enable ? 'enabled' : 'disabled'}.`);
  }

  // --- Private Setup Methods ---
  private setupScene(): void {
    if (!this.scene) {
      this.scene = new THREE.Scene();
      this.scene.name = 'MainScene';
    } else {
      this.cleanupScene(); // Clear previous objects if reusing
    }
  }

  private cleanupScene(): void {
    if (!this.scene) return;

    // Remove center marker if it exists
    if (this.centerMarker) {
      this.scene.remove(this.centerMarker);
      this.centerMarker.geometry?.dispose();
      if (Array.isArray(this.centerMarker.material)) {
        // Add type annotation for 'm'
        this.centerMarker.material.forEach((m: THREE.Material) => m.dispose());
      } else {
        this.centerMarker.material?.dispose();
      }
      this.centerMarker = null;
    }

    // Remove all timeline groups and dispose their contents
    Object.keys(this.state).forEach(deckId => {
      const deckState = this.state[deckId];
      if (deckState.timelineGroup) {
        this.scene!.remove(deckState.timelineGroup);
        // Dispose children of the group
        deckState.timelineGroup.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            object.geometry?.dispose();
            if (Array.isArray(object.material)) {
              // Add type annotation for 'mat'
              object.material.forEach((mat: THREE.Material) => mat.dispose());
            } else {
              object.material?.dispose();
            }
          }
        });
        deckState.timelineGroup = null; // Allow garbage collection
      }
    });

    // Clear the state object
    this.state = {};

    // Remove star field group and dispose its contents
    if (this.starFieldGroup) {
      this.scene.remove(this.starFieldGroup);
      this.starFieldGroup.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Points) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
      this.starFieldGroup = null;
    }

    // Optional: Clear any other scene-specific objects here
  }

  private setupRenderer(): void {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true, // For transparent background
      });
      this.renderer.setPixelRatio(window.devicePixelRatio); // Adjust for screen density
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.container!.appendChild(this.renderer.domElement);
    } else {
      // Ensure size is updated if the window was resized before reinitialization
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  private setupCamera(): void {
    if (!this.camera) {
      const aspect = window.innerWidth / window.innerHeight;
      // Cast to CameraControls to satisfy the interface
      this.camera = new THREE.PerspectiveCamera(
        50,
        aspect,
        0.1,
        1000,
      ) as CameraControls; // Increased far plane
      this.camera.position.set(0, 0, 4); // Default starting position
      this.camera.lookAt(0, 0, 0);
      // Add the custom cameraMatrix method to this instance
      this.camera.cameraMatrix = this.cameraMatrix.bind(this);
      this.camera.ISOMETRIC_POSITIONS = this.ISOMETRIC_POSITIONS;
    } else {
      // Update aspect ratio if reusing
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }
  }

  // --- Public Visualization Method ---
  public async createWaveformVisualization(
    deckId: string,
    audioContext: AudioContext,
    audioBuffer: AudioBuffer,
  ): Promise<{ tempoData: any }> {
    // Initialize state for this deck
    this.state[deckId] = {
      timelineGroup: null,
      audioContext,
      trackDuration: audioBuffer.duration,
      waveformData: null as any,
      pausedAt: 0,
      startTime: 0,
      playbackRate: 1,
      offset: 0,
      isPlaying: false,
      needsRender: true,
      currentTimelineScaleX: 1,
      targetTimelineScaleX: 1,
    };

    // Remove existing timeline group for this deck if it exists
    if (this.scene) {
      const existingGroup = this.scene.getObjectByName(
        `WaveformGroup-${deckId}`,
      );
      if (existingGroup) {
        this.scene.remove(existingGroup);
      }
    }

    // Generate waveform data
    this.state[deckId].waveformData = await generateWaveformData({
      audioBuffer,
      pixelsPerSecond: 90,
    });

    const {
      waveformData: samples, // Renamed for clarity
      tempoData: { firstBeatOffset, beatInterval, harmonySections },
    } = this.state[deckId].waveformData;
    const duration = this.state[deckId].trackDuration;
    const scaleY = 1.5; // Vertical scale factor for waveform
    const waveformWidth = window.innerWidth; // Width of the visualization area

    // Create a new timeline group for this deck
    this.state[deckId].timelineGroup = new THREE.Group();
    this.state[deckId].timelineGroup.name = `WaveformGroup-${deckId}`;

    // Position the timeline group
    const initialX = window.innerWidth / 2;
    this.state[deckId].timelineGroup.position.x = initialX; // Initial position for 0 progress

    // --- Create Consolidated Waveform Geometry (Optimization) ---
    if (samples.length < 2) {
      console.warn('Not enough waveform samples to draw a line.');
      return { tempoData: this.state[deckId].waveformData.tempoData };
    }

    const positions: number[] = [];
    const colors: number[] = [];
    const timePerPoint = duration / (samples.length - 1);

    // Sort harmony sections for efficient processing
    const sortedHarmonySections = [...harmonySections].sort(
      (a: HarmonySection, b: HarmonySection) => a.start - b.start,
    );
    let harmonyIndex = 0;

    for (let i = 0; i < samples.length - 1; i++) {
      const currentTimeStart = i * timePerPoint;

      // Determine color based on harmony sections
      let isHarmonic = false;
      // Check if the *start* of this segment falls within any harmony section
      while (
        harmonyIndex < sortedHarmonySections.length &&
        sortedHarmonySections[harmonyIndex].end < currentTimeStart
      ) {
        harmonyIndex++; // Move to the next relevant harmony section
      }
      if (
        harmonyIndex < sortedHarmonySections.length &&
        currentTimeStart >= sortedHarmonySections[harmonyIndex].start &&
        currentTimeStart < sortedHarmonySections[harmonyIndex].end
      ) {
        isHarmonic = true;
      }

      const color = isHarmonic ? HARMONIC_COLOR : BEAT_WAVE_COLOR;

      // Calculate vertex positions for the segment
      const x1 = (i / (samples.length - 1)) * waveformWidth - waveformWidth / 2;
      const y1 = samples[i] * scaleY;
      const x2 =
        ((i + 1) / (samples.length - 1)) * waveformWidth - waveformWidth / 2;
      const y2 = samples[i + 1] * scaleY;

      // Add positions for the line segment (start and end point)
      positions.push(x1, y1, 0, x2, y2, 0);

      // Add colors for both vertices of the segment
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true, // Use vertex colors
      linewidth: 1, // Adjust line width if needed
    });

    const waveformLineSegments = new THREE.LineSegments(geometry, material);
    waveformLineSegments.name = 'WaveformLineSegments';
    this.state[deckId].timelineGroup!.add(waveformLineSegments);

    // --- Create Consolidated Beat Markers (Optimization) ---
    if (beatInterval && beatInterval > 0) {
      const beatPositions: number[] = [];
      const numBeats = Math.floor((duration - firstBeatOffset) / beatInterval);

      for (let i = 0; i <= numBeats; i++) {
        const beatTime = firstBeatOffset + i * beatInterval;
        if (beatTime > duration) break; // Ensure we don't go past duration

        const beatX = (beatTime / duration) * waveformWidth - waveformWidth / 2;
        const yTop = scaleY / 2;
        const yBottom = -scaleY / 2;
        const z = -0.05; // Keep slightly behind waveform

        // Add positions for the vertical line segment (bottom point, top point)
        beatPositions.push(beatX, yBottom, z, beatX, yTop, z);
      }

      if (beatPositions.length > 0) {
        const beatGeometry = new THREE.BufferGeometry();
        beatGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(beatPositions, 3),
        );

        const beatMaterial = new THREE.LineBasicMaterial({
          color: BEAT_MARK_COLOR,
          linewidth: 2, // Note: linewidth > 1 might not work consistently across platforms/drivers
          transparent: false,
          opacity: 1.0,
        });

        const beatLineSegments = new THREE.LineSegments(
          beatGeometry,
          beatMaterial,
        );
        beatLineSegments.name = 'BeatLineSegments';
        this.state[deckId].timelineGroup!.add(beatLineSegments);
      }
    } else {
      console.log('No beat interval data, skipping beat markers.');
    }

    // Add the timeline group to the scene
    this.scene!.add(this.state[deckId].timelineGroup!);

    return { tempoData: this.state[deckId].waveformData.tempoData };
  }

  private createCenterMarker(): void {
    if (!this.scene) return;

    // Define dimensions
    const outerSize = 1.0; // Tamaño exterior del marco cuadrado
    const innerSize = 0.9; // Tamaño del agujero interior
    const thickness = 0.05; // Grosor del marco

    // Crear la forma exterior (cuadrado)
    const shape = new THREE.Shape();
    shape.moveTo(-outerSize / 2, -outerSize / 2);
    shape.lineTo(outerSize / 2, -outerSize / 2);
    shape.lineTo(outerSize / 2, outerSize / 2);
    shape.lineTo(-outerSize / 2, outerSize / 2);
    shape.lineTo(-outerSize / 2, -outerSize / 2);

    // Crear el agujero (cuadrado interior)
    const hole = new THREE.Path();
    hole.moveTo(-innerSize / 2, -innerSize / 2);
    hole.lineTo(innerSize / 2, -innerSize / 2);
    hole.lineTo(innerSize / 2, innerSize / 2);
    hole.lineTo(-innerSize / 2, innerSize / 2);
    hole.lineTo(-innerSize / 2, -innerSize / 2);
    shape.holes.push(hole);

    // Extruir la forma
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false,
    };

    const markerGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    markerGeometry.rotateX(Math.PI / 2); // Rotar para que quede horizontal
    markerGeometry.rotateZ(Math.PI / 2); // Rotar para que quede horizontal
    markerGeometry.translate(-thickness / 2, 0, 0.1);

    markerGeometry.scale(1.2, 2.5, 1); // Escalar para que quepa en el centro

    // Optimization: Use MeshBasicMaterial for simpler rendering (no lighting)
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: CENTER_MARKER_COLOR,
      side: THREE.DoubleSide, // Keep double side for visibility
      transparent: false, // Assuming it should be opaque
      opacity: 1.0,
      // depthTest: true, // Keep depth testing if needed for correct layering
      // depthWrite: true, // Keep depth writing if needed
    });

    this.centerMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.centerMarker.name = 'CenterMarker';
    //this.centerMarker.position.set(0, 0, 0.1);
    this.scene.add(this.centerMarker);
  }

  private createStarField(): THREE.Group {
    const starGroup = new THREE.Group();
    starGroup.name = 'StarField';

    const starCount = 10000;
    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3); // Optional: for varied star colors

    const waveformWidth = window.innerWidth; // Use the same width reference
    const spreadZ = 100;
    const spread = {
      x: waveformWidth * 1.5,
      y: window.innerHeight * 0.5,
      z: spreadZ,
    }; // Adjust spread as needed

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      // Position stars relative to the center (0,0,0) of the group
      positions[i3] = (Math.random() - 0.5) * spread.x;
      positions[i3 + 1] = (Math.random() - 0.5) * spread.y;
      positions[i3 + 2] = (Math.random() - 0.5) * spread.z - spread.z / 2; // Push stars back slightly

      // Optional: Randomize star brightness/color slightly
      const brightness = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
      colors[i3] = brightness;
      colors[i3 + 1] = brightness;
      colors[i3 + 2] = brightness;
    }

    starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3),
    );
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); // Use vertex colors

    const starMaterial = new THREE.PointsMaterial({
      size: 0.02, // Adjust size
      sizeAttenuation: true, // Stars shrink with distance
      vertexColors: true, // Use the 'color' attribute
      transparent: true,
      opacity: 0.9,
      depthWrite: false, // Avoid stars obscuring each other unnaturally
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.translateX(window.innerWidth / 3.8); // Move the group to the center
    stars.translateZ(spreadZ / 2); // Move the group to the center
    starGroup.add(stars);

    // Position the group itself if needed, but movement is handled in updateTimelinePosition
    // starGroup.position.z = -5; // Example: Move the whole field back

    return starGroup;
  }

  // --- Playback Control Logic ---
  public createPlaybackControls(): PlaybackControls {
    return {
      play: (deckId: string, startTimeParam = 0, playbackRateParam = 1) => {
        // Check if deck state exists
        if (!this.state[deckId]) {
          console.error(`Deck ${deckId} not found in state`);
          return;
        }

        // If already playing or no audio context, do nothing
        if (this.state[deckId].isPlaying || !this.state[deckId].audioContext)
          return;

        this.state[deckId].startTime = startTimeParam; // Record the time playback *actually* starts
        this.state[deckId].playbackRate = playbackRateParam; // Use provided or current rate
        this.state[deckId].isPlaying = true;
        this.state[deckId].needsRender = true; // Need to render the moving timeline
        this.needsRender = true; // Global render flag
        // No need to update position here, animate loop handles it
      },
      pause: (deckId: string, pausedAtParam: number) => {
        // Check if deck state exists
        if (!this.state[deckId]) {
          console.error(`Deck ${deckId} not found in state`);
          return;
        }

        // If not playing, do nothing
        if (!this.state[deckId].isPlaying) return;

        this.state[deckId].isPlaying = false;
        // pausedAtParam should be the exact time the audio source was stopped
        this.state[deckId].pausedAt = pausedAtParam;
        // Update visual position one last time to sync with paused state
        this.updateTimelinePosition(deckId);
        this.state[deckId].needsRender = true; // Render the final paused state
        this.needsRender = true; // Global render flag
      },
      // This seems intended to force an update, perhaps after manual seeking?
      setPosition: (deckId: string) => {
        if (!this.state[deckId]) {
          console.error(`Deck ${deckId} not found in state`);
          return;
        }
        this.updateTimelinePosition(deckId);
        this.state[deckId].needsRender = true; // Force render on manual position update
        this.needsRender = true; // Global render flag
      },
      // Apply a temporary offset, e.g., for beat nudging
      setOffset: (deckId: string, offsetParam: number) => {
        if (!this.state[deckId]) {
          console.error(`Deck ${deckId} not found in state`);
          return;
        }
        this.state[deckId].offset = offsetParam;
        // Update position immediately to reflect offset visually
        this.updateTimelinePosition(deckId);
        this.state[deckId].needsRender = true; // Render the change due to offset
        this.needsRender = true; // Global render flag
        // Offset is reset in updateTimelinePosition after being applied
      },
      // Set the playback position directly
      setSeekPosition: (deckId: string, seekTime: number) => {
        if (!this.state[deckId]) {
          console.error(`Deck ${deckId} not found in state`);
          return;
        }
        const clampedSeekTime = Math.max(
          0,
          Math.min(seekTime, this.state[deckId].trackDuration),
        );
        this.state[deckId].pausedAt = clampedSeekTime;
        // If currently playing, we need to adjust startTime so the *next*
        // calculation in updateTimelinePosition reflects the seek.
        if (this.state[deckId].isPlaying) {
          this.state[deckId].startTime =
            this.state[deckId].audioContext.currentTime;
          // The elapsed time calculation will now be relative to the new startTime
          // and the new pausedAt value.
        }
        // Update visual position immediately
        this.updateTimelinePosition(deckId);
        this.state[deckId].needsRender = true; // Render the change due to seek
        this.needsRender = true; // Global render flag
      },
      // Add the implementation for updating the playback rate
      updatePlaybackRate: (deckId: string, newRate: number) => {
        if (!this.state[deckId]) {
          console.error(`Deck ${deckId} not found in state`);
          return;
        }
        this.state[deckId].playbackRate = Math.max(0.1, newRate); // Update internal rate, ensure minimum
        this.state[deckId].needsRender = true; // Rate change affects scale animation, need render
        this.needsRender = true; // Global render flag
        // No immediate visual update needed here, animate loop handles it
      },
    };
  }

  // --- Camera Animation ---
  private async cameraMatrix(
    mode: CameraPositionMode,
    value: number,
  ): Promise<void> {
    if (!this.camera) return;

    const targetPositionArray = this.ISOMETRIC_POSITIONS[mode]?.[value];
    if (!targetPositionArray || targetPositionArray.length !== 3) {
      console.warn(`Invalid camera mode/value provided: ${mode}/${value}`);
      return;
    }

    const targetPosition = new THREE.Vector3(...targetPositionArray);
    const startPosition = this.camera.position.clone();
    const duration = 250; // Animation duration in milliseconds

    // Return a Promise that resolves when the animation is complete
    await new Promise<void>(resolve => {
      let startTime = 0; // Will be set in the animation loop

      const animate = (timestamp: number) => {
        if (startTime === 0) startTime = timestamp; // Initialize start time
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1); // Clamp progress between 0 and 1

        // Interpolate position
        this.camera!.position.lerpVectors(
          startPosition,
          targetPosition,
          progress,
        );
        this.camera!.lookAt(0, 0, 0); // Keep looking at the center
        this.needsRender = true; // Need to render during camera animation

        if (progress < 1) {
          // Continue animation if not finished
          requestAnimationFrame(animate);
        } else {
          // Resolve the Promise when the animation is complete
          resolve();
          this.needsRender = true; // Ensure final frame is rendered
        }
      };

      requestAnimationFrame(animate); // Start the animation loop
    });
  }

  // --- Event Listeners ---
  private addEventListeners(): void {
    // Debounce the resize handler (e.g., wait 250ms after resize stops)
    this.boundOnWindowResize = this.debounce(
      this.onWindowResize.bind(this),
      250,
    );
    window.addEventListener('resize', this.boundOnWindowResize);

    // Add click listener if interaction is needed
    // this.boundOnMouseClick = this.onMouseClick.bind(this);
    // this.renderer?.domElement.addEventListener('click', this.boundOnMouseClick);
  }

  private removeEventListeners(): void {
    if (this.boundOnWindowResize) {
      window.removeEventListener('resize', this.boundOnWindowResize);
    }
    // Clear any pending debounce timeout on removal
    if (this.resizeDebounceTimeout !== null) {
      clearTimeout(this.resizeDebounceTimeout);
      this.resizeDebounceTimeout = null;
    }
    // if (this.boundOnMouseClick && this.renderer) {
    //     this.renderer.domElement.removeEventListener('click', this.boundOnMouseClick);
    // }
  }

  // Store bound functions and debounce timer
  private boundOnWindowResize: (() => void) | null = null;
  private resizeDebounceTimeout: ReturnType<typeof setTimeout> | null = null; // Added for debounce cleanup
  // private boundOnMouseClick: ((event: MouseEvent) => void) | null = null;

  // Debounce utility function
  private debounce<F extends (...args: any[]) => any>(
    func: F,
    waitFor: number,
  ): (...args: Parameters<F>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<F>): void => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func(...args), waitFor);
      // Store the timeout ID for potential cleanup in removeEventListeners
      // Check if the function being debounced is indeed onWindowResize before assigning
      // A simple check like this might be sufficient if debounce is only used here:
      this.resizeDebounceTimeout = timeout;
    };
  }

  private onWindowResize(): void {
    // Debounce or throttle this if it causes performance issues
    if (!this.camera || !this.renderer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update Camera
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Update Renderer
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio); // Re-apply pixel ratio

    console.warn(
      'Window resized: Waveform visualization might need regeneration for accurate scaling.',
    );

    // Re-render the scene after resize adjustments
    if (this.scene && this.camera) {
      // No direct render here, let the animate loop handle it
      // this.renderer.render(this.scene, this.camera);
      this.needsRender = true; // Flag that a render is needed due to resize
    }
  }

  // --- Core Animation Logic ---
  private updateTimelinePosition(deckId: string): void {
    // Check if deck state exists
    if (!this.state[deckId]) {
      console.error(`Deck ${deckId} not found in state`);
      return;
    }

    const deckState = this.state[deckId];
    if (
      !deckState.timelineGroup ||
      !deckState.audioContext ||
      deckState.trackDuration <= 0
    ) {
      return;
    }

    let currentPosition = deckState.pausedAt;
    if (deckState.isPlaying) {
      // Calculate time elapsed since playback started, adjusted by rate
      const elapsedTime =
        (deckState.audioContext.currentTime - deckState.startTime) *
        deckState.playbackRate;
      currentPosition += elapsedTime;
    }
    // Apply temporary offset and immediately reset it
    currentPosition += deckState.offset;
    deckState.offset = 0;

    // Clamp position to valid range [0, trackDuration]
    currentPosition = Math.max(
      0,
      Math.min(currentPosition, deckState.trackDuration),
    );

    // Calculate progress (0 to 1)
    const progress = currentPosition / deckState.trackDuration;

    // Map progress to the X position of the timeline group
    // Waveform spans from -width/2 to +width/2.
    // At progress 0, group should be at +width/2 (start of waveform at center marker)
    // At progress 1, group should be at -width/2 (end of waveform at center marker)
    const waveformWidth = window.innerWidth;

    // Calculate scale factor based on playback rate (inverse relationship)
    // scale = 1 + (1 - rate) = 2 - rate
    const effectivePlaybackRate = Math.max(deckState.playbackRate, 0.1); // Prevent extreme scaling
    // Calculate the TARGET scale based on playback rate
    deckState.targetTimelineScaleX = Math.max(0.1, 2 - effectivePlaybackRate); // Ensure scale doesn't go below 0.1

    // Calculate targetX based on the CURRENTLY applied scale for smooth positioning during animation
    const targetX =
      (waveformWidth / 2 - progress * waveformWidth) *
      deckState.currentTimelineScaleX;

    // Set the adjusted position (scaling is handled in the animate loop)
    deckState.timelineGroup.position.x = targetX;

    // Move the star field along with the timeline if this is the active deck
    // In a multi-deck setup, you might want to control which deck's position affects the star field
    if (this.starFieldGroup) {
      this.starFieldGroup.position.x = targetX;
    }

    // Mark this deck as needing render
    deckState.needsRender = true;
    this.needsRender = true; // Global render flag
  }

  private resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer): boolean {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  private startRenderLoop() {
    if (this.isRendering) return;

    this.isRendering = true;
    const animate = () => {
      if (!this.isRendering) return;

      this.frameId = requestAnimationFrame(animate);

      // Update all active deck positions
      for (const deckId in this.state) {
        const deckState = this.state[deckId];

        // Always update position if playing
        if (deckState.isPlaying) {
          this.updateTimelinePosition(deckId);
          this.needsRender = true;
        }

        // Handle scale animation
        if (
          deckState.currentTimelineScaleX !== deckState.targetTimelineScaleX
        ) {
          deckState.currentTimelineScaleX = THREE.MathUtils.lerp(
            deckState.currentTimelineScaleX,
            deckState.targetTimelineScaleX,
            this.scaleLerpFactor,
          );

          if (
            Math.abs(
              deckState.currentTimelineScaleX - deckState.targetTimelineScaleX,
            ) < 0.001
          ) {
            deckState.currentTimelineScaleX = deckState.targetTimelineScaleX;
          }

          if (deckState.timelineGroup) {
            deckState.timelineGroup.scale.x = deckState.currentTimelineScaleX;
          }
          this.needsRender = true;
        }

        if (deckState.needsRender) {
          this.needsRender = true;
          deckState.needsRender = false;
        }
      }

      // Render if needed
      if (this.needsRender && this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
      }
    };

    animate();
  }

  private stopRenderLoop() {
    this.isRendering = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  public forceRender() {
    if (this.renderer && this.scene && this.camera) {
      this.needsRender = true;
      if (!this.isRendering) {
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  public dispose(): void {
    this.stopRenderLoop();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.cleanupScene();
  }
}
