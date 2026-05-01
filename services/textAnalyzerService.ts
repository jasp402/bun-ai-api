/**
 * textAnalyzerService.ts
 * Módulo especializado en procesar, limpiar y extraer la respuesta útil
 * de las crudas y sucias salidas de terminal de las IAs (Gemini, Claude, etc).
 */

export const textAnalyzerService = {
    /**
     * Limpia un bloque de texto crudo de la terminal, quitando basuras, ANSI y caracteres raros.
     * Mantiene saltos de línea y estructura.
     */
    cleanTerminalGarbage: (rawText: string): string => {
        let cleaned = rawText;

        // 1. Quitar Códigos ANSI (Colores/Movimientos de cursor)
        cleaned = cleaned.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

        // 2. Quitar caracteres de dibujo de cajas y bloques gruesos (Box Drawing)
        cleaned = cleaned.replace(/[█▄▀▐▌░▒▓╭─╮╰╯│]+/g, '');

        // 3. Quitar caracteres de reemplazo Unicode corruptos
        cleaned = cleaned.replace(/\ufffd/g, '');

        // 4. Limpiar Múltiples saltos de línea excesivos (más de 3)
        cleaned = cleaned.replace(/\n{4,}/g, '\n\n');

        return cleaned;
    },

    /**
     * Extrae inteligentemente LA ÚLTIMA respuesta de la IA basándose en el prompt del usuario.
     * Soluciona el problema de que el texto de entrada puede haber side ligeramente
     * modificado o ensuciado por el CLI de la IA antes de ser impreso.
     */
    extractLatestResponse: (fullScreenText: string, userPrompt: string): string => {
        // Primero limpiamos TODO el texto para que la búsqueda sea sobre texto plano, sin ANSIs
        const cleanScreen = textAnalyzerService.cleanTerminalGarbage(fullScreenText);
        const cleanPrompt = userPrompt.trim();

        // Estrategia 1: Búsqueda exacta Literal
        let promptIdx = cleanScreen.lastIndexOf(cleanPrompt);

        if (promptIdx !== -1) {
            return cleanScreen.substring(promptIdx + cleanPrompt.length).trim();
        }

        // Estrategia 2: Búsqueda parcial (A veces el CLI corta prompts largos o les quita saltos de línea)
        // Tomamos solo los primeros 20 caracteres del prompt del usuario para buscar el inicio de su bloque
        const shortPrompt = cleanPrompt.substring(0, 20);
        promptIdx = cleanScreen.lastIndexOf(shortPrompt);

        if (promptIdx !== -1) {
            // Tratamos de buscar el final natural de esa línea del prompt
            const endOfPromptLine = cleanScreen.indexOf('\n', promptIdx);
            if (endOfPromptLine !== -1) {
                return cleanScreen.substring(endOfPromptLine).trim();
            } else {
                return cleanScreen.substring(promptIdx + shortPrompt.length).trim();
            }
        }

        // Estrategia 3: Fallback. Si no encontramos nada del prompt, asumimos que el texto limpiado 
        // ya no contiene la pregunta vieja (porque hizo scroll o se sobrescribió)
        // y devolvemos la última gran mitad visual del terminal.
        let finalOutput = cleanScreen;
        if (promptIdx !== -1) {
            finalOutput = cleanScreen.substring(promptIdx); // Ya se recortó limpio en Extr 1/2
        } else {
            console.warn(`[TextAnalyzer] No se encontró el prompt exacto ni parcial en la pantalla. Retornando últimos 4000 caracteres.`);
            if (cleanScreen.length > 4000) {
                finalOutput = cleanScreen.substring(cleanScreen.length - 4000);
            }
        }

        // LIMPIEZA FINAL: Remover el Footer interactivo del CLI de Gemini ("? for shortcuts", "shift+tab", etc)
        // Buscamos indicadores tempranos del panel de abajo y serruchamos todo lo de abajo.
        const footerCutoffs = [
            "? for shortcuts",
            "shift+tab to accept edits",
            "Type your message or @path/to/file",
            "1 GEMINI.md file |",
            "/model Auto (Gemini",
        ];

        let lowestCutoffIndex = finalOutput.length;
        for (const cutoff of footerCutoffs) {
            const idx = finalOutput.lastIndexOf(cutoff);
            if (idx !== -1 && idx < lowestCutoffIndex) {
                lowestCutoffIndex = idx;
            }
        }

        // Si encontró alguna marca del footer, corta exactamente antes de que empiece la línea.
        if (lowestCutoffIndex < finalOutput.length) {
            // Buscamos el inicio de esa línea corrupta (el último \n antes de la marca)
            const priorNewline = finalOutput.lastIndexOf('\n', lowestCutoffIndex);
            if (priorNewline !== -1) {
                finalOutput = finalOutput.substring(0, priorNewline);
            } else {
                finalOutput = finalOutput.substring(0, lowestCutoffIndex);
            }
        }

        // Limpieza extra post-corte (remover diamantes generados por mala codificación de guiones)
        finalOutput = finalOutput.replace(/\ufffd/g, '');

        return finalOutput.trim();
    },

    /**
     * Formatea el texto limpio para Telegram, convirtiendo bloques de código de terminal 
     * en etiquetas legibles (ej: pre tags o code tags de HTML).
     * En Telegram usaremos parse_mode: 'HTML'.
     */
    formatForTelegram: (text: string): string => {
        let formatted = text;

        // Por ahora, Telegram HTML API es muy sensible. Lo más seguro es escapar < y > básicos.
        formatted = formatted.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Convertir Markdown crudo (ej: `codigo`) a <code>codigo</code>
        // Match básico de single backticks
        formatted = formatted.replace(/`([^`\n]+)`/g, '<code>$1</code>');

        // Convertir Negritas **texto** a <b>texto</b>
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

        return formatted;
    }
};
