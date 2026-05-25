## 2025-02-24 - ASCII Art Screen Reader Accessibility
**Learning:** Screen readers will attempt to read ASCII art character by character, creating a terrible user experience.
**Action:** Always use `aria-hidden="true"` on `<pre>` tags or blocks containing visual ASCII art to prevent this.
