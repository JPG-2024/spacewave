// useAudio.js - Hook personalizado para interactuar con AudioContext
import { useState, useRef } from 'react';
import { getAudioContext } from './audioService';
import { generateVisualizerData } from '../../utils/generateVisualizerData';
import { guess } from 'web-audio-beat-detector';
import { generateWaveform } from '../../utils/waveformGenerator';
import { calculateBPM } from '../../utils/calculateBPM';

const INITIAL_TEMPO_SETTINGS = {
  minTempo: 120, // Electronic music often starts at higher BPMs
  maxTempo: 200, // Common range for electronic music genres
};

const PIXELS_PER_SECOND = 100;

export default function useAudio({
  contextName,
  waveformRef = 'default',
  initialVolume = 1,
  autoReset = false,
  onEnded = null,
}) {
  const audioContext = getAudioContext(contextName);

  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const bufferRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const animationRef = useRef(null);
  const bpmRef = useRef(null);
  const tempoRef = useRef(null);
  const playbackRateRef = useRef(1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(initialVolume);

  async function generateBeatPattern(audioBufferDuration, bpm, offset) {
    const beats = [];
    const beatInterval = (60 / bpm) * 100; // Pixels per beat
    let currentTime = offset * bpm;

    while (currentTime < audioBufferDuration * bpm) {
      beats.push(currentTime);
      currentTime += beatInterval;
    }

    return Promise.resolve(beats);
  }

  // Función para cargar audio
  const loadAudio = async url => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      bufferRef.current = await audioContext.decodeAudioData(arrayBuffer); // decodedBuffer
      setDuration(bufferRef.current.duration);

      bpmRef.current = await guess(bufferRef.current, INITIAL_TEMPO_SETTINGS);

      const bpm = calculateBPM(bufferRef.current);
      tempoRef.current = bpmRef.current.tempo.toFixed(2);

      await generateTimelineGraph(bpmRef.current.tempo.toFixed(2));
    } catch (error) {
      console.error('Error loading audio:', error);
      return false;
    }
  };

  const generateTimelineGraph = async tempo => {
    const newTempo = Number(tempo);

    const originalTempo = bpmRef.current.tempo;
    const originalOffset = bpmRef.current.offset;
    const newOffset = (originalOffset * originalTempo) / newTempo;

    const pps = (PIXELS_PER_SECOND * 60) / newTempo; // Adjust pixels per second based on tempo

    const [waveformData, totalPixelsWidth] = await generateVisualizerData({
      audioBuffer: bufferRef.current,
      pixelsPerSecond: pps,
    });

    const bpmPointsData = await generateBeatPattern(
      bufferRef.current.duration,
      newTempo,
      newOffset,
    );

    await generateWaveform({
      waveformData,
      bpmPointsData,
      width: totalPixelsWidth,
      container: contextName,
    });
  };

  const changeTempo = newTempo => {
    if (!bufferRef.current || !bpmRef.current) return;

    const currentTempo = bpmRef.current.tempo;
    const safeTempo = Math.max(30, Math.min(300, newTempo)); // Clamp tempo between 30 and 300 BPM
    tempoRef.current = safeTempo;

    const playbackRate = safeTempo / currentTempo; // Calculate the new playback rate
    playbackRateRef.current = playbackRate;

    generateTimelineGraph(safeTempo);
  };

  // Función para actualizar el tiempo
  const startTimeUpdate = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const updateTime = () => {
      const newTime =
        (pausedAtRef.current +
          (audioContext.currentTime - startTimeRef.current)) *
        playbackRateRef.current;

      if (waveformRef.current) {
        const offset = (newTime * PIXELS_PER_SECOND) / tempoRef.current; // Adjust offset based on tempo
        waveformRef.current.style.transform = `translateX(-${offset}px)`;
      }

      if (bufferRef.current && newTime >= bufferRef.current.duration) {
        pause();
        if (autoReset !== false) {
          pausedAtRef.current = 0;
        }
        if (onEnded) {
          onEnded();
        }
        return;
      }

      animationRef.current = requestAnimationFrame(updateTime);
    };

    animationRef.current = requestAnimationFrame(updateTime);
  };

  // Iniciar reproducción
  const play = () => {
    if (!bufferRef.current || isPlaying) return false;

    try {
      // Crear nodos de audio
      sourceRef.current = audioContext.createBufferSource();
      sourceRef.current.buffer = bufferRef.current;

      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.gain.value = volume;

      // Conectar nodos
      sourceRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContext.destination);

      // Reanudar contexto si está suspendido
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Iniciar reproducción
      const offset = pausedAtRef.current;
      sourceRef.current.start(0, offset);
      sourceRef.current.playbackRate.setValueAtTime(
        playbackRateRef.current,
        audioContext.currentTime,
      ); // Update playback rate dynamically
      startTimeRef.current = audioContext.currentTime - offset;
      startTimeUpdate();
      setIsPlaying(true);
      return true;
    } catch (error) {
      console.error('Error playing audio:', error);
      return false;
    }
  };

  // Pausar reproducción
  const pause = () => {
    if (!isPlaying) return false;

    try {
      pausedAtRef.current = audioContext.currentTime - startTimeRef.current;

      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }

      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      return true;
    } catch (error) {
      console.error('Error pausing audio:', error);
      return false;
    }
  };

  // Buscar posición
  const seek = position => {
    if (!bufferRef.current) return false;

    try {
      const wasPlaying = isPlaying;
      const seekTime =
        typeof position === 'number'
          ? position
          : position * bufferRef.current.duration;

      if (wasPlaying) {
        pause();
      }

      pausedAtRef.current = seekTime;

      if (wasPlaying) {
        play();
      }

      return true;
    } catch (error) {
      console.error('Error seeking audio:', error);
      return false;
    }
  };

  // Cambiar volumen
  const changeVolume = newVolume => {
    const safeVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(safeVolume);

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = safeVolume;
    }

    return safeVolume;
  };

  const getTempo = () => {
    return tempoRef.current;
  };

  return {
    contextName,
    audioContext,
    isPlaying,
    duration,
    volume,
    loadAudio,
    play,
    pause,
    seek,
    changeVolume,
    getTempo,
    changeTempo,
    generateTimelineGraph,
  };
}
