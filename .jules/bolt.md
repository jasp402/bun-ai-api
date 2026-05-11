## 2024-05-01 - Missing indexes on cron job tables
**Learning:** The application uses `node-cron` to execute background queries on SQLite tables (`reminders`, `messages`) every minute/hour. These tables are unbounded. However, there are no indexes on the columns being queried (e.g. `is_analyzed`, `is_executed`, `execute_at`), meaning every execution of the cron jobs will perform full-table scans. In SQLite, this degrades performance over time as the database grows, potentially blocking other queries.
**Action:** When inspecting frequent or periodic background jobs interacting with the database, always verify that queries are covered by appropriate indexes, specifically for the filter conditions (`WHERE is_analyzed = 0`, etc.) and sorting criteria.

## 2024-05-01 - Missing indexes on whatsapp_inbox cron job table
**Learning:** Similar to other background jobs, the `whatsapp_inbox` table is polled every 10 seconds to fetch `pending` or `failed` items ordered by `created_at`. Without a composite index covering both status and created_at, SQLite performs full-table scans. This significantly degrades performance over time since the table acts as an unbounded queue log.
**Action:** Always verify that tables functioning as queues (e.g., `whatsapp_inbox`) have composite indexes that cover both their state filtering fields (`status`) and sorting fields (`created_at`).
## 2024-05-04 - SQLite IN clause prevents index-based sorting
**Learning:** Using an `IN (...)` clause alongside `ORDER BY` prevents index-based sorting in SQLite, forcing a full-table B-Tree sort even when a composite index exists. Pulling the result set into JavaScript to sort manually is an anti-pattern.
**Action:** When filtering by multiple states on queue-like unbounded tables with an index, use a `UNION ALL` query where each branch queries a specific state and uses `ORDER BY ... LIMIT ...`. Wrap these inside a main query with the same `ORDER BY ... LIMIT ...`.
