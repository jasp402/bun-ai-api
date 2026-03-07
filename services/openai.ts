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
                // Use .asResponse() to access headers for Rate Limits
                const response = await openai.chat.completions.create({
                    model: this.model,
                    messages: messages.map(m => ({ role: m.role as any, content: m.content })),
                    stream: true,
                }).asResponse();

                // Capture Rate Limit Headers
                const headers = response.headers;
                this.metrics = {
                    remainingRequests: headers.get('x-ratelimit-remaining-requests') ? parseInt(headers.get('x-ratelimit-remaining-requests')!) : undefined,
                    remainingTokens: headers.get('x-ratelimit-remaining-tokens') ? parseInt(headers.get('x-ratelimit-remaining-tokens')!) : undefined,
                    resetTime: Date.now() // Simple timestamp of last update
                };

                const stream = response.toReadableStream();
                // Convert web stream to async iterable for our interface if needed, 
                // OR simpler: re-use the body property which is the AsyncIterable in Node (usually)
                // usage: for await (const chunk of response.body) ... but .asResponse() returns core fetch Response helper.
                // The object returned by asResponse helper from OpenAI is a custom wrapper.
                // Actually, for stream:true, response is Stream<ChatCompletionChunk>.
                // Wait, .asResponse() returns the raw Response. 
                // We need to consume the body. 

                // Let's rely on standard OpenAI stream pattern handling from the raw response body
                // But for safety and types compatibility with my interface:
                // Using standard iterator on the body helper provided by SDK or handling the stream manually.

                // Simpler approach compatible with SDK:
                // Don't use .asResponse() for the body, use it just for headers? No, you consume the response once.
                // Use the native SDK stream iterator from the response body.

                return (async function* () {
                    // @ts-ignore - OpenAI SDK types might be complex here, but body is iterable
                    for await (const chunk of response.body as any) {
                        const content = JSON.parse(new TextDecoder().decode(chunk)).choices?.[0]?.delta?.content;
                        // Raw block reading might be tricky with SSE.
                        // BETTER APPROACH: Use the standard call for stream, but separate call for header check? 
                        // No, headers come with response.

                        // Let's stick to the reliable way: 
                        // We cannot easily get headers AND the nice Stream object without manual parsing if we use .asResponse().
                    }
                })() as any; // Allow me to fix implementation below in a cleaner way without AsyncGenerator gymnastics
            }
        };

        // Correct Implementation of Chat with Headers Capture
        service.chat = async function (messages: ChatMessage[]) {
            const rawResponse = await openai.chat.completions.create({
                model: service.model,
                messages: messages.map(m => ({ role: m.role as any, content: m.content })),
                stream: true,
            }).asResponse();

            // Update Metrics
            const headers = rawResponse.headers;
            service.metrics = {
                remainingRequests: headers.get('x-ratelimit-remaining-requests') ? parseInt(headers.get('x-ratelimit-remaining-requests') || '0') : undefined,
                remainingTokens: headers.get('x-ratelimit-remaining-tokens') ? parseInt(headers.get('x-ratelimit-remaining-tokens') || '0') : undefined,
                resetTime: Date.now()
            };

            // We need to parse the SSE stream manually since we took over the response
            // This is complex. 
            // ALTERNATIVE: OpenAI SDK stores the last response headers in the client? No.

            // RE-DESIGN:
            // Use standard stream. Some SDKs expose headers on the stream object (hidden props).
            // Let's try to see if 'grok' or 'openai' stream object has them.
            // Actually, just doing a light separate call or assuming standard behavior is risky.

            // Let's use the Stream.fromSSEResponse utility if available, or just parse manually.
            // OpenAI sdk exports `Stream`.

            const stream = OpenAI.Chat.Completions.ChatCompletionStream.fromReadableStream(rawResponse.body as any);

            return (async function* () {
                for await (const chunk of stream) {
                    yield chunk.choices[0]?.delta?.content || '';
                }
            })();
        };

        return service;
    }
}
