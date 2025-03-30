export const generateAudioContextFromURL = async (fileName: string) => {
  const audioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)();

  const response = await fetch(`${import.meta.env.VITE_API_URL}/${fileName}`);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return { audioContext, audioBuffer };
};
