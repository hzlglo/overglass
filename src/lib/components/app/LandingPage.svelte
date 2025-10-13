<script lang="ts">
  import { GithubIcon } from '@lucide/svelte';
  import EmailSubscribe from './EmailSubscribe.svelte';
  import FileChooser from './FileChooser.svelte';
  import ThemeController from './ThemeController.svelte';
  import UsageAnalyticsCheckbox from './UsageAnalyticsCheckbox.svelte';
</script>

<div class="bg-base-200 min-h-screen w-screen">
  <div class="flex flex-row justify-end gap-2 p-2">
    <a
      class="btn btn-ghost btn-sm btn-square"
      href="https://github.com/hzlglo/overglass"
      title="View on GitHub"
    >
      <GithubIcon />
    </a>
    <ThemeController />
  </div>
  <div class="hero">
    <div class="hero-content">
      <div class="flex flex-col gap-4">
        <h1 class="text-5xl font-bold">Overglass</h1>

        <p>Simplify your Elektron + Ableton workflow</p>
        <div class="divider divider-neutral"></div>
        <div class="flex flex-col justify-start gap-4 text-left">
          <div>
            <p>Overglass makes it easier to edit automation recorded from Overbridge.</p>
          </div>
          <FileChooser />
          <p class="text-base-content/70 text-sm">
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
          <div class="flex flex-col gap-4 text-xs">
            <EmailSubscribe />
            <UsageAnalyticsCheckbox />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
