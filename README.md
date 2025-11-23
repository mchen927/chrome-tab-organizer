# Chrome Tab Organizer Extension

A Chrome extension built with TypeScript, React, and Vite that helps organize your tabs into groups.

## Phase 1 - MVP

This extension:
- Groups tabs by hostname
- Lets you select/deselect entire groups or individual tabs
- Creates Chrome tab groups when you click "Organize Tabs"

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Add an icon:**
   - Create or add a `icon128.png` file (128x128 pixels) in the project root
   - This will be copied to `dist/` during build

3. **Development:**
   ```bash
   npm run dev
   ```
   This starts the Vite dev server. Note: For Chrome extension development, you'll typically build and load the extension rather than using the dev server.

4. **Build:**
   ```bash
   npm run build
   ```
   This creates the `dist/` folder with all necessary files.

5. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist/` folder from this project
   - The extension icon should appear in your toolbar

6. **Test:**
   - Open multiple tabs from different websites
   - Click the extension icon
   - You should see tabs grouped by hostname
   - Select/deselect groups or individual tabs
   - Click "Organize Tabs" to create Chrome tab groups

## Project Structure

```
tab-organizer/
  manifest.json          # Chrome extension manifest
  icon128.png           # Extension icon (you need to add this)
  index.html            # Vite entry HTML
  vite.config.ts        # Vite configuration
  tsconfig.json         # TypeScript configuration
  package.json          # Dependencies and scripts
  src/
    main.tsx            # React entry point
    App.tsx             # Main popup component
    App.css             # Component styles
    index.css           # Global styles
  scripts/
    copy-manifest.js    # Build script to copy manifest and icon
  dist/                 # Built files (generated)
```

## How It Works

1. **Tab Fetching:** On mount, the app queries all tabs in the current window using `chrome.tabs.query()`

2. **Filtering:** Removes Chrome internal pages (`chrome://`) and extension pages (`chrome-extension://`)

3. **Grouping:** Groups tabs by hostname (e.g., all `youtube.com` tabs together)

4. **Selection:** Users can toggle entire groups or individual tabs

5. **Organization:** When "Organize Tabs" is clicked:
   - For each selected group, creates a Chrome tab group using `chrome.tabs.group()`
   - Sets the group title to the hostname
   - Colors the group blue

