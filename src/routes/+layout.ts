import { browser } from '$app/environment';
import posthog from 'posthog-js';
export const ssr = false;

export const load = async () => {
  if (browser) {
    posthog.init('phc_jNE3deF5LflJzr7AZtgIwFgTknGDqVdBBqvhEPk4GZ2', {
      api_host: 'https://us.i.posthog.com',
      defaults: '2025-05-24',
      person_profiles: 'always',
    });
  }

  return;
};
