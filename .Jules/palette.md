## 2024-07-02 - ASCII Art Screen Reader Experience
**Learning:** Screen readers will attempt to read ASCII art character-by-character, leading to a very poor and confusing user experience.
**Action:** Always use `aria-hidden="true"` on `<pre>` tags or blocks containing visual ASCII art (like generated QR codes) to prevent screen readers from reading them.
