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
const CENTER_MARKER_EMISSIVE_COLOR = new THREE.Color(0xfafafa);

// --- Interfaces for better type safety ---
interface GenerateTimelineParams {
  audioContext: AudioContext;
  containerId: string;
  audioBuffer: AudioBuffer;
}

export interface PlaybackControls {
  play: (startTime?: number, playbackRate?: number) => void;
  pause: (pausedAt: number) => void;
  setPosition: () => void; // Consider renaming for clarity if it just updates position
  setOffset: (offset: number) => void;
  setSeekPosition: (seekTime: number) => void;
  updatePlaybackRate: (newRate: number) => void; // Add method to update rate during playback
}

type CameraPositionMode = 'isometric' | 'side' | 'closeSide' | 'closeSideRight';

// Use type intersection to combine PerspectiveCamera with our custom method
export type CameraControls = THREE.PerspectiveCamera & {
  cameraMatrix: (mode: CameraPositionMode, value: number) => void;
  ISOMETRIC_POSITIONS: typeof ISOMETRIC_POSITIONS;
};

interface TimelineGeneratorResult {
  camera: CameraControls;
  timeLine: THREE.Object3D; // The main group containing waveform, beats, etc.
  playbackControls: PlaybackControls;
  tempo: number;
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
  private timelineGroup: THREE.Object3D | null = null; // Group for waveform and beats
  private starFieldGroup: THREE.Group | null = null; // Group for the star field
  private centerMarker: THREE.Mesh | null = null; // Separate marker
  private container: HTMLElement | null = null;

  // Audio related properties
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer;
  private trackDuration: number;
  private waveformData!: WaveformDataResponseType; // Definite assignment in initialize

  // Playback state properties
  private pausedAt: number = 0;
  private startTime: number = 0; // audioContext.currentTime when playback starts
  private playbackRate: number = 1;
  private offset: number = 0; // Temporary offset for adjustments like beat matching
  private isPlaying: boolean = false;

