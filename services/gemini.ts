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
            metrics: {}, // Google headers are non-standard/complex via Client

            async validate() {
                try {
                    // Use a minimal generation to valid key and model access
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
                const history = messages.slice(0, -1).map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                }));

                const lastMessage = messages[messages.length - 1].content;

                const chat = model.startChat({
                    history: history as any,
                });

                const result = await chat.sendMessageStream(lastMessage);

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
