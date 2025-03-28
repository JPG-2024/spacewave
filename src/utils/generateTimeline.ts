import * as THREE from "three";
// Assuming WaveformDataResponse is exported from waveformTracker - Using any for now
import {
  generateWaveformData,
  // WaveformDataResponse, // TODO: Export this type from waveformTracker.ts
} from "@/utils/waveformTracker";

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
}

type CameraPositionMode = "isometric" | "side" | "closeSide" | "closeSideRight";

// Use type intersection to combine PerspectiveCamera with our custom method
export type CameraControls = THREE.PerspectiveCamera & {
  cameraMatrix: (mode: CameraPositionMode, value: number) => void;
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

  // Configuration for camera positions
  private readonly ISOMETRIC_POSITIONS = {
    isometric: [
      [5, 5, 5],
      [-5, 5, 5],
      [-5, 5, -5],
      [5, 5, -5],
    ],
    side: [
      [0, 0, 4],
      [0, 0, 20],
      [0, 0, 60],
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
      [-20, 0, 4],
      [-6, 0, 3],
      [-20, 0, 4],
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
        `TimelineGenerator: Container element with id "${containerId}" not found.`
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
    this.timelineGroup.name = "TimelineGroup"; // For debugging
    this.createWaveformVisualization(); // Adds waveform and beats to timelineGroup
    this.createCenterMarker(); // Adds marker directly to the scene

    // Position the timeline group relative to the center marker
    this.timelineGroup.position.x = window.innerWidth / 2; // Initial position for 0 progress

    this.scene!.add(this.timelineGroup); // Add the group to the scene

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
      this.scene.name = "MainScene";
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
        1000
      ) as CameraControls; // Increased far plane
      this.camera.position.set(0, 0, 4); // Default starting position
      this.camera.lookAt(0, 0, 0);
      // Add the custom cameraMatrix method to this instance
      this.camera.cameraMatrix = this.cameraMatrix.bind(this);
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
        "Timeline group or waveform data not available for visualization."
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
      console.warn("Not enough waveform samples to draw a line.");
      return; // Or create a default line/shape
    }
    for (let i = 0; i < samples.length; i++) {
      // Map index to x-coordinate relative to the center
      const x = (i / (samples.length - 1)) * waveformWidth - waveformWidth / 2;
      const y = samples[i] * scaleY;
      points.push(new THREE.Vector3(x, y, 0)); // Z = 0 for waveform plane
    }

    const waveformSegmentsGroup = new THREE.Group();
    waveformSegmentsGroup.name = "WaveformSegments";
    const timePerPoint = duration / (samples.length - 1); // Time represented by each segment
    let currentIndex = 0; // Tracks the start index for the next segment

    // Sort harmony sections just in case they are not ordered
    // Add type annotation for 'a' and 'b'
    harmonySections.sort(
      (a: HarmonySection, b: HarmonySection) => a.start - b.start
    );

    // Add type annotation for 'section'
    harmonySections.forEach((section: HarmonySection) => {
      // Calculate start and end indices, clamping to valid range
      const startIndex = Math.max(
        0,
        Math.min(samples.length - 1, Math.floor(section.start / timePerPoint))
      );
      const endIndex = Math.max(
        startIndex,
        Math.min(samples.length - 1, Math.floor(section.end / timePerPoint))
      );

      // Create segment for non-harmonic part before this section
      if (currentIndex < startIndex) {
        const segmentPoints = points.slice(currentIndex, startIndex + 1); // Include end point
        if (segmentPoints.length > 1) {
          const geometry = new THREE.BufferGeometry().setFromPoints(
            segmentPoints
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
            segmentPoints
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
          segmentPoints
        );
        const material = new THREE.LineBasicMaterial({
          color: BEAT_WAVE_COLOR,
        });
        waveformSegmentsGroup.add(new THREE.Line(geometry, material));
      }
    }
    this.timelineGroup.add(waveformSegmentsGroup);

    // --- Create Beat Markers ---
    if (beatInterval && beatInterval > 0) {
      const beatLinesGroup = new THREE.Group();
      beatLinesGroup.name = "BeatMarkers";
      const beatMarkMaterial = new THREE.MeshBasicMaterial({
        color: BEAT_MARK_COLOR,
        opacity: 0.6,
        transparent: true,
        depthTest: false, // Render markers on top of waveform
      });
      // Use a thin box for beat markers for visibility
      const beatMarkGeometry = new THREE.BoxGeometry(0.015, scaleY * 1.8, 0.01); // Slightly taller than waveform

      for (
        let beatTime = firstBeatOffset;
        beatTime < duration;
        beatTime += beatInterval
      ) {
        // Map beat time to x-coordinate
        const beatX = (beatTime / duration) * waveformWidth - waveformWidth / 2;
        const beatMark = new THREE.Mesh(beatMarkGeometry, beatMarkMaterial);
        // Position slightly behind the waveform (negative Z)
        beatMark.position.set(beatX, 0, -0.05);
        beatLinesGroup.add(beatMark);
      }
      // Dispose geometry after creating meshes if not reused
      // beatMarkGeometry.dispose();
      this.timelineGroup.add(beatLinesGroup);
    } else {
      console.log("No beat interval data, skipping beat markers.");
    }
  }

  private createCenterMarker(): void {
    if (!this.scene) return;
    // Simple vertical line marker
    const markerHeight = 2.5; // Make it taller than waveform
    const markerGeometry = new THREE.BoxGeometry(0.02, markerHeight, 0.02); // Thin but visible
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: CENTER_MARKER_COLOR,
      emissive: CENTER_MARKER_EMISSIVE_COLOR,
      emissiveIntensity: 0.8, // Subtle glow
      depthTest: false, // Ensure it's always visible
      transparent: true,
      opacity: 0.9,
    });

    this.centerMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.centerMarker.name = "CenterMarker";
    // Position at the center of the viewport, slightly in front of the timeline group
    this.centerMarker.position.set(0, 0, 0.1);
    this.scene.add(this.centerMarker);
  }

  // --- Playback Control Logic ---
  private createPlaybackControls(): PlaybackControls {
    return {
      play: (
        startTimeParam = this.audioContext.currentTime,
        playbackRateParam = this.playbackRate
      ) => {
        // If already playing or no audio context, do nothing
        if (this.isPlaying || !this.audioContext) return;

        this.startTime = startTimeParam; // Record the time playback *actually* starts
        this.playbackRate = playbackRateParam; // Use provided or current rate
        this.isPlaying = true;
        // No need to update position here, animate loop handles it
      },
      pause: (pausedAtParam) => {
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
      setOffset: (offsetParam) => {
        this.offset = offsetParam;
        // Update position immediately to reflect offset visually
        this.updateTimelinePosition();
        // Offset is reset in updateTimelinePosition after being applied
      },
      // Set the playback position directly
      setSeekPosition: (seekTime) => {
        const clampedSeekTime = Math.max(
          0,
          Math.min(seekTime, this.trackDuration)
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
    };
  }

  // --- Camera Animation ---
  private cameraMatrix(mode: CameraPositionMode, value: number): void {
    if (!this.camera) return;

    const targetPositionArray = this.ISOMETRIC_POSITIONS[mode]?.[value];
    if (!targetPositionArray || targetPositionArray.length !== 3) {
      console.warn(`Invalid camera mode/value provided: ${mode}/${value}`);
      return;
    }

    const targetPosition = new THREE.Vector3(...targetPositionArray);
    const startPosition = this.camera.position.clone();
    const duration = 250; // Animation duration in milliseconds
    let startTime = 0; // Will be set in the animation loop

    const animate = (timestamp: number) => {
      if (startTime === 0) startTime = timestamp; // Initialize start time
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1); // Clamp progress between 0 and 1

      // Use slerp for smoother rotation/position interpolation if needed,
      // but lerp is often sufficient for position.
      this.camera!.position.lerpVectors(
        startPosition,
        targetPosition,
        progress
      );
      this.camera!.lookAt(0, 0, 0); // Keep looking at the center

      if (progress < 1) {
        // Continue animation if not finished
        requestAnimationFrame(animate);
      }
      // No need to explicitly stop, it finishes when progress reaches 1
    };

    requestAnimationFrame(animate); // Start the animation loop
  }

  // --- Event Listeners ---
  private addEventListeners(): void {
    // Use a property to store the bound function for easy removal
    this.boundOnWindowResize = this.onWindowResize.bind(this);
    window.addEventListener("resize", this.boundOnWindowResize);

    // Add click listener if interaction is needed
    // this.boundOnMouseClick = this.onMouseClick.bind(this);
    // this.renderer?.domElement.addEventListener('click', this.boundOnMouseClick);
  }

  private removeEventListeners(): void {
    if (this.boundOnWindowResize) {
      window.removeEventListener("resize", this.boundOnWindowResize);
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

    // --- Recalculate and potentially regenerate waveform ---
    // This is the complex part. If the waveform width is tied to window.innerWidth,
    // the geometry needs to be updated or regenerated.
    // Option 1: Simple scaling (might distort aspect ratio)
    // const scaleX = width / oldWidth; // Need to store oldWidth
    // this.timelineGroup.scale.x = scaleX;

    // Option 2: Regenerate (more accurate, potentially expensive)
    console.warn(
      "Window resized: Waveform visualization might need regeneration for accurate scaling."
    );
    // If choosing regeneration:
    // 1. Remove old waveform/beat markers from timelineGroup
    // 2. Dispose their geometries/materials
    // 3. Call createWaveformVisualization() again (it uses current window.innerWidth)

    // For now, just adjust the group's starting position if needed (less critical)
    // The updateTimelinePosition handles the dynamic movement based on progress.
    // this.timelineGroup.position.x = width / 2; // Reset initial offset?

    // Re-render the scene after resize adjustments
    if (this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // --- Mouse Click Interaction (Example) ---
  /*
    private onMouseClick(event: MouseEvent): void {
        if (!this.renderer || !this.camera || !this.timelineGroup) return;

        // Calculate normalized device coordinates (-1 to +1)
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Find intersections with the timeline group's children (recursive)
        const intersects = raycaster.intersectObjects(this.timelineGroup.children, true);

        if (intersects.length > 0) {
            // Get the intersection point in world coordinates
            const worldIntersectionPoint = intersects[0].point;
            // Convert world point to the local coordinate system of the timelineGroup
            const localIntersectionPoint = this.timelineGroup.worldToLocal(worldIntersectionPoint.clone());

            console.log("Timeline clicked at local X:", localIntersectionPoint.x);

            // Convert local X coordinate to time
            const waveformWidth = window.innerWidth; // The width used in createWaveformVisualization
            // Map the local X back to a progress value (0 to 1)
            const progress = (localIntersectionPoint.x + waveformWidth / 2) / waveformWidth;
            const seekTime = progress * this.trackDuration;

            console.log(`Estimated seek time: ${seekTime.toFixed(2)}s`);

            // Example: Trigger seek using playback controls
            // this.createPlaybackControls().setSeekPosition(seekTime); // Need access to controls instance
            // Or, if you have a dedicated seek method in the hook:
            // this.seekCallback(seekTime); // Requires passing a callback during init
        }
    }
    */

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
      Math.min(currentPosition, this.trackDuration)
    );

    // Calculate progress (0 to 1)
    const progress = currentPosition / this.trackDuration;

    // Map progress to the X position of the timeline group
    // Waveform spans from -width/2 to +width/2.
    // At progress 0, group should be at +width/2 (start of waveform at center marker)
    // At progress 1, group should be at -width/2 (end of waveform at center marker)
    const waveformWidth = window.innerWidth;
    const targetX = waveformWidth / 2 - progress * waveformWidth;

    this.timelineGroup.position.x = targetX;
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

    // Update timeline position based on playback state
    this.updateTimelinePosition();

    // Render the scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // --- Public Cleanup Method ---
  public dispose(): void {
    console.log("Disposing TimelineGenerator...");
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
    // timelineGroup and centerMarker are handled in cleanupScene
    this.container = null;
    // waveformData might be large, nullify if not needed elsewhere
    // this.waveformData = null;
    console.log("TimelineGenerator disposed.");
  }
}
