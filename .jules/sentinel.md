## 2024-05-01 - Missing Authentication on Telegram Bot Endpoint
**Vulnerability:** The Telegram bot endpoint lacked user validation, allowing any Telegram user who discovered the bot to issue commands, potentially gaining remote command execution (via `/shell`) and exhausting AI API credits.
**Learning:** Even if a bot is intended for administrative purposes, it is a public interface on Telegram. Without explicit authorization checks, it exposes the entire system to arbitrary users.
**Prevention:** Always implement an explicit allowlist (e.g., via `ALLOWED_TELEGRAM_USERS` environment variable) for bots that perform sensitive actions or provide unrestricted shell/API access.
## 2024-05-04 - SQL Injection Risk with IN () clause
**Vulnerability:** A raw string concatenation was used inside an SQLite `IN (...)` clause in a background memory analysis cron job (`db.query(\`... WHERE id IN (${ids})\`)`). Even if the IDs originate internally from a previous database query, raw string concatenation leaves the code vulnerable to SQL injection if any ID happens to contain unescaped quotes or if the source of the ID data ever changes to user input.
**Learning:** `bun:sqlite` does not natively support array parameter binding for SQL `IN (?)` clauses out of the box. The safest way to do bulk updates is using a prepared statement and `db.transaction`.
**Prevention:** Never use string concatenation to build query arguments. Always use parameterized queries or `db.transaction()` for batch operations.
## 2024-05-10 - Missing Authentication on Telegram Bot Endpoint (Fail-Closed)
**Vulnerability:** The Telegram bot endpoint failed open if `ALLOWED_TELEGRAM_USERS` was not set, allowing any user to issue commands.
**Learning:** Defaulting to fail-open for authorization checks is dangerous, especially for bots that provide administrative access. A fail-closed mechanism ensures that access is denied unless explicitly granted. However, legitimate public bots require a way to bypass this, such as explicitly supporting a wildcard `*`.
**Prevention:** Always implement a fail-closed behavior for authorization checks. If the allowlist is missing, default to denying access. Provide an explicit way to opt-in to public access if intended.
