import type { ChatMessage, McpToolDefinition } from '../types';
import { mcpService } from './mcpClient';
import { projectManager } from './projectManager';

/**
 * Agente Universal basado en ReAct (Reasoning and Acting)
 * Convierte un modelo de texto genérico en un Agente capaz de usar MCP devolviendo etiquetas XML.
 */
export const agentService = {

    injectToolsToPrompt: (systemPrompt: ChatMessage): ChatMessage => {
        const registry = mcpService.getAllTools();

        let toolsInstruction = `\n\n=== HERRAMIENTAS DISPONIBLES ===\nTienes acceso a las siguientes herramientas mediante el sistema Model Context Protocol (MCP).\n`;

        // ... (rest of the tools logic remains same but we must ensure we don't break the string if content is array)
        // Since system prompt is usually string, we handle it.
        const baseContent = typeof systemPrompt.content === 'string' ? systemPrompt.content : "";

        // 1. Herramientas de Automatización Físisica (Internas)
        toolsInstruction += `
Herramienta: ahk_run
Servidor: automation
Descripción: Ejecuta código AutoHotkey v2 para controlar el ratón, teclado y ventanas.
Parámetros (JSON Schema): {"type":"object","properties":{"code":{"type":"string","description":"Código AHK v2 (ej: MsgBox('Bot'), Click(500,500), SendText('Hola'))"}},"required":["code"]}

Herramienta: screenshot
Servidor: automation
Descripción: Captura la pantalla actual del PC del usuario para que puedas ver el estado visual.
Parámetros (JSON Schema): {"type":"object","properties":{}}
`;

        for (const { serverName, tool } of registry) {
            toolsInstruction += `\nHerramienta: ${tool.name}\n`;
            toolsInstruction += `Servidor: ${serverName}\n`;
            toolsInstruction += `Descripción: ${tool.description || 'Sin descripción'}\n`;
            toolsInstruction += `Parámetros (JSON Schema): ${JSON.stringify(tool.inputSchema)}\n`;
            toolsInstruction += `\n`;
        }

        toolsInstruction += `
INSTRUCCIONES DE ESTILO(¡MODO PREMIUM!):
        1. JERARQUIA VISUAL: Usa sintaxis Markdown estándar:
   - **Negrita** para encabezados.
   - \`Código\` para rutas o variables.
   - \`\`\`
     Bloques de código
     \`\`\`
   - Usa emojis y separadores (───────────────).
2. IDIOMA: Responde SIEMPRE en Español (REGLA #1).
3. TOOL CALLING: Usa EXCLUSIVAMENTE el formato XML:

<mcp_tool_call>
  <server>nombre_del_servidor</server>
  <tool>nombre_de_la_herramienta</tool>
  <args>{"param1": "valor1"}</args>
</mcp_tool_call>

REGLAS CRITICAS:
- NO intentes escribir etiquetas HTML (<b>, <i>). Usa el Markdown indicado arriba.
- El contenido de <args> debe ser JSON valido.
- Tras recibir el resultado, genera tu respuesta humana FINAL elegante.
=== FIN DE HERRAMIENTAS ===\n`;

        return {
            role: 'system',
            content: baseContent + toolsInstruction + projectManager.getActiveProjectContext()
        };
    },

    // Busca etiquetas XML <mcp_tool_call> en la respuesta
    parseToolCalls: (responseContent: string) => {
        const toolCallRegex = /<mcp_tool_call>([\s\S]*?)<\/mcp_tool_call>/g;
        const matches = [...responseContent.matchAll(toolCallRegex)];

        if (matches.length === 0) return null;

        const calls = [];
        for (const match of matches) {
            const block = match[1];
            if (!block) continue;

            const serverMatch = block.match(/<server>([\s\S]*?)<\/server>/);
            const toolMatch = block.match(/<tool>([\s\S]*?)<\/tool>/);
            const argsMatch = block.match(/<args>([\s\S]*?)<\/args>/);

            if (serverMatch?.[1] && toolMatch?.[1] && argsMatch?.[1]) {
                try {
                    // El modelo puede añadir saltos de linea o markdown al JSON
                    const rawArgs = argsMatch[1].replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
                    calls.push({
                        server: serverMatch[1].trim(),
                        tool: toolMatch[1].trim(),
                        args: JSON.parse(rawArgs)
                    });
                } catch (e) {
                    console.error("[Agent Parser] Error parseando argumentos de tool_call:", argsMatch[1]);
                }
            }
        }
        return calls.length > 0 ? calls : null;
    },

    formatToolResult: (toolCallName: string, output: any, isError: boolean = false): ChatMessage => {
        let contentString = "";

        if (output && output.content && Array.isArray(output.content)) {
            contentString = output.content.map((c: any) => c.text).join("\n");
        } else {
            contentString = typeof output === 'object' ? JSON.stringify(output) : String(output);
        }

        return {
            role: 'system',
            content: `<mcp_tool_result name="${toolCallName}" error="${isError}">\n${contentString}\n</mcp_tool_result>\n\nBasado en este resultado, genera tu respuesta final al usuario.`
        };
    },

    // Limpia cualquier etiqueta XML que el modelo haya podido escupir sobre las herramientas
    // para que el usuario no vea el "pensamiento interno"
    cleanFinalResponse: (text: string): string => {
        return text.replace(/<mcp_tool_call>[\s\S]*?<\/mcp_tool_call>/g, '').trim();
    },

    /**
     * Sanitiza el texto para Telegram HTML.
     * Convierte el Markdown del modelo en HTML válido y seguro.
     */
    escapeHTML: (text: string): string => {
        if (!text) return "";

        // 1. Limpiar cualquier etiqueta HTML que el modelo haya intentado poner (evita errores de cierre)
        let clean = text.replace(/<(?!\/?(mcp_tool_call|server|tool|args|mcp_tool_result))[\s\S]*?>/g, '');

        // 2. Escapar caracteres especiales de HTML
        let escaped = clean
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 3. Convertir Markdown a HTML
        return escaped
            // Bloques de código (Triple backtick)
            .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
            // Negrita (**texto**)
            .replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>')
            // Negrita (__texto__)
            .replace(/__([\s\S]*?)__/g, '<b>$1</b>')
            // Código en línea (`texto`)
            .replace(/`([^`\n]+)`/g, '<code>$1</code>')
            // Itálica (_texto_)
            .replace(/(?<!\w)_(.*?)_(?!\w)/g, '<i>$1</i>')
            // Limpiar escapes de guion bajo innecesarios
            .replace(/\\_/g, '_');
    }
};
