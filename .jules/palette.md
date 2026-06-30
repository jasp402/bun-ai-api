## 2024-05-18 - HTML API Endpoints and ASCII Art Accessibility
**Learning:** Dynamically generated HTML from API endpoints often lacks standard HTML boilerplate. This can lead to poor mobile rendering and broken accessibility. Furthermore, ASCII art in `<pre>` tags is read out character-by-character by screen readers, creating a terrible UX.
**Action:** Always include full HTML boilerplate (`<head>`, `<title>`, `<meta name="viewport">`, `lang`) when returning HTML strings. Use `aria-hidden="true"` on `<pre>` blocks containing visual ASCII art to hide them from screen readers.
