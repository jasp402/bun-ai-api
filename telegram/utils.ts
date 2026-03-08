export const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_API_KEY}`;

export async function sendMessage(chatId: number, text: string) {
    try {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML'
            })
        });
    } catch (err) {
        console.error("Error sending message:", err);
    }
}

export async function sendChatAction(chatId: number, action: 'typing' | 'upload_photo' | 'record_video' = 'typing') {
    try {
        await fetch(`${TELEGRAM_API}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, action })
        });
    } catch (err) {
        console.error("Error sending chat action:", err);
    }
}
