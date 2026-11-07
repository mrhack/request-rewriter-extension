# Request Rewriter

A Chrome extension to rewrite HTTP request headers using the `declarativeNetRequest` API.

## Features

- **Request Header Modification** — Add or override request headers per rule using simple key-value pairs
- **URL Pattern Matching** — Match requests by regex pattern; empty pattern matches all requests
- **Per-Rule Toggle** — Enable or disable individual rules without deleting them
- **Global Toggle** — Turn the entire extension on or off with a single switch
- **Auto-Save** — All changes are automatically persisted to `chrome.storage.local`; no manual save needed
- **Config Import/Export** — Export rules to JSON and import them on another machine
- **Dynamic Toolbar Icon** — The "R" icon turns green when the extension is enabled and gray when disabled
- **Collapsed Card Preview** — Configured header modifications are visible as tags on collapsed cards
- **Test URL Matching** — Enter a test URL to verify whether it matches a rule's pattern in real time

## Installation

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this project directory

## Usage

1. Click the extension icon in the toolbar to open the popup
2. Click **＋** to create a new rule
3. Enter a **URL regex** pattern (leave empty to match all requests)
4. Add header rows under **Request Header** — each row has a key and value
5. Use the toggle on each card to enable/disable that rule
6. Use the top-bar toggle to enable/disable the entire extension
7. All changes are saved automatically

### Import / Export

- Click **📥** to import rules from a JSON file
- Click **📤** to export all rules to a JSON file

## Data Model

```json
{
  "rules": [
    {
      "id": "unique-id",
      "name": "Rule name",
      "enabled": true,
      "matchPattern": "api/v1/.*",
      "headerMods": {
        "on": true,
        "rows": [{ "k": "x-custom-header", "v": "value" }]
      }
    }
  ]
}
```

## Testing

```bash
node --test
```

## Tech Stack

- Chrome Extension Manifest V3
- `declarativeNetRequest` API for header rewriting (no debugger API)
- `chrome.storage.local` for persistence
- Pure JavaScript (no build step, no dependencies)
- 42 unit tests covering rule logic and UI behavior

## License

MIT
