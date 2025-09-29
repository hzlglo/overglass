const getPlayState = () => {
  let playPoint = $state(0);

  return {
    getPlayPoint: () => playPoint,
    setPlayPoint: (point: number) => {
      playPoint = point;
    },
  };
};

export const playState = getPlayState();
