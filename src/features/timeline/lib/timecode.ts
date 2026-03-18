export const formatTimecode = (frame: number, frameRate: number): string => {
  const totalSeconds = Math.floor(frame / frameRate);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
