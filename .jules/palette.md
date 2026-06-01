## 2024-06-01 - Prevent screen readers from spelling out ASCII art
**Learning:** Screen readers attempt to read out ASCII art (like generated QR codes) character-by-character, leading to a negative user experience.
**Action:** Always use `aria-hidden="true"` on `<pre>` tags or blocks containing visual ASCII art to prevent screen readers from announcing them. Also ensure dynamically generated HTML from API endpoints contains proper HTML boilerplate (like `<title>`, `<html lang="en">`, and `<meta name="viewport">`) for mobile accessibility.
