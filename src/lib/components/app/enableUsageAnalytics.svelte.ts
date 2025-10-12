import posthog from 'posthog-js';

const getEnableUsageAnalytics = () => {
  let enableUsageAnalytics = $state(false);

  return {
    getEnableUsageAnalytics: () => enableUsageAnalytics,
    setEnableUsageAnalytics: (enableUsageAnalyticsInner: boolean) => {
      enableUsageAnalytics = enableUsageAnalyticsInner;
      if (!enableUsageAnalytics) {
        posthog.opt_out_capturing();
      } else {
        posthog.opt_in_capturing();
      }
    },
  };
};

export const enableUsageAnalyticsStore = getEnableUsageAnalytics();
