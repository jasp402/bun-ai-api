import { spawn, type Subprocess } from "bun";
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
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
     * Envía texto al stdin de un proceso activo.
     */
    async sendInputToProcess(processId: string, input: string): Promise<boolean> {
        const proc = activeSubprocesses.get(processId);
        // En Bun, proc.stdin es un FileSink (o number si se redirige) si stdin es 'pipe'
        if (proc && proc.stdin) {
            try {
                (proc.stdin as any).write(input + "\n");
                (proc.stdin as any).flush();
                console.log(`[ProjectManager] Input enviado a proceso ${processId}: ${input}`);
                return true;
            } catch (e) {
                console.error(`[ProjectManager] Error enviando input a ${processId}:`, e);
                return false;
            }
        }
        return false;
    },

    /**
     * Inicializa el Project Manager: limpia procesos obsoletos del último reinicio.
     */
    init() {
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

    toggleMirrorMode: (projectId: string): boolean => {
        const project = dbService.getProjects().find(p => p.id === projectId);
        if (!project) return false;
        const newState = !project.mirror_mode;
        dbService.setMirrorMode(projectId, newState);
        return newState;
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
    async startProcess(projectId: string, type: string, command: string, cwd: string, port: number | null = null, visible: boolean = false, god: string = 'AGENT'): Promise<{ processId: string; pid: number | null }> {
        if (!existsSync(cwd)) {
            console.error(`[ProjectManager] Directory does not exist: ${cwd}`);
            throw new Error(`Directory does not exist: ${cwd}`);
        }

        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        let finalCmd = cmd;
        let finalArgs = args;

        // Soporte para Windows: Usar PowerShell con ruta absoluta para evitar problemas de PATH (uv_spawn ENOENT)
        if (process.platform === "win32") {
            finalCmd = "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

            // Obtener info del proyecto para mirror_mode
            const project = dbService.getProjects().find(p => p.id === projectId);
            const commandWithEnv = port ? `$env:PORT=${port}; ${command}` : command;
            const normalizedCwd = cwd.replace(/\\/g, '/');
            const isMirror = (type !== 'agent') && project?.mirror_mode;

            if (visible && type !== 'agent') {
                // Modo Visible Estándar (para /run normal)
                let action = commandWithEnv;
                if (isMirror) {
                    action += ` | Tee-Object -FilePath '.bot.log' -Append`;
                }
                const safeAction = action.replace(/'/g, "''");
                finalArgs = [
                    "-Command",
                    `Start-Process powershell -WorkingDirectory "${cwd}" -ArgumentList "-NoExit","-Command","& { ${safeAction} }"`
                ];
            } else if (type === 'agent') {
                const winTitle = `AGENT-${god.toUpperCase()}-${projectId.substring(0, 8)}`;

                if (visible) {
                    const hostTitle = `$Host.UI.RawUI.WindowTitle = '${winTitle}'`;
                    const innerCmd = `& { ${hostTitle}; cd '${normalizedCwd}'; ${commandWithEnv} }`;
                    const escapedInnerCmd = innerCmd.replace(/'/g, "''");
                    const launchCmd = `powershell -Command "(Start-Process powershell -ArgumentList '-NoExit','-Command','${escapedInnerCmd}' -PassThru).Id"`;

                    try {
                        const { execSync } = require("node:child_process");
                        const stdout = execSync(launchCmd, { cwd }).toString();
                        const capturedPid = parseInt(stdout.trim());
                        console.log(`[ProjectManager] Agente lanzado con PID capturado: ${capturedPid}`);
                        const processId = dbService.addProcess(projectId, type, command, capturedPid, port);
                        console.log(`[ProjectManager] Proceso registrado en DB satisfactoriamente con ID: ${processId}`);
                        return { processId, pid: capturedPid };
                    } catch (e: any) {
                        const processId = dbService.addProcess(projectId, type, command, 0, port);
                        return { processId, pid: 0 };
                    }
                } else {
                    finalArgs = ["-Command", `& { cd "${normalizedCwd}"; ${commandWithEnv} }`];
                }
            } else {
                // Ejecución en SEGUNDO PLANO (Background estándar)
                finalArgs = ["-Command", `& { cd "${normalizedCwd}"; ${commandWithEnv} }`];
            }
        }

        console.log(`[ProjectManager] Spawning process: ${finalCmd} ${finalArgs.join(' ')}`);

        try {
            const proc = spawn([finalCmd!, ...finalArgs], {
                cwd: cwd,
                stdout: "pipe",
                stderr: "pipe",
                stdin: "pipe", // Habilitar STDIN siempre para control remoto
            });

            const pid = proc.pid;
            const processId = dbService.addProcess(projectId, type, command, pid, port);

            // Guardar referencia al subprocess en memoria
            activeSubprocesses.set(processId, proc);

            // Leer output de forma asíncrona
            this._readOutputStream(processId, proc, type === 'agent');

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
     * Lee la salida de un proceso y la guarda en la base de datos y opcionalmente en archivos de log.
     */
    async _readOutputStream(processId: string, proc: Subprocess, isAgent: boolean = false) {
        const processRecord = dbService.getProcessById(processId);
        const bridgeLogPath = isAgent && processRecord ? `${processRecord.cwd}/.bot.bridge.log` : null;

        const readStream = async (stream: ReadableStream<Uint8Array> | null, name: string) => {
            if (!stream) return;
            const reader = stream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = new TextDecoder().decode(value);

                    if (bridgeLogPath) {
                        try {
                            const fs = require('node:fs');
                            fs.appendFileSync(bridgeLogPath, chunk);
                        } catch (e) { /* write error ignore */ }
                    }

                    try {
                        const current = dbService.getProcessById(processId);
                        let output = (current?.last_output || "") + chunk;
                        if (output.length > 5000) {
                            output = output.substring(output.length - 5000);
                        }
                        dbService.updateProcess(processId, { last_output: output });
                    } catch (e) { /* DB write error */ }
                }
            } catch (e) { /* Stream ended */ }
        };

        readStream(proc.stdout as any, 'stdout');
        readStream(proc.stderr as any, 'stderr');

        try {
            const exitCode = await proc.exited;
            const status = exitCode === 0 ? 'stopped' : 'error';
            console.log(`[ProjectManager] Proceso ${processId} terminó con código ${exitCode}.`);
            dbService.updateProcess(processId, { status: status });
            activeSubprocesses.delete(processId);
        } catch (e) { /* process already gone */ }
    },

    /**
     * Detiene un proceso por su ID.
     */
    stopProcess(processId: string): boolean {
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
        dbService.updateProcess(processId, { status: 'stopped' });
        return true;
    },

    /**
     * Detiene todos los procesos de un proyecto.
     */
    stopProjectProcesses(projectId: string) {
        const processes = dbService.getProcessesByProject(projectId);
        for (const proc of processes) {
            if (proc.status === 'running') {
                this.stopProcess(proc.id);
            }
        }
        dbService.updateProjectStatus(projectId, 'idle');
    },

    /**
     * Obtiene el estado de todos los procesos en ejecución.
     */
    getStatus(): any[] {
        return dbService.getRunningProcesses();
    },

    /**
     * Genera el contexto del proyecto activo para inyectar al system prompt del agente.
     */
    getActiveProjectContext(): string {
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
