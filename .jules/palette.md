## 2024-05-28 - ASCII Art Accessibility in API Responses
**Learning:** Screen readers attempt to read ASCII art character-by-character, which creates a terrible UX, especially for dense content like generated ASCII QR codes in the WhatsApp integration.
**Action:** Always apply `aria-hidden="true"` to `<pre>` tags or blocks containing purely visual ASCII art to hide them from assistive technologies. Ensure API endpoints returning HTML include basic accessibility boilerplate like `lang`, `meta viewport`, and a proper `<title>`.
