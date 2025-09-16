# Technical README

## Overview

This project bridges Ableton Live’s `.als` project format with a specialized interface for editing **Elektron hardware automation**.

### Core Functionality

- Parse and read Ableton Live `.als` project files (gzipped XML).
- Interactive web app to view and edit:
  - Track automation data
- Write edited track automation data back to `.als` file.
- Special handling for **Elektron devices**, where each hardware track is treated as its own DAW track (instead of a single track with many parameter automations like `T1 Volume`, `T8 Reverb`).

---

## Data Model & Parsing

### Data Model

- **Hierarchy:** Devices → Tracks → Parameters → Automation Points
- **Track Grouping:** Parse parameter names to extract track numbers (e.g. `"T1 Filter Cutoff"` → Track 1).

### ALS File Parsing

- Extract:
  - List of devices
  - List of tracks
  - Per-track automation data

### Database

- **DuckDB** used for efficient storage and querying of parsed data.
- Stored entities: devices, tracks, parameters, automation points.

---

## Technical Architecture

### Frontend

- **Framework:** Svelte 5 with Runes system
- **Styling:** Tailwind CSS + DaisyUI
- **UI Components:** ArkUI for interactivity

### Backend / Data Layer

- **Database:** DuckDB (with TypeScript integration)
- Services to read+write specific data from database, e.g. DeviceService, TracksService

### Data Flow

```
ALS file → Parser → Database entities → UI components → Database updates → ALS writer → ALS file
```

### State Management

- Reactive **Svelte stores** handle:
  - Application state
  - Database connections
  - UI state

---

## Development Standards

- **Type Safety:** Enforced across the codebase.
- **Schema-First:** `schema.ts` defines shared types, each with a unique `.id`. Types should be imported and shared whereever possible.
- **Code Organization:** Modular architecture; logical components in separate files.
- **Testing:**
  - Framework: Vitest (Node.js environment)
  - Approach: Unit tests where possible
  - DB Testing: `duckdb-node` for tests; `duckdb-wasm` in frontend
- **Dependency Injection:** For libraries that differ between browser & node/testing environments
- **Package Management:** Yarn
- **Code Style:** Prioritize readability, minimal duplication, full TypeScript

---

## Elektron Device Support

- **Generic by Default:** Designed to support any Ableton project.
- **Configurable Elektron Logic:**
  - Regex patterns to map parameters (e.g., `"T1 Filter Cutoff"` → Track 1)
  - Detect mute-state automation
- **Customization Layer:** All Elektron-specific logic centralized in configs.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
