export type MediaMetadata = {
  durationInSeconds?: number;
  width?: number;
  height?: number;
};

async function readVideoMetadata(src: string): Promise<MediaMetadata> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = src;
    video.onloadedmetadata = () => {
      resolve({
        durationInSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
        width: Number.isFinite(video.videoWidth) ? video.videoWidth : undefined,
        height: Number.isFinite(video.videoHeight) ? video.videoHeight : undefined,
      });
      video.removeAttribute("src");
      video.load();
    };
    video.onerror = () => {
      resolve({});
      video.removeAttribute("src");
      video.load();
    };
  });
}

async function readAudioMetadata(src: string): Promise<MediaMetadata> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = src;
    audio.onloadedmetadata = () => {
      resolve({
        durationInSeconds: Number.isFinite(audio.duration) ? audio.duration : undefined,
      });
      audio.removeAttribute("src");
      audio.load();
    };
    audio.onerror = () => {
      resolve({});
      audio.removeAttribute("src");
      audio.load();
    };
  });
}

export async function extractMediaMetadata(file: File, src: string): Promise<MediaMetadata> {
  if (file.type.startsWith("video/")) {
    return readVideoMetadata(src);
  }

  if (file.type.startsWith("audio/")) {
    return readAudioMetadata(src);
  }

  if (file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const image = new Image();
      image.src = src;
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({});
    });
  }

  return {};
}
