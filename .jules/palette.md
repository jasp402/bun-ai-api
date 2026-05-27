## 2024-05-15 - ASCII Art Accessibility
**Learning:** Screen readers will attempt to read ASCII art character-by-character, creating a terrible user experience.
**Action:** Always use `aria-hidden="true"` on `<pre>` tags or blocks containing visual ASCII art (like generated QR codes) to prevent this negative user experience.
