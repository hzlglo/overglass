import posthog from 'posthog-js';

const getEnableUsageAnalytics = () => {
  let enableUsageAnalytics = $state(false);

  return {
    getEnableUsageAnalytics: () => enableUsageAnalytics,
    setEnableUsageAnalytics: (enableUsageAnalytics: boolean) => {
      console.log('setEnableUsageAnalytics', enableUsageAnalytics);
      enableUsageAnalytics = enableUsageAnalytics;
      if (!enableUsageAnalytics) {
        posthog.opt_out_capturing();
      } else {
        posthog.opt_in_capturing();
      }
    },
  };
};

export const enableUsageAnalyticsStore = getEnableUsageAnalytics();
