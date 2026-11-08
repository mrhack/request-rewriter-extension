# Privacy Policy for Request Rewriter

**Last updated: November 8, 2026**

## Overview

Request Rewriter is a Chrome browser extension that allows users to modify HTTP request headers based on user-defined rules. This privacy policy explains how the extension handles data.

## Data Collection

**Request Rewriter does NOT collect, transmit, or share any personal data or user information.**

- No analytics or tracking is used.
- No data is sent to any remote server.
- No third-party services are integrated.

## Data Storage

All user-defined configuration (rules, header modifications, enable/disable state) is stored locally on the user's device using `chrome.storage.local`. This data:

- Never leaves the user's device.
- Is accessible only by the extension itself.
- Can be cleared at any time by the user via Chrome's extension settings or by uninstalling the extension.

## Permissions

- **storage**: Used to save and load user configuration locally.
- **declarativeNetRequest**: Used to modify HTTP request headers based on user-defined rules.
- **Host permissions (`<all_urls>`)**: Required to apply header modifications to any URL the user chooses to target. The extension does not read, intercept, or log page content.

## User Control

Users have full control over:

- Which rules are created and enabled.
- Which URLs are targeted by each rule.
- Whether the extension is enabled or disabled.
- All data can be deleted at any time.

## Contact

For privacy-related questions, please open an issue at: https://github.com/mrhack/request-rewriter-extension/issues
