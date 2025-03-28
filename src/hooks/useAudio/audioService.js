// audioService.js - Con soporte para múltiples contextos nombrados
const audioContexts = {};

export const getAudioContext = (contextName = 'default') => {

    if (!audioContexts[contextName]) {
        audioContexts[contextName] = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContexts[contextName];
};

export const closeAudioContext = async (contextName = 'default') => {
    if (audioContexts[contextName]) {
        await audioContexts[contextName].close();
        delete audioContexts[contextName];
        return true;
    }
    return false;
};

export const getAllContextNames = () => {
    return Object.keys(audioContexts);
};