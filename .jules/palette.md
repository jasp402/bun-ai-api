## 2025-05-15 - Improve ASCII Art Accessibility
**Learning:** Screen readers will attempt to read ASCII art character-by-character, leading to a frustrating user experience.
**Action:** Always use `aria-hidden="true"` on `<pre>` tags or other blocks containing visual ASCII art (like generated QR codes) to prevent this.
