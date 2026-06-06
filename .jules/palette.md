
## 2024-06-06 - ASCII Art Accessibility in API HTML Responses
**Learning:** Screen readers attempt to read ASCII art character-by-character, leading to an extremely poor user experience. Additionally, dynamically generated HTML API responses (like the WhatsApp QR code endpoint) often lack proper HTML boilerplate (`<head>`, `<title>`, `<meta name="viewport">`, `lang`), causing basic accessibility and mobile rendering issues.
**Action:** When returning dynamically generated HTML strings, always include proper HTML boilerplate. Always apply `aria-hidden="true"` to `<pre>` tags or blocks containing visual ASCII art to prevent screen readers from reading them.
