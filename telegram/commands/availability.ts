import { sendMessage } from '../utils';
import { memoryService } from '../../services/memory';

function parseNaturalTime(args: string): { hours?: number, date?: Date } | null {
    const text = args.toLowerCase().trim();
    const now = new Date();

    // Mapeo de términos simples
    if (text === 'un rato') return { hours: 2 };
    if (text === 'luego') return { hours: 4 };
    if (text === 'mañana') return { hours: 24 };
    if (text === 'un día' || text === 'un dia') return { hours: 24 };
    if (text === 'una semana') return { hours: 24 * 7 };
    
    // Modos de personalidad / Intensidad
    if (text === 'muy intenso' || text === 'intenso') return { hours: 3 };
    if (text === 'relajado') return { hours: 12 };
    if (text === 'despreocupado') return { hours: 48 };
    if (text === 'olvidadizo') return { hours: 168 };
    if (text === 'esta noche') {
        const tonight = new Date();
        tonight.setHours(21, 0, 0, 0);
        if (tonight <= now) tonight.setDate(tonight.getDate() + 1);
        return { date: tonight };
    }

    // Soporte para números solos (asumir horas)
    if (/^\d+$/.test(text)) {
        return { hours: parseInt(text) };
    }

    // Soporte para formatos 5h, 1d, etc.
    const match = text.match(/^(\d+)([hdm])$/);
    if (match) {
        const val = parseInt(match[1]);
        const unit = match[2];
        if (unit === 'h') return { hours: val };
        if (unit === 'd') return { hours: val * 24 };
        if (unit === 'm') return { hours: val / 60 };
    }

    // Intentar parsear como fecha estándar
    const parsedDate = Date.parse(args);
    if (!isNaN(parsedDate)) {
        return { date: new Date(parsedDate) };
    }

    return null;
}

export async function handleQuiet(message: any, args: string) {
    const chatId = message.chat.id;
    const userId = message.from.id.toString();
    const parts = args.split(' ').filter(p => p.trim());
    
    if (parts.length < 2) {
        return sendMessage(chatId, "⚠️ Uso: /quiet HH:mm HH:mm (ej: /quiet 22:00 09:00)");
    }
    
    const [start, end] = parts;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
        return sendMessage(chatId, "⚠️ Formato de hora inválido. Usa HH:mm (ej: 22:30).");
    }

    memoryService.setUserQuietHours(userId, start, end);
    return sendMessage(chatId, `🤫 Horas de silencio configuradas: de <b>${start}</b> a <b>${end}</b>. No te enviaré toques proactivos en ese horario.`);
}

export async function handleBusy(message: any, args: string) {
    const chatId = message.chat.id;
    const userId = message.from.id.toString();
    
    if (!args) {
        return sendMessage(chatId, "⚠️ Uso: /busy [tiempo] (ej: /busy un rato, /busy mañana, /busy 5h)");
    }

    const time = parseNaturalTime(args);
    if (!time) {
        return sendMessage(chatId, "⚠️ No entendí ese tiempo. Prueba con: 'un rato', 'luego', 'mañana', '5h', o un número de horas.");
    }

    let until = time.date || new Date(new Date().getTime() + (time.hours! * 60 * 60 * 1000));

    if (until <= new Date()) {
        return sendMessage(chatId, "⚠️ La fecha/hora debe ser en el futuro.");
    }

    memoryService.setUserBusy(userId, until.toISOString());
    return sendMessage(chatId, `🔋 Estás marcado como <b>ocupado</b> hasta: <code>${until.toLocaleString()}</code>. No te molestaré de forma proactiva.`);
}

export async function handleFree(message: any) {
    const chatId = message.chat.id;
    const userId = message.from.id.toString();
    
    memoryService.setUserBusy(userId, null);
    return sendMessage(chatId, "🔓 Ya no estás marcado como ocupado. Volveré a ser proactivo si detecto inactividad.");
}

export async function handleNudge(message: any, args: string) {
    const chatId = message.chat.id;
    const userId = message.from.id.toString();
    
    if (!args) {
        return sendMessage(chatId, "⚠️ Uso: /nudge [tiempo] (ej: /nudge un día, /nudge luego, /nudge 6).");
    }

    const time = parseNaturalTime(args);
    if (!time || time.date) {
        return sendMessage(chatId, "⚠️ No entendí ese tiempo de espera. Prueba con: 'un rato', 'un día', '12', o '6h'.");
    }

    const hours = time.hours!;
    if (hours < 0.5) {
        return sendMessage(chatId, "⚠️ El tiempo mínimo de inactividad es de 30 minutos (0.5).");
    }

    memoryService.setUserNudgeDelay(userId, hours);
    return sendMessage(chatId, `🔔 Tiempo de inactividad configurado: <b>${args}</b> (${hours}h). Te escribiré si pasa ese tiempo sin que digas nada.`);
}
