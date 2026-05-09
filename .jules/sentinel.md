## 2024-05-01 - Missing Authentication on Telegram Bot Endpoint
**Vulnerability:** The Telegram bot endpoint lacked user validation, allowing any Telegram user who discovered the bot to issue commands, potentially gaining remote command execution (via `/shell`) and exhausting AI API credits.
**Learning:** Even if a bot is intended for administrative purposes, it is a public interface on Telegram. Without explicit authorization checks, it exposes the entire system to arbitrary users.
**Prevention:** Always implement an explicit allowlist (e.g., via `ALLOWED_TELEGRAM_USERS` environment variable) for bots that perform sensitive actions or provide unrestricted shell/API access.
## 2024-05-04 - SQL Injection Risk with IN () clause
**Vulnerability:** A raw string concatenation was used inside an SQLite `IN (...)` clause in a background memory analysis cron job (`db.query(\`... WHERE id IN (${ids})\`)`). Even if the IDs originate internally from a previous database query, raw string concatenation leaves the code vulnerable to SQL injection if any ID happens to contain unescaped quotes or if the source of the ID data ever changes to user input.
**Learning:** `bun:sqlite` does not natively support array parameter binding for SQL `IN (?)` clauses out of the box. The safest way to do bulk updates is using a prepared statement and `db.transaction`.
**Prevention:** Never use string concatenation to build query arguments. Always use parameterized queries or `db.transaction()` for batch operations.
## $(date +%Y-%m-%d) - [Fix authorization bypass in Telegram bot]
**Vulnerability:** The bot allowed anyone to use it if the `ALLOWED_TELEGRAM_USERS` environment variable was empty or missing (fail-open mode). Since the bot exposes sensitive commands like `/shell` and `/pc`, this allows full remote code execution if misconfigured.
**Learning:** Checking for authorization must always fail-closed. If there are no explicitly allowed users, no one should be allowed, instead of allowing everyone.
**Prevention:** Always implement an explicit allowlist (e.g., via `ALLOWED_TELEGRAM_USERS` environment variable) for bots that perform sensitive actions or provide unrestricted shell/API access. Default to lockdown mode if the allowlist is missing or empty.
