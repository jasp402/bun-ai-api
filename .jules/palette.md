## 2024-05-16 - Dynamic HTML Viewport and Accessibility
**Learning:** When API endpoints return raw HTML (like the WhatsApp QR code endpoint), omitting the `<meta name="viewport">` and `lang` attribute severely degrades the mobile experience, causing tiny unreadable text and poor screen reader compatibility. Standardizing dynamic HTML output is just as important as React/Next.js components.
**Action:** Always include basic boilerplate (`<html lang="en">`, `<meta name="viewport">`, `<title>`) when returning raw HTML strings from API endpoints to ensure mobile accessibility.
