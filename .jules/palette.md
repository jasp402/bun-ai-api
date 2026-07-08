## 2024-03-24 - ASCII Art Screen Reader Accessibility
**Learning:** Screen readers will attempt to read ASCII art character-by-character, creating a negative user experience.
**Action:** Always use `aria-hidden="true"` on `<pre>` tags or blocks containing visual ASCII art (like generated QR codes) to prevent this negative user experience.