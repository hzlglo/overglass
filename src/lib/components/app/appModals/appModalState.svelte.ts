type AppModal = { type: 'newLane'; props: { initialName: string } };

const createAppModalState = () => {
  let modal = $state<AppModal | null>(null);
  return {
    getModal: () => modal,
    setModal: (modalInner: AppModal | null) => {
      modal = modalInner;
    },
  };
};

export const appModalState = createAppModalState();