  // Scale animation properties
  private currentTimelineScaleX: number = 1;
  private targetTimelineScaleX: number = 1;
  private readonly scaleLerpFactor: number = 0.1; // Adjust for animation speed (0-1)

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
  constructor({
    audioContext,
    containerId,
    audioBuffer,
  }: GenerateTimelineParams) {
    this.audioContext = audioContext;
    this.audioBuffer = audioBuffer;
    this.trackDuration = audioBuffer.duration;
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
    // Fetch waveform data first
    this.waveformData = await generateWaveformData({
      audioBuffer: this.audioBuffer,
    });

    // Setup Three.js environment
    this.setupScene();
    this.setupRenderer();
    this.setupCamera(); // Camera needs to be setup before creating controls

    // Create visual elements
    this.timelineGroup = new THREE.Object3D();
    this.timelineGroup.name = 'TimelineGroup'; // For debugging
    this.createWaveformVisualization(); // Adds waveform and beats to timelineGroup
    this.createCenterMarker(); // Adds marker directly to the scene
    this.starFieldGroup = this.createStarField(); // Create the star field

    // Position the timeline group relative to the center marker
    const initialX = window.innerWidth / 2;
    this.timelineGroup.position.x = initialX; // Initial position for 0 progress
    this.starFieldGroup.position.x = initialX; // Star field starts at the same position

    this.scene!.add(this.timelineGroup); // Add the group to the scene
    this.scene!.add(this.starFieldGroup); // Add the star field to the scene

    // Add event listeners and start animation loop
    this.addEventListeners();
    this.animate(); // Start the rendering loop

    // Return the necessary controls and objects
    return {
      camera: this.camera!, // Assert non-null as it's initialized
      timeLine: this.timelineGroup!, // Assert non-null
      playbackControls: this.createPlaybackControls(),
      tempo: this.waveformData.tempoData.tempo,
    };
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

    // Remove timeline group and dispose its contents
    if (this.timelineGroup) {
      this.scene.remove(this.timelineGroup);
      // Dispose children of the group
      // Add type annotation for 'object'
      this.timelineGroup.traverse((object: THREE.Object3D) => {
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
      this.timelineGroup = null; // Allow garbage collection
    }

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

  // --- Private Visualization Methods ---
  private createWaveformVisualization(): void {
    // Guard clauses
    if (!this.timelineGroup || !this.waveformData) {
      console.error(
        'Timeline group or waveform data not available for visualization.',
      );
      return;
    }

    const {
      waveformData: samples, // Renamed for clarity
      tempoData: { firstBeatOffset, beatInterval, harmonySections },
    } = this.waveformData;
    const duration = this.trackDuration;
    const scaleY = 1.5; // Vertical scale factor for waveform
    const waveformWidth = window.innerWidth; // Width of the visualization area

    // --- Create Waveform Geometry ---
    const points: THREE.Vector3[] = [];
    // Ensure at least two points for a line
    if (samples.length < 2) {
      console.warn('Not enough waveform samples to draw a line.');
      return; // Or create a default line/shape
    }
    for (let i = 0; i < samples.length; i++) {
      // Map index to x-coordinate relative to the center
      const x = (i / (samples.length - 1)) * waveformWidth - waveformWidth / 2;
      const y = samples[i] * scaleY;
      points.push(new THREE.Vector3(x, y, 0)); // Z = 0 for waveform plane
    }

    const waveformSegmentsGroup = new THREE.Group();
    waveformSegmentsGroup.name = 'WaveformSegments';
    const timePerPoint = duration / (samples.length - 1); // Time represented by each segment
    let currentIndex = 0; // Tracks the start index for the next segment

    // Sort harmony sections just in case they are not ordered
    // Add type annotation for 'a' and 'b'
    harmonySections.sort(
      (a: HarmonySection, b: HarmonySection) => a.start - b.start,
    );

    // Add type annotation for 'section'
    harmonySections.forEach((section: HarmonySection) => {
      // Calculate start and end indices, clamping to valid range
      const startIndex = Math.max(
        0,
        Math.min(samples.length - 1, Math.floor(section.start / timePerPoint)),
      );
      const endIndex = Math.max(
        startIndex,
        Math.min(samples.length - 1, Math.floor(section.end / timePerPoint)),
      );

      // Create segment for non-harmonic part before this section
      if (currentIndex < startIndex) {
        const segmentPoints = points.slice(currentIndex, startIndex + 1); // Include end point
        if (segmentPoints.length > 1) {
          const geometry = new THREE.BufferGeometry().setFromPoints(
            segmentPoints,
          );
          const material = new THREE.LineBasicMaterial({
            color: BEAT_WAVE_COLOR,
          });
          waveformSegmentsGroup.add(new THREE.Line(geometry, material));
        }
      }

      // Create segment for the harmonic section
      if (startIndex < endIndex) {
        const segmentPoints = points.slice(startIndex, endIndex + 1); // Include end point
        if (segmentPoints.length > 1) {
          const geometry = new THREE.BufferGeometry().setFromPoints(
            segmentPoints,
          );
          const material = new THREE.LineBasicMaterial({
            color: HARMONIC_COLOR,
          });
          waveformSegmentsGroup.add(new THREE.Line(geometry, material));
        }
      }
      // Update the index for the next non-harmonic section
      currentIndex = Math.max(currentIndex, endIndex);
    });

    // Create segment for any remaining non-harmonic part after the last harmony section
    if (currentIndex < samples.length - 1) {
      const segmentPoints = points.slice(currentIndex);
      if (segmentPoints.length > 1) {
        const geometry = new THREE.BufferGeometry().setFromPoints(
          segmentPoints,
        );
        const material = new THREE.MeshStandardMaterial({
          color: BEAT_WAVE_COLOR,
        });
        waveformSegmentsGroup.add(new THREE.Line(geometry, material));
      }
    }
    this.timelineGroup.add(waveformSegmentsGroup);

    // --- Create Beat Markers ---
    if (beatInterval && beatInterval > 0) {
      const beatLinesGroup = new THREE.Group();
      beatLinesGroup.name = 'BeatMarkers';
      const beatMarkMaterial = new THREE.LineDashedMaterial({
        color: BEAT_MARK_COLOR,
        opacity: 0.5,
        transparent: true,
        depthTest: true, // Render markers on top of waveform
      });
      // Use a thin box for beat markers for visibility
      const beatMarkGeometry = new THREE.BoxGeometry(0.01, scaleY * 1.1, 0.5); // Slightly taller than waveform

      for (
        let beatTime = firstBeatOffset;
        beatTime < duration;
        beatTime += beatInterval
      ) {
        // Map beat time to x-coordinate
        const alignmentOffset = 0.1;
        const beatX =
          ((beatTime + alignmentOffset) / duration) * waveformWidth -
          waveformWidth / 2;
        const beatMark = new THREE.Mesh(beatMarkGeometry, beatMarkMaterial);
        // Position slightly behind the waveform (negative Z)
        beatMark.position.set(beatX, 0, -0.05);
        beatLinesGroup.add(beatMark);
      }
      // Dispose geometry after creating meshes if not reused
      //beatMarkGeometry.dispose();
      this.timelineGroup.add(beatLinesGroup);
    } else {
      console.log('No beat interval data, skipping beat markers.');
    }
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

    const markerMaterial = new THREE.MeshStandardMaterial({
      color: CENTER_MARKER_COLOR, // Fixed color format to hexadecimal
      depthWrite: true,
      depthTest: true,
      emissive: CENTER_MARKER_EMISSIVE_COLOR,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide, // Important for visibility from both sides
      visible: true,
    });

    this.centerMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.centerMarker.name = 'CenterMarker';
    //this.centerMarker.position.set(0, 0, 0.1);
    this.scene.add(this.centerMarker);
  }

  private createStarField(): THREE.Group {
    const starGroup = new THREE.Group();
    starGroup.name = 'StarField';

    const starCount = 20000;
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
  private createPlaybackControls(): PlaybackControls {
    return {
      play: (
        startTimeParam = this.audioContext.currentTime,
        playbackRateParam = this.playbackRate,
      ) => {
        // If already playing or no audio context, do nothing
        if (this.isPlaying || !this.audioContext) return;

        this.startTime = startTimeParam; // Record the time playback *actually* starts
        this.playbackRate = playbackRateParam; // Use provided or current rate
        this.isPlaying = true;
        // No need to update position here, animate loop handles it
      },
      pause: pausedAtParam => {
        // If not playing, do nothing
        if (!this.isPlaying) return;

        this.isPlaying = false;
        // pausedAtParam should be the exact time the audio source was stopped
        this.pausedAt = pausedAtParam;
        // Update visual position one last time to sync with paused state
        this.updateTimelinePosition();
      },
      // This seems intended to force an update, perhaps after manual seeking?
      setPosition: () => {
        this.updateTimelinePosition();
      },
      // Apply a temporary offset, e.g., for beat nudging
      setOffset: offsetParam => {
        this.offset = offsetParam;
        // Update position immediately to reflect offset visually
        this.updateTimelinePosition();
        // Offset is reset in updateTimelinePosition after being applied
      },
      // Set the playback position directly
      setSeekPosition: seekTime => {
        const clampedSeekTime = Math.max(
          0,
          Math.min(seekTime, this.trackDuration),
        );
        this.pausedAt = clampedSeekTime;
        // If currently playing, we need to adjust startTime so the *next*
        // calculation in updateTimelinePosition reflects the seek.
        if (this.isPlaying) {
          this.startTime = this.audioContext.currentTime;
          // The elapsed time calculation will now be relative to the new startTime
          // and the new pausedAt value.
        }
        // Update visual position immediately
        this.updateTimelinePosition();
      },
      // Add the implementation for updating the playback rate
      updatePlaybackRate: newRate => {
        this.playbackRate = Math.max(0.1, newRate); // Update internal rate, ensure minimum
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

        if (progress < 1) {
          // Continue animation if not finished
          requestAnimationFrame(animate);
        } else {
          // Resolve the Promise when the animation is complete
          resolve();
        }
      };

      requestAnimationFrame(animate); // Start the animation loop
    });
  }

  // --- Event Listeners ---
  private addEventListeners(): void {
    // Use a property to store the bound function for easy removal
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.boundOnWindowResize);

    // Add click listener if interaction is needed
    // this.boundOnMouseClick = this.onMouseClick.bind(this);
    // this.renderer?.domElement.addEventListener('click', this.boundOnMouseClick);
  }

  private removeEventListeners(): void {
    if (this.boundOnWindowResize) {
      window.removeEventListener('resize', this.boundOnWindowResize);
    }
    // if (this.boundOnMouseClick && this.renderer) {
    //     this.renderer.domElement.removeEventListener('click', this.boundOnMouseClick);
    // }
  }

  // Store bound functions to remove listeners correctly
  private boundOnWindowResize: (() => void) | null = null;
  // private boundOnMouseClick: ((event: MouseEvent) => void) | null = null;

  private onWindowResize(): void {
    // Debounce or throttle this if it causes performance issues
    if (!this.camera || !this.renderer || !this.timelineGroup) return;

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
      this.renderer.render(this.scene, this.camera);
    }
  }

  // --- Core Animation Logic ---
  private updateTimelinePosition(): void {
    if (!this.timelineGroup || !this.audioContext || this.trackDuration <= 0)
      return;

    let currentPosition = this.pausedAt;
    if (this.isPlaying) {
      // Calculate time elapsed since playback started, adjusted by rate
      const elapsedTime =
        (this.audioContext.currentTime - this.startTime) * this.playbackRate;
      currentPosition += elapsedTime;
    }
    // Apply temporary offset and immediately reset it
    currentPosition += this.offset;
    this.offset = 0;

    // Clamp position to valid range [0, trackDuration]
    currentPosition = Math.max(
      0,
      Math.min(currentPosition, this.trackDuration),
    );

    // Calculate progress (0 to 1)
    const progress = currentPosition / this.trackDuration;

    // Map progress to the X position of the timeline group
    // Waveform spans from -width/2 to +width/2.
    // At progress 0, group should be at +width/2 (start of waveform at center marker)
    // At progress 1, group should be at -width/2 (end of waveform at center marker)
    const waveformWidth = window.innerWidth;

    // Calculate scale factor based on playback rate (inverse relationship)
    // scale = 1 + (1 - rate) = 2 - rate
    const effectivePlaybackRate = Math.max(this.playbackRate, 0.1); // Prevent extreme scaling
    // Calculate the TARGET scale based on playback rate
    this.targetTimelineScaleX = Math.max(0.1, 2 - effectivePlaybackRate); // Ensure scale doesn't go below 0.1

    // Calculate targetX based on the CURRENTLY applied scale for smooth positioning during animation
    const targetX =
      (waveformWidth / 2 - progress * waveformWidth) *
      this.currentTimelineScaleX;

    // Set the adjusted position (scaling is handled in the animate loop)
    this.timelineGroup.position.x = targetX;

    // Move the star field along with the timeline
    if (this.starFieldGroup) {
      this.starFieldGroup.position.x = targetX;
    }
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

  private animate(): void {
    // Schedule the next frame
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    // Resize renderer if needed
    if (this.renderer && this.resizeRendererToDisplaySize(this.renderer)) {
      const canvas = this.renderer.domElement;
      this.camera!.aspect = canvas.clientWidth / canvas.clientHeight;
      this.camera!.updateProjectionMatrix();
    }

    // Update timeline target scale and position
    this.updateTimelinePosition();

    // --- Animate Scale ---
    if (this.timelineGroup) {
      // Lerp the current scale towards the target scale
      this.currentTimelineScaleX +=
        (this.targetTimelineScaleX - this.currentTimelineScaleX) *
        this.scaleLerpFactor;

      // Apply the interpolated scale
      this.timelineGroup.scale.set(this.currentTimelineScaleX, 1, 1);

      // Optional: Re-adjust position slightly based on the *very latest* scale applied this frame?
      // This might prevent tiny visual jitter if scale changes significantly in one frame.
      // Let's test without it first. If needed, uncomment and potentially recalculate progress:
      // const waveformWidth = window.innerWidth;
      // const currentPosition = ... // Need currentPosition here if recalculating progress
      // const progress = currentPosition / this.trackDuration;
      // const adjustedX = (waveformWidth / 2 - progress * waveformWidth) * this.currentTimelineScaleX;
      // this.timelineGroup.position.x = adjustedX;
      // if (this.starFieldGroup) { this.starFieldGroup.position.x = adjustedX; }
    }
    // --- End Animate Scale ---

    // Render the scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // --- Public Cleanup Method ---
  public dispose(): void {
    console.log('Disposing TimelineGenerator...');
    // Stop animation loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Remove event listeners
    this.removeEventListeners();
    // Clean up Three.js scene objects
    this.cleanupScene();
    // Dispose renderer and remove its canvas
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove(); // Remove canvas from DOM
      this.renderer = null;
    }
    // Nullify references to help garbage collection
    this.scene = null;
    this.camera = null;
    // timelineGroup, centerMarker, and starFieldGroup are handled in cleanupScene
    this.container = null;
    // waveformData might be large, nullify if not needed elsewhere
    // this.waveformData = null;
    console.log('TimelineGenerator disposed.');
  }
}
