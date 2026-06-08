## 2024-06-08 - WhatsApp QR Code HTML API Response Accessibility
**Learning:** Returning dynamically generated HTML strings from API endpoints (like `/api/v1/whatsapp/qr`) without proper HTML boilerplate causes accessibility issues. Furthermore, screen readers attempt to read ASCII art character-by-character, creating a poor user experience.
**Action:** Always include full HTML boilerplate (`<!doctype html>`, `<html lang="...">`, `<head>`, `<title>`, `<meta name="viewport">`) for any HTML endpoint. Always use `aria-hidden="true"` on `<pre>` tags or blocks containing visual ASCII art.
