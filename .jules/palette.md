## 2025-02-20 - WhatsApp QR Code Expiration UX
**Learning:** When displaying time-sensitive QR codes for authentication (like WhatsApp web), auto-refreshing the page or using live-updates is a critical UX pattern to prevent users from scanning expired codes.
**Action:** Add `<meta http-equiv="refresh" content="15">` to any static HTML pages that serve short-lived QR codes to ensure the user always sees a valid code.
