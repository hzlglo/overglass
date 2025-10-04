const getPlayState = () => {
  let playPoint = $state(0);
  let isPlaying = $state(false);
  let hasClickedPlay = $state(false);

  return {
    getPlayPoint: () => playPoint,
    setPlayPoint: (point: number) => {
      playPoint = point;
    },
    getIsPlaying: () => isPlaying,
    setIsPlaying: (playing: boolean) => {
      isPlaying = playing;
    },
    getHasClickedPlay: () => hasClickedPlay,
    setHasClickedPlay: (clicked: boolean) => {
      hasClickedPlay = clicked;
    },
  };
};

export const playState = getPlayState();
