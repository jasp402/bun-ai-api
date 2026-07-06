## 2024-07-06 - Prevent screen readers from reading ASCII art
**Learning:** Screen readers will attempt to read ASCII art (like generated QR codes) character-by-character, which creates a negative user experience.
**Action:** Always use `aria-hidden="true"` on `<pre>` tags or blocks containing visual ASCII art to prevent this issue.
