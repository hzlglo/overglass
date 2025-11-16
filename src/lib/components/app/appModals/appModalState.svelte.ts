import type { ParameterLaneState } from '$lib/components/grid/sharedGridState.svelte';

type AppModal =
  | { type: 'newLane'; props: { initialName: string } }
  | { type: 'deleteParameter'; props: { parameterLaneState: ParameterLaneState } }
  | { type: 'changeParameter'; props: { parameterLaneState: ParameterLaneState } };

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
