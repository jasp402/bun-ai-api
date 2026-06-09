
## 2024-06-09 - Accessible QR Code Rendering
**Learning:** Screen readers will attempt to read ASCII art character-by-character, which is a terrible user experience. Also, raw HTML responses need boilerplate like viewport tags to render correctly on mobile.
**Action:** Always add `aria-hidden="true"` to `<pre>` tags containing ASCII art. Always include `<head>`, `<title>`, `<meta name="viewport">`, and `lang` attributes in dynamically generated HTML API strings.
