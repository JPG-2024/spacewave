// useAudio.js - Hook personalizado para interactuar con AudioContext
import { useState, useRef } from 'react';
import { getAudioContext } from './audioService';
import { guess } from "web-audio-beat-detector";
import { renderTimeline } from "../../utils/generateTimeline";


const INITIAL_TEMPO_SETTINGS = {
    minTempo: 120, // Electronic music often starts at higher BPMs
    maxTempo: 200, // Common range for electronic music genres
};


export default function useAudio({ contextName, initialVolume = 1 }) {
    const audioContext = getAudioContext(contextName);

    const sourceRef = useRef(null);
    const gainNodeRef = useRef(null);
    const bufferRef = useRef(null);
    const startTimeRef = useRef(0);
    const isPlayingRef = useRef(false)
    const pausedAtRef = useRef(0);
    const trackPositionPercentageRef = useRef(0);
    const timelineControlsRef = useRef(null);

    const bpmRef = useRef(null);
    const tempoRef = useRef(null)
    const playbackRateRef = useRef(1);



    const [duration, setDuration] = useState(0);

    const [volume, setVolume] = useState(initialVolume);
    const [loadingState, setLoadingState] = useState("empty");


    const resetState = () => {
        pausedAtRef.current = 0;
        startTimeRef.current = 0;
        playbackRateRef.current = 1;
        bpmRef.current = null;
        tempoRef.current = null;
    }


    // Función para cargar audio
    const loadAudio = async (url) => {
        try {
            setLoadingState("loading")
            if (isPlayingRef.current) {
                pause();
            }

            resetState()

            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            bufferRef.current = await audioContext.decodeAudioData(arrayBuffer); // decodedBuffer
            setDuration(bufferRef.current.duration);

            bpmRef.current = await guess(bufferRef.current, INITIAL_TEMPO_SETTINGS)

            tempoRef.current = bpmRef.current.tempo.toFixed(2)

            timelineControlsRef.current = await renderTimeline({
                audioBuffer: bufferRef.current,
                deckId: contextName,
                isPlayingRef,
                audioContext,
                startTimeRef,
                pausedAtRef,
                bpmData: bpmRef.current
            });

            //await generateTimelineMiniature()
            setLoadingState("loaded")
        } catch (error) {
            console.error("Error loading audio:", error);
            return false;
        }
    };


    const changeTempo = (newTempo) => {
        if (!bufferRef.current || !bpmRef.current) return;

        const currentTempo = bpmRef.current.tempo;
        const safeTempo = Math.max(30, Math.min(300, newTempo)); // Clamp tempo between 30 and 300 BPM
        tempoRef.current = safeTempo

        const playbackRate = safeTempo / currentTempo; // Calculate the new playback rate
        playbackRateRef.current = playbackRate;
    };

    // Iniciar reproducción
    const play = () => {
        if (!bufferRef.current || isPlayingRef.current) return false;

        try {
            isPlayingRef.current = true

            // Crear nodos de audio
            sourceRef.current = audioContext.createBufferSource();
            sourceRef.current.buffer = bufferRef.current;

            gainNodeRef.current = audioContext.createGain();
            gainNodeRef.current.gain.value = volume;

            // Conectar nodos
            sourceRef.current.connect(gainNodeRef.current);
            gainNodeRef.current.connect(audioContext.destination);

            sourceRef.current.playbackRate.value = playbackRateRef.current;
            // Reanudar contexto si está suspendido
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            // Iniciar reproducción
            const offset = pausedAtRef.current;
            sourceRef.current.start(0, offset);


            // CORRECCIÓN: Usar tiempo actual como referencia de inicio
            startTimeRef.current = audioContext.currentTime; // <-- Cambio clave aquí


            timelineControlsRef.current.play(trackPositionPercentageRef.current)


            return true;
        } catch (error) {
            console.error("Error playing audio:", error);
            return false;
        }
    };

    // Pausar reproducción
    const pause = () => {
        if (!isPlayingRef.current) return false;

        try {
            isPlayingRef.current = false;


            timelineControlsRef.current.pause()

            if (sourceRef.current) {
                sourceRef.current.stop();
                sourceRef.current.disconnect();
                sourceRef.current = null;
            }

            if (gainNodeRef.current) {
                gainNodeRef.current.disconnect();
                gainNodeRef.current = null;
            }

            // CORRECCIÓN: Calcular tiempo acumulado con playbackRate
            const elapsed = audioContext.currentTime - startTimeRef.current;
            pausedAtRef.current += elapsed * playbackRateRef.current; // <-- Actualización clave
            trackPositionPercentageRef.current = pausedAtRef.current / bufferRef.current.duration;

            return true;
        } catch (error) {
            console.error("Error pausing audio:", error);
            return false;
        }
    };


    // Buscar posición
    const seek = (percentage) => {
        if (!bufferRef.current) return false;

        try {
            const wasPlaying = isPlayingRef.current; // Usar isPlayingRef en lugar de isPlaying
            const seekTime = percentage * bufferRef.current.duration;

            if (wasPlaying) {
                pause();
            }

            pausedAtRef.current = seekTime;

            if (wasPlaying) {
                play(); // Reanudar la reproducción si estaba en curso
            }

            return true;
        } catch (error) {
            console.error("Error seeking audio:", error);
            return false;
        }
    };

    // Cambiar volumen
    const changeVolume = (newVolume) => {
        const safeVolume = Math.max(0, Math.min(1, newVolume));
        setVolume(safeVolume);

        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = safeVolume;
        }

        return safeVolume;
    };

    const getTempo = () => {
        return tempoRef.current
    }


    return {
        contextName,
        audioContext,
        duration,
        volume,
        loadAudio,
        loadingState,
        play,
        pause,
        seek,
        changeVolume,
        getTempo,
        changeTempo,
        isPlayingRef,
    };
}