## 2024-05-01 - Missing Authentication on Telegram Bot Endpoint
**Vulnerability:** The Telegram bot endpoint lacked user validation, allowing any Telegram user who discovered the bot to issue commands, potentially gaining remote command execution (via `/shell`) and exhausting AI API credits.
**Learning:** Even if a bot is intended for administrative purposes, it is a public interface on Telegram. Without explicit authorization checks, it exposes the entire system to arbitrary users.
**Prevention:** Always implement an explicit allowlist (e.g., via `ALLOWED_TELEGRAM_USERS` environment variable) for bots that perform sensitive actions or provide unrestricted shell/API access.
