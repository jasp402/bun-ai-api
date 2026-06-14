## 2024-06-14 - Prevent Screen Readers from Parsing ASCII Art
**Learning:** Screen readers will attempt to read ASCII art character-by-character, which creates a highly negative user experience. This occurred with the dynamically generated WhatsApp ASCII QR code on the `/api/v1/whatsapp/qr` endpoint.
**Action:** Always apply `aria-hidden="true"` to `<pre>` tags or blocks that contain visual ASCII art to prevent screen readers from reading them. Ensure that text equivalents or visual images with `alt` text are provided as accessible alternatives.
