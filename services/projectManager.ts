import { spawn, type Subprocess } from "bun";
import { dbService } from "./db";
import type { ProjectRecord, ProcessRecord } from "../types";

/**
 * Project Manager Service
 * Gestiona múltiples proyectos y sus procesos en segundo plano (dev servers, agentes IA, túneles).
 */

// Mapa en memoria de procesos activos (PID -> Subprocess de Bun)
const activeSubprocesses = new Map<string, Subprocess>();

export const projectManager = {

    /**
     * Inicializa el Project Manager: limpia procesos obsoletos del último reinicio.
     */
    init: () => {
        dbService.cleanStaleProcesses();
        console.log("[ProjectManager] Procesos obsoletos limpiados.");
    },

    // =============== GESTIÓN DE PROYECTOS ===============

    listProjects: (): any[] => {
        return dbService.getProjects();
    },

    addProject: (name: string, path: string, stack: string = '', devCommand: string = '', agentCommand: string = '') => {
        dbService.addProject(name, path, stack, devCommand, agentCommand);
        console.log(`[ProjectManager] Proyecto "${name}" registrado.`);
    },

    switchProject: (name: string): boolean => {
        const success = dbService.setActiveProject(name);
        if (success) {
            console.log(`[ProjectManager] Proyecto activo cambiado a: "${name}"`);
        }
        return success;
    },

    getActiveProject: (): ProjectRecord | null => {
        return dbService.getActiveProject();
    },

    removeProject: (name: string): boolean => {
        return dbService.deleteProject(name);
    },

    // =============== GESTIÓN DE PROCESOS ===============

    /**
     * Ejecuta un comando como proceso en segundo plano asociado a un proyecto.
     */
    startProcess: async (projectId: string, type: string, command: string, cwd: string, port: number | null = null): Promise<{ processId: string; pid: number | null }> => {
        // Separar commando en partes
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        console.log(`[ProjectManager] Iniciando proceso: "${command}" en ${cwd}`);

        try {
            const proc = spawn([cmd!, ...args], {
                cwd: cwd,
                stdout: "pipe",
                stderr: "pipe",
            });

            const pid = proc.pid;
            const processId = dbService.addProcess(projectId, type, command, pid, port);

            // Guardar referencia al subprocess en memoria
            activeSubprocesses.set(processId, proc);

            // Leer output de forma asíncrona en un buffer circular
            projectManager._readOutputStream(processId, proc);

            // Actualizar estado del proyecto
            if (type === 'dev_server') {
                dbService.updateProjectStatus(projectId, 'running');
            }

            console.log(`[ProjectManager] Proceso iniciado (PID: ${pid}, ID: ${processId})`);
            return { processId, pid };
        } catch (error: any) {
            console.error(`[ProjectManager] Error iniciando proceso:`, error.message);
            throw error;
        }
    },

    /**
     * Lee el output de un proceso y lo guarda en un buffer circular en la DB.
     */
    _readOutputStream: async (processId: string, proc: Subprocess) => {
        const MAX_OUTPUT_LENGTH = 2000; // Últimas ~2000 chars

        const readStream = async (stream: ReadableStream<Uint8Array> | null, label: string) => {
            if (!stream) return;
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    const text = decoder.decode(value);
                    // Actualizar buffer circular
                    try {
                        const current = dbService.getProcessesByProject('').find((p: any) => p.id === processId);
                        let output = (current?.last_output || '') + text;
                        if (output.length > MAX_OUTPUT_LENGTH) {
                            output = output.slice(-MAX_OUTPUT_LENGTH);
                        }
                        dbService.updateProcess(processId, { last_output: output });
                    } catch (e) { /* DB write error, ignore */ }
                }
            } catch (e) { /* Stream ended */ }
        };

        readStream(proc.stdout as ReadableStream<Uint8Array>, 'stdout');
        readStream(proc.stderr as ReadableStream<Uint8Array>, 'stderr');

        // Cuando el proceso termine, actualizar estado
        try {
            await proc.exited;
            dbService.updateProcess(processId, { status: 'stopped' });
            activeSubprocesses.delete(processId);
            console.log(`[ProjectManager] Proceso ${processId} terminó.`);
        } catch (e) { /* process already gone */ }
    },

    /**
     * Detiene un proceso por su ID.
     */
    stopProcess: (processId: string): boolean => {
        const proc = activeSubprocesses.get(processId);
        if (proc) {
            try {
                proc.kill();
                activeSubprocesses.delete(processId);
                dbService.updateProcess(processId, { status: 'stopped' });
                console.log(`[ProjectManager] Proceso ${processId} detenido.`);
                return true;
            } catch (e) {
                console.error(`[ProjectManager] Error deteniendo proceso:`, e);
                return false;
            }
        }
        // Si no está en memoria pero sí en DB, marcarlo como detenido
        dbService.updateProcess(processId, { status: 'stopped' });
        return true;
    },

    /**
     * Detiene todos los procesos de un proyecto.
     */
    stopProjectProcesses: (projectId: string) => {
        const processes = dbService.getProcessesByProject(projectId);
        for (const proc of processes) {
            if (proc.status === 'running') {
                projectManager.stopProcess(proc.id);
            }
        }
        dbService.updateProjectStatus(projectId, 'idle');
    },

    /**
     * Obtiene el estado de todos los procesos en ejecución.
     */
    getStatus: (): any[] => {
        return dbService.getRunningProcesses();
    },

    /**
     * Genera el contexto del proyecto activo para inyectar al system prompt del agente.
     */
    getActiveProjectContext: (): string => {
        const project = dbService.getActiveProject();
        if (!project) return "";

        const processes = dbService.getProcessesByProject(project.id);
        const runningProcesses = processes.filter((p: any) => p.status === 'running');

        let context = `\n\n=== PROYECTO ACTIVO ===\n`;
        context += `Nombre: ${project.name}\n`;
        context += `Ruta: ${project.path}\n`;
        context += `Stack: ${project.stack || 'No especificado'}\n`;
        context += `Estado: ${project.status}\n`;

        if (runningProcesses.length > 0) {
            context += `\nProcesos en ejecución:\n`;
            for (const proc of runningProcesses) {
                context += `- [${proc.type}] ${proc.command} (PID: ${proc.pid}, Puerto: ${proc.port || 'N/A'})\n`;
            }
        }

        context += `=== FIN PROYECTO ===\n`;
        return context;
    }
};
