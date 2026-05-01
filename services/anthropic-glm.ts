import type { AIService, ChatMessage } from '../types';

export const anthropicGlmFactory = {
    isEnabled: () => !!process.env.ANTHROPIC_GLM_API_KEY,
    create: (): AIService => {
        const service: AIService = {
            name: 'Anthropic-GLM',
            model: 'claude-sonnet-4-20250514', // Mapea a GLM-4.6 internamente en Z.AI
            supportsVision: false,
            metrics: {},

            async validate() {
                // Simple validation ping using a lightweight call or checking if we can auth
                // Z.AI might not have a dedicated 'validate' endpoint compatible with Anthropic.
                // We'll trust the flow or try a minimal call.
                return true; // Optimistic for now as we use raw fetch
            },

            async chat(messages: ChatMessage[]) {
                const apiKey = process.env.ANTHROPIC_GLM_API_KEY;

                const anthropicMessages = messages.map(m => ({
                    role: m.role === 'system' ? 'user' : m.role,
                    content: typeof m.content === 'string' ? m.content : m.content.map(p => p.type === 'text' ? p.text : '').join('\n')
                })).filter(m => (m.role as string) !== 'system');

                const systemMessage = messages.find(m => m.role === 'system');

                const body: any = {
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 4096,
                    messages: anthropicMessages
                };

                if (systemMessage) {
                    body.system = typeof systemMessage.content === 'string' ? systemMessage.content : systemMessage.content.map(p => p.type === 'text' ? p.text : '').join('\n');
                }

                const response = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey!,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify(body)
                });

                // Capture headers
                this.metrics = {
                    remainingRequests: response.headers.get('x-ratelimit-remaining-requests') ? parseInt(response.headers.get('x-ratelimit-remaining-requests')!) : undefined,
                    remainingTokens: response.headers.get('x-ratelimit-remaining-tokens') ? parseInt(response.headers.get('x-ratelimit-remaining-tokens')!) : undefined,
                    resetTime: Date.now()
                };

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Z.AI Error: ${response.status} - ${error}`);
                }

                const data = await response.json() as any;
                const textResponse = data.content?.[0]?.text || '';

                return (async function* () {
                    yield textResponse;
                })()
            }
        };
        return service;
    }
}
