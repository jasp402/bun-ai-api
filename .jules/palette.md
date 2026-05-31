## 2024-05-31 - ASCII Art Screen Reader Compatibility
**Learning:** Screen readers attempt to read ASCII art character-by-character, leading to a terrible user experience. Also, dynamically generated HTML API strings without proper boilerplate (`<head>`, `<title>`, `<meta name="viewport">`) are less accessible and can render poorly on mobile devices.
**Action:** Always add `aria-hidden="true"` to `<pre>` tags or blocks containing visual ASCII art. Always include proper HTML boilerplate when returning raw HTML strings from API endpoints to ensure basic accessibility and mobile rendering.
