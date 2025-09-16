# Technical README

Specific Requirements

Core Functionality

- ALS File Parsing: Parse Ableton Live project files (gzipped xml) to extract device automation data
- Database Storage: Store parsed data (devices, tracks, parameters, automation points) in DuckDB for efficient querying
- Automation Visualization: Display automation curves as interactive charts using D3.js
- Time-Based Editing: Support for editing automation points with proper musical timing (bars/beats/seconds)

Technical Architecture

- Frontend: Svelte 5 with runes system, Tailwind CSS + DaisyUI for styling, ArkUI for interactive components
- Database: DuckDB with TypeScript, organized into modular services (DeviceService, TracksService, AutomationService,
  ClipService)
- Data Flow: ALS file → Parser → Database entities → UI components
- State Management: Reactive Svelte stores for app state, database connections, and UI state

UI/UX Requirements

- File Loading: Initial file chooser screen with hardcoded test file loading for development
- Main Interface: DAW layout with navbar, device list, and timeline
- Device Organization: Expandable devices showing tracks and parameters
- Chart Layout: Continuous automation charts on left (2/3 width), device/parameter info on right (1/3 width)
- No Vertical Gaps: Charts flow seamlessly without text or spacing between them
- Auto-Expansion: Devices and parameters expanded by default but still collapsible

Data Model Requirements

- Data Model: Devices → Tracks → Parameters → Automation Points
- Track Grouping: Parse parameters by track number from parameter names
- Clip Detection: Identify clips from mute automation patterns

Development Standards

- Type safety is enforced throughout the codebase.
- Schema-First: schema.ts types are shared throughout codebase. Each schema has a unique .id identifier.
- Code Organization: Modular architecture with separate files for logical components
- Testing: Unit tests where-ever possible. While the frontend uses duckdb-WASM, tests can be written using duckdb-node.
- Package Management: Yarn for dependencies
- Code Style: Optimized for readability, minimal duplication, TypeScript throughout

Specific Elektron Support

- Whereever possible, this is designed to be generic to any Ableton set, rather than specific to Elektron devices.
- Any Elektron-specific logic is centralized into customizable config, e.g. regexes to extract Track 1 from paramers named "T1 Filter Cutoff" or detecting mute-state parameters.

The project essentially bridges the gap between Ableton Live's project format and a specialized interface for editing
Elektron hardware automation, with a focus on musical timing accuracy and professional DAW-style user experience.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
