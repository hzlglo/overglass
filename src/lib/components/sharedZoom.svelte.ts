const getSharedZoom = () => {
  let zoom = $state<d3.ZoomBehavior<SVGElement, unknown>>();

  // Zoom state - default to (0, maxTime) as requested
  let zoomDomain = $state<[number, number]>([0, 60]);
  let isZooming = $state(false); // Prevent infinite zoom loops

  return {
    getIsZooming: () => isZooming,
    setZooming: (isZoomingInner: boolean) => {
      isZooming = isZoomingInner;
    },
    setZoomDomain: (zoomDomainInner: [number, number]) => {
      zoomDomain = zoomDomainInner;
    },
    getZoomDomain: () => zoomDomain,
    getZoom: () => zoom,
    setZoom: (zoomInner: d3.ZoomBehavior<SVGElement, unknown>) => {
      zoom = zoomInner;
    },
  };
};

export const sharedZoom = getSharedZoom();
