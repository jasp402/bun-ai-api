## 2025-02-13 - WhatsApp QR code ASCII art accessibility
**Learning:** Screen readers attempt to read generated ASCII art character-by-character, creating a poor user experience. Also dynamically generated HTML strings need proper boilerplate to ensure proper mobile rendering and basic accessibility.
**Action:** Used `aria-hidden="true"` on the `<pre>` tag containing the ASCII QR code and added full HTML boilerplate with `lang="en"` and `<meta name="viewport">` for the QR endpoint response.
