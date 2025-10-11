<script lang="ts">
  import { GithubIcon } from '@lucide/svelte';
  import EmailSubscribe from './EmailSubscribe.svelte';
  import FileChooser from './FileChooser.svelte';
  import HelpModal from './HelpModal.svelte';
  import ThemeController from './ThemeController.svelte';
  import { enableUsageAnalyticsStore } from './enableUsageAnalytics.svelte';
</script>

<!-- File chooser card -->
<!-- <div class="hero bg-base-200 min-h-screen">
  <div class="hero-content text-center">
    <div class="max-w-md">
      <h1 class="text-5xl font-bold">Hello there</h1>
      <p class="py-6">
        Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem
        quasi. In deleniti eaque aut repudiandae et a id nisi.
      </p>
      <button class="btn btn-primary">Get Started</button>
    </div>
  </div>
</div> -->
<div class="relative">
  <div class="absolute top-4 right-4 flex flex-row gap-2">
    <HelpModal />
    <a
      class="btn btn-ghost btn-sm btn-square"
      href="https://github.com/hzlglo/overglass"
      title="View on GitHub"
    >
      <GithubIcon />
    </a>
    <ThemeController />
  </div>
  <div class="hero bg-base-200 min-h-screen">
    <div class="hero-content text-center">
      <div class="flex max-w-lg flex-col gap-4">
        <h1 class="text-5xl font-bold">Overglass</h1>

        <p>Simplify your Elektron + Ableton workflow</p>
        <div class="divider"></div>
        <div class="mt-4 flex flex-col justify-start gap-4 text-left">
          <div>
            <p>Overglass makes it easier to edit automation recorded from Overbridge.</p>
          </div>
          <FileChooser />
          <p>
            Your file won't leave your computer. Overglass runs entirely in your browser.
            <a
              class="link"
              href="https://docs.google.com/document/d/121NUcaH3U1NsMa1u3bYBQZxF1vooAETfR9-7-fkNyQ8/edit?usp=sharing"
              target="_blank"
            >
              Read the docs
            </a>
          </p>
          <div class="divider"></div>
          <div class="mt-10 flex flex-col gap-4 text-xs">
            <EmailSubscribe />
            <div class="flex flex-row gap-2">
              <input
                type="checkbox"
                checked={enableUsageAnalyticsStore.getEnableUsageAnalytics()}
                onchange={(event) =>
                  enableUsageAnalyticsStore.setEnableUsageAnalytics(
                    (event.target as HTMLInputElement).checked,
                  )}
              />
              <p>Enable usage analytics to help make this app better</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
