## 2025-01-29 - Missing HTML Boilerplate in API endpoints

**Learning:** Dynamically generated HTML strings returned by APIs (like the WhatsApp QR code endpoint) often lack basic HTML structure (`<head>`, `<title>`, `<meta name="viewport">`, and `lang` attributes). This leads to poor mobile rendering and completely breaks basic accessibility for screen readers. It's a common oversight since the code isn't part of the standard web frontend build process.

**Action:** Whenever generating raw HTML from a backend service, always ensure the output is wrapped in a complete, valid HTML document structure with appropriate meta tags and accessibility attributes (e.g. `aria-labelledby`, `role="alert"` for fallback content).
