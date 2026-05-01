import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIService, ChatMessage } from '../types';

export const geminiFactory = {
    isEnabled: () => !!process.env.GEMINI_API_KEY,
    create: (): AIService => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        // Using gemini-flash-latest - stable alias.
        // 1.5-flash -> 404.
        // 2.0-flash-* -> 429 quota 0.
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        return {
            name: 'Gemini',
            model: 'gemini-flash-latest',
            supportsVision: true,
            metrics: {},

            async validate() {
                try {
                    await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
                        generationConfig: { maxOutputTokens: 1 }
                    });
                    return true;
                } catch (e: any) {
                    console.error("Gemini Validation Failed:", e.message);
                    return false;
                }
            },

            async chat(messages: ChatMessage[]) {
                const history = messages.slice(0, -1).map(m => {
                    if (typeof m.content === 'string') {
                        return {
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: m.content }],
                        };
                    } else {
                        return {
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: m.content.map(part => {
                                if (part.type === 'text') return { text: part.text };
                                if (part.type === 'image_url') {
                                    // Nota: Gemini SDK puede manejar buffers o URLs. 
                                    // Para URLs externas, a veces hay que descargarlas primero.
                                    // Pero por ahora asumimos que el modelo puede manejar la URL si se pasa correctamente.
                                    // Ojo: GoogleGenerativeAI espera inlineData para imágenes locales.
                                    // Si es una URL, lo ideal sería descargarla o usar fileData.
                                    // Como parche rápido, si es URL la ignoramos o la tratamos como texto si no implementamos descarga.
                                    // MEJOR: Implementar una descarga básica si detectamos image_url.
                                    return { text: `[Imagen: ${part.image_url?.url}]` };
                                }
                                return { text: '' };
                            })
                        };
                    }
                });

                const lastMessage = messages[messages.length - 1].content;
                let parts: any[] = [];
                if (typeof lastMessage === 'string') {
                    parts = [{ text: lastMessage }];
                } else {
                    for (const part of lastMessage) {
                        if (part.type === 'text') parts.push({ text: part.text });
                        if (part.type === 'image_url' && part.image_url) {
                            try {
                                const response = await fetch(part.image_url.url);
                                const buffer = await response.arrayBuffer();
                                const base64 = Buffer.from(buffer).toString('base64');
                                const mimeType = response.headers.get('content-type') || 'image/jpeg';
                                parts.push({
                                    inlineData: {
                                        data: base64,
                                        mimeType
                                    }
                                });
                            } catch (e) {
                                console.error("Error downloading image for Gemini:", e);
                                parts.push({ text: `[Error cargando imagen: ${part.image_url.url}]` });
                            }
                        }
                    }
                }

                const chat = model.startChat({
                    history: history as any,
                });

                const result = await chat.sendMessageStream(parts);

                return (async function* () {
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) yield text;
                    }
                })();
            }
        }
    }
}
