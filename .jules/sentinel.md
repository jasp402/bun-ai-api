## 2024-05-01 - Missing Authentication on Telegram Bot Endpoint
**Vulnerability:** The Telegram bot endpoint lacked user validation, allowing any Telegram user who discovered the bot to issue commands, potentially gaining remote command execution (via `/shell`) and exhausting AI API credits.
**Learning:** Even if a bot is intended for administrative purposes, it is a public interface on Telegram. Without explicit authorization checks, it exposes the entire system to arbitrary users.
**Prevention:** Always implement an explicit allowlist (e.g., via `ALLOWED_TELEGRAM_USERS` environment variable) for bots that perform sensitive actions or provide unrestricted shell/API access.

## 2025-02-27 - SQL Injection via String Concatenation for IN Clause
**Vulnerability:** The code dynamically constructed an SQL `IN` clause using string concatenation (`db.query(\`UPDATE messages SET is_analyzed = 1 WHERE id IN (${ids})\`)`), exposing the application to SQL injection if any ID contained unescaped characters.
**Learning:** `bun:sqlite` does not support array binding for `IN (?)`. A secure alternative is necessary to prevent injection when handling multiple IDs.
**Prevention:** Always use parameterized queries. When dealing with multiple values (like an `IN` clause), use `db.transaction()` to iterate through the values and execute a parameterized query (e.g., `WHERE id = $id`) safely for each one.
