## 2025-02-23 - Accessibility of ASCII Art
**Learning:** Screen readers attempt to read ASCII art character by character, leading to an extremely poor and confusing user experience. This was specifically noted in dynamically generated visual outputs like ASCII QR codes where a massive block of unreadable characters is presented.
**Action:** Always apply `aria-hidden="true"` to `<pre>` tags, `<div>` elements, or any other blocks containing visual ASCII art to prevent screen readers from announcing them. Provide a valid text alternative elsewhere when necessary.
