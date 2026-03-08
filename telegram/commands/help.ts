import { sendMessage } from '../utils';
import type { TelegramMessage } from '../types';

export async function handleHelp(message: TelegramMessage) {
    const helpMsg = `📖 <b>Available Commands</b>
───────────────

🔧 <b>Admin</b>
<code>/help</code> — Show this help
<code>/setbio text</code> — Update bot bio
<code>/setdesc text</code> — Update bot description
<code>/setpic</code> — Update bot profile picture

📂 <b>Project Management</b>
<code>/projects</code> — List all registered projects
<code>/addproject path</code> — Auto-detect and add project
<code>/addproject name|path|stack|dev|agent</code> — Explicit add
<code>/rmproject name</code> — Remove a project
<code>/switch name</code> — Switch active project

⚡ <b>Process Control</b>
<code>/run</code> — Start dev server
<code>/agent [cmd]</code> — Start AI agent for project
<code>/ngrok [port]</code> — Start ngrok tunnel
<code>/status</code> — Show all running processes
<code>/logs</code> — Show recent logs of active project
<code>/stop</code> — Stop active project processes
<code>/stopall</code> — Stop ALL processes

🤖 <b>IA Agents (Gods)</b>
<code>/gemini [cmd]</code> — Invoque Gemini
<code>/claude [cmd]</code> — Invoque Claude Code
<code>/codex [cmd]</code> — Invoque Codex

⌨️ <b>Automation</b>
<code>/pc [ahk]</code> — Run AutoHotkey v2 code
<code>/screen</code> — Take PC screenshot
<code>/shell [cmd]</code> — Run PowerShell command

💬 <b>Chat</b>
Just type any message to talk with the AI assistant!
───────────────
💡 <i>Commands are case-insensitive</i>`;
    await sendMessage(message.chat.id, helpMsg);
}
