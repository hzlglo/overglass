<script lang="ts">
  import { GithubIcon } from '@lucide/svelte';
  import EmailSubscribe from './EmailSubscribe.svelte';
  import FileChooser from './FileChooser.svelte';
  import HelpModal from './HelpModal.svelte';
  import ThemeController from './ThemeController.svelte';
  import UsageAnalyticsCheckbox from './UsageAnalyticsCheckbox.svelte';
</script>

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
            <UsageAnalyticsCheckbox />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
