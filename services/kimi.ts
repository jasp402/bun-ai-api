import OpenAI from 'openai';
import type { AIService, ChatMessage } from '../types';

export const kimiFactory = {
    isEnabled: () => !!process.env.MOONSHOT_API_KEY,
    create: (): AIService => {
        const openai = new OpenAI({
            apiKey: process.env.MOONSHOT_API_KEY,
            baseURL: 'https://api.moonshot.cn/v1',
        });

        const service: AIService = {
            name: 'Kimi',
            model: 'moonshot-v1-8k',
            metrics: {},

            async validate() {
                try {
                    await openai.models.list();
                    return true;
                } catch {
                    return false;
                }
            },

            async chat(messages: ChatMessage[]) {
                const stream = await openai.chat.completions.create({
                    model: this.model,
                    messages: messages.map(m => ({
                        role: m.role as 'system' | 'user' | 'assistant',
                        content: m.content
                    })),
                    stream: true,
                });

                return (async function* () {
                    for await (const chunk of stream) {
                        yield chunk.choices[0]?.delta?.content || '';
                    }
                })();
            }
        };
        return service;
    }
}
