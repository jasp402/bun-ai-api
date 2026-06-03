## 2025-02-28 - WhatsApp QR Code HTML Boilerplate & ASCII Art Accessibility
**Learning:** When dynamically generating HTML strings from an API, missing boilerplate (`<head>`, `<meta name="viewport">`, `lang` attributes, `<title>`) can cause poor rendering on mobile devices and accessibility issues. Furthermore, screen readers try to read ASCII art character by character, leading to a horrible user experience.
**Action:** Always include basic HTML boilerplate when returning raw HTML, and always use `aria-hidden="true"` on blocks containing visual ASCII art to hide them from screen readers.
