export const COMMAND_DOCS: Record<string, { desc: string, params: string, examples: string[] }> = {
    "projects": {
        "desc": "Muestra una lista de todos los proyectos registrados en el sistema y cuál está activo actualmente.",
        "params": "Ninguno",
        "examples": ["/projects"]
    },
    "addproject": {
        "desc": "Registra un nuevo proyecto. Si solo pasas la ruta, intentará autodetectar el stack. También puedes pasar los datos separados por '|'.",
        "params": "ruta_absoluta O nombre|ruta|stack|comando_dev|comando_agente",
        "examples": ["/addproject C:\\proyectos\\mi-web", "/addproject mi-web|C:\\web|nextjs|npm run dev|npx @google/gemini-cli"]
    },
    "rmproject": {
        "desc": "Elimina un proyecto de la base de datos por su nombre.",
        "params": "nombre_del_proyecto",
        "examples": ["/rmproject mi-app"]
    },
    "switch": {
        "desc": "Cambia el foco del bot a un proyecto específico para ejecutar logs o comandos sobre él.",
        "params": "nombre_del_proyecto",
        "examples": ["/switch mi-app"]
    },
    "run": {
        "desc": "Inicia el servidor de desarrollo del proyecto activo en una ventana visible de Windows (usando AutoHotkey).",
        "params": "comando (opcional, usa el guardado por defecto si no se pasa)",
        "examples": ["/run", "/run npm run start"]
    },
    "runbg": {
        "desc": "Inicia el servidor de desarrollo en segundo plano (sin ventana visible). Útil para producción o servidores silenciosos.",
        "params": "Ninguno",
        "examples": ["/runbg"]
    },
    "status": {
        "desc": "Muestra el estado de salud del sistema y una lista de todos los procesos (servidores, agentes, túneles) que están corriendo actualmente.",
        "params": "Ninguno",
        "examples": ["/status"]
    },
    "logs": {
        "desc": "Muestra las últimas líneas de salida (logs) del proyecto que está activo actualmente.",
        "params": "Ninguno",
        "examples": ["/logs"]
    },
    "stop": {
        "desc": "Detiene todos los procesos relacionados con el proyecto activo actualmente.",
        "params": "Ninguno",
        "examples": ["/stop"]
    },
    "stopall": {
        "desc": "Comando de pánico. Mata absolutamente todos los procesos que el bot haya iniciado en el sistema.",
        "params": "Ninguno",
        "examples": ["/stopall"]
    },
    "gemini": {
        "desc": "Invoca directamente al modelo Gemini de Google para una consulta rápida o ejecución de tarea.",
        "params": "mensaje o tarea",
        "examples": ["/gemini crea un script de python para leer un csv"]
    },
    "claude": {
        "desc": "Invoca a Claude Code para tareas de programación avanzada o revisión de archivos.",
        "params": "mensaje o tarea",
        "examples": ["/claude refactoriza este componente React"]
    },
    "codex": {
        "desc": "Invoca directamente al modelo Codex para tareas de programación o ejecución de tarea.",
        "params": "mensaje o tarea",
        "examples": ["/codex crea una API con Bun y Hono"]
    },
    "agent": {
        "desc": "Inicia el agente de IA específico configurado para el proyecto activo.",
        "params": "comando (opcional)",
        "examples": ["/agent", "/agent gemini-cli"]
    },
    "busy": {
        "desc": "Marca al usuario como ocupado. El agente no te enviará saludos proactivos ni recordatorios hasta que se cumpla el tiempo o uses /free.",
        "params": "tiempo (ej: un rato, mañana, 5h, fecha ISO)",
        "examples": ["/busy un rato", "/busy mañana", "/busy 2026-12-31"]
    },
    "free": {
        "desc": "Quita el estado de ocupado inmediatamente.",
        "params": "Ninguno",
        "examples": ["/free"]
    },
    "nudge": {
        "desc": "Configura la intensidad y el tiempo de espera para que el agente te escriba si no hay actividad.",
        "params": "intensidad (intenso, relajado, despreocupado, olvidadizo) O horas (ej: 6)",
        "examples": ["/nudge intenso", "/nudge relajado", "/nudge 24"]
    },
    "quiet": {
        "desc": "Define un rango de horas en las que el bot tiene prohibido escribirte (Horas de silencio).",
        "params": "HH:mm HH:mm",
        "examples": ["/quiet 22:00 09:00"]
    },
    "pc": {
        "desc": "Ejecuta código AutoHotkey v2 directamente en el PC del servidor. Permite automatizar cualquier tarea de Windows.",
        "params": "código AHK o descripción de acción",
        "examples": ["/pc SendEvent '#d'", "/pc sube el volumen al máximo"]
    },
    "screen": {
        "desc": "Toma una captura de pantalla completa del servidor y la envía al chat.",
        "params": "Ninguno",
        "examples": ["/screen"]
    },
    "shell": {
        "desc": "Ejecuta un comando nativo en la PowerShell del servidor Windows.",
        "params": "comando powershell",
        "examples": ["/shell Get-Process", "/shell dir"]
    }
};
