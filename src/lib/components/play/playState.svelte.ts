const getPlayState = () => {
  let playPoint = $state(0);
  let isPlaying = $state(false);

  return {
    getPlayPoint: () => playPoint,
    setPlayPoint: (point: number) => {
      playPoint = point;
    },
    getIsPlaying: () => isPlaying,
    setIsPlaying: (playing: boolean) => {
      isPlaying = playing;
    },
  };
};

export const playState = getPlayState();
