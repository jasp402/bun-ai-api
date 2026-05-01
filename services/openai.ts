import OpenAI from 'openai';
import type { AIService, ChatMessage, ServiceMetrics } from '../types';

export const openaiFactory = {
    isEnabled: () => !!process.env.OPENAI_API_KEY,
    create: (): AIService => {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const service: AIService = {
            name: 'OpenAI',
            model: 'gpt-4o-mini',
            supportsVision: true,
            metrics: {},

            async validate() {
                try {
                    await openai.models.list();
                    return true;
                } catch (e) {
                    console.error("OpenAI Validation Error:", e);
                    return false;
                }
            },

            async chat(messages: ChatMessage[]) {
                const formattedMessages = messages.map(m => {
                    if (typeof m.content === 'string') {
                        return { role: m.role as any, content: m.content };
                    } else {
                        return {
                            role: m.role as any,
                            content: m.content.map(part => {
                                if (part.type === 'text') return { type: 'text', text: part.text };
                                if (part.type === 'image_url') return { type: 'image_url', image_url: part.image_url };
                                return { type: 'text', text: '' };
                            })
                        };
                    }
                });

                const stream = await openai.chat.completions.create({
                    model: this.model,
                    messages: formattedMessages as any,
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
