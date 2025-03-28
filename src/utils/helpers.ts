export const generateAudioContextFromURL = async (url: string) => {
  const audioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return { audioContext, audioBuffer };
};
