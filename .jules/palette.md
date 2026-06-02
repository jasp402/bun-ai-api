## 2024-05-30 - Added ARIA Hidden to ASCII Art QR code
**Learning:** Screen readers will attempt to read ASCII art character-by-character, which is a terrible experience. ASCII representations of QR codes specifically need to be hidden from screen readers.
**Action:** Always add `aria-hidden="true"` to `<pre>` blocks or tags containing visual ASCII art. Also ensure dynamically generated HTML from API endpoints includes `<html lang="...">` and standard boilerplate for baseline accessibility.
