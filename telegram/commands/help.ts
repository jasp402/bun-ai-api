import { sendMessage } from '../utils';
import type { TelegramMessage } from '../types';

export async function handleHelp(message: TelegramMessage) {
    const helpMsg = `📖 <b>Guía de Comandos Disponibles</b>
───────────────

📂 <b>Gestión de Proyectos</b>
<code>/projects</code> — Lista todos los proyectos (ej: /projects)
<code>/addproject</code> — Registra un nuevo proyecto (ej: /addproject mi-app)
<code>/rmproject</code> — Borra un proyecto (ej: /rmproject mi-app)
<code>/switch</code> — Cambia el proyecto activo (ej: /switch mi-app)

⚡ <b>Control de Ejecución</b>
<code>/run</code> — Inicia el servidor (ej: /run npm start)
<code>/runbg</code> — Inicia el servidor en segundo plano
<code>/status</code> — Mira qué procesos están corriendo
<code>/logs</code> — Mira los últimos logs del proyecto activo
<code>/stop</code> — Detiene el proyecto actual
<code>/stopall</code> — Mata TODOS los procesos activos

🤖 <b>Agentes de IA (Invocaciones)</b>
<code>/gemini [msj]</code> — Llama a Gemini (ej: /gemini hola)
<code>/claude [msj]</code> — Llama a Claude (ej: /claude revisa este código)
<code>/codex [msj]</code> — Llama a Codex
<code>/agent</code> — Inicia el agente de IA del proyecto

🔋 <b>Disponibilidad y Seguimiento</b>
<code>/busy [t]</code> — Márcate como ocupado (ej: /busy un rato, /busy mañana)
<code>/free</code> — Quita el estado de ocupado
<code>/nudge [t]</code> — Ajusta cuándo te escribo (ej: /nudge intenso, /nudge 6h)
<code>/quiet [h]</code> — Horas de silencio (ej: /quiet 22:00 09:00)

⌨️ <b>Automatización PC</b>
<code>/pc [cmd]</code> — Controla el PC con AHK (ej: /pc apagar pantalla)
<code>/screen</code> — Toma una captura de pantalla actual
<code>/shell [cmd]</code> — Ejecuta comandos PowerShell (ej: /shell dir)

💬 <b>Chat Directo</b>
¡Simplemente escribe cualquier mensaje para hablar conmigo! 
Dependiendo de tu modo /nudge, te escribiré si pasas tiempo sin decir nada.
───────────────
💡 <i>Los comandos no distinguen mayúsculas de minúsculas.</i>`;
    await sendMessage(message.chat.id, helpMsg);
}
