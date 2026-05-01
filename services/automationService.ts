import { exec } from "node:child_process";
import { writeFile, unlinkSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const hwndCache = new Map<string, string>();

export const automationService = {
    runAhk: (script: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const tempFile = join(tmpdir(), `script_${Date.now()}.ahk`);
            console.log(`[Automation] [runAhk] Preparando creación de ${tempFile}`);
            writeFile(tempFile, script, (err) => {
                if (err) {
                    console.error(`[Automation] [runAhk] Error escribiendo script temporal:`, err);
                    return reject(err);
                }

                const ahkBase = process.env.AUTOHOTKEY_PATH || "C:\\Program Files\\AutoHotkey\\v2";
                const ahkExe = join(ahkBase, "AutoHotkey64.exe");

                console.log(`[Automation] [runAhk] Ejecutando script AHK...`);
                console.log(`[Automation] [runAhk] Ruta EXE: "${ahkExe}"`);
                console.log(`[Automation] [runAhk] Script TEMP: "${tempFile}"`);

                const { spawn } = require("node:child_process");

                console.log(`[Automation] [runAhk] Instanciando spawn child_process...`);
                const child = spawn(ahkExe, [tempFile]);
                console.log(`[Automation] [runAhk] Child Process PID AHK: ${child.pid}`);

                let stdout = "";
                let stderr = "";

                child.stdout.on("data", (data: any) => {
                    const str = data.toString();
                    console.log(`[Automation] [runAhk] STDOUT: ${str.trim()}`);
                    stdout += str;
                });

                child.stderr.on("data", (data: any) => {
                    const str = data.toString();
                    console.log(`[Automation] [runAhk] STDERR: ${str.trim()}`);
                    stderr += str;
                });

                child.on("close", (code: number) => {
                    console.log(`[Automation] [runAhk] Proceso PID ${child.pid} cerrado con código: ${code}`);
                    // Limpieza inmediata del script temporal
                    if (existsSync(tempFile)) unlinkSync(tempFile);

                    if (code !== 0) {
                        console.error(`[Automation] [runAhk] Error (code ${code}): ${stderr}`);
                        return reject(stderr || `AHK exited with code ${code}`);
                    }
                    console.log(`[Automation] [runAhk] Ejecución exitosa devuelta al llamador.`);
                    resolve(stdout);
                });

                child.on("error", (err: any) => {
                    console.error(`[Automation] [runAhk] Evento de Error crítico lazando en proc PID ${child.pid}:`, err);
                    if (existsSync(tempFile)) unlinkSync(tempFile);
                    reject(err);
                });
            });
        });
    },

    quickAction: {
        click: (x: number, y: number) => automationService.runAhk(`Click(${x}, ${y})`),
        press: (key: string) => automationService.runAhk(`Send("{${key}}")`),
        msg: (text: string) => automationService.runAhk(`MsgBox("${text}")`),
        runApp: (path: string) => automationService.runAhk(`Run("${path}")`),

        focusAndType: (title: string, text: string, pid?: number) => {
            // ✅ Priorizar HWND si lo capturamos al inicio!
            let target = title;
            if (hwndCache.has(title)) {
                target = `ahk_id ${hwndCache.get(title)}`;
                console.log(`[Automation] [focusAndType] Usando HWND en caché para ${title}: ${target}`);
            }

            // ✅ Escape correcto para AHK v2
            const safeText = text
                .replace(/`/g, "``")
                .replace(/"/g, '`"')
                .replace(/\r/g, '`r')
                .replace(/\n/g, '`n');

            const script = [
                `#Requires AutoHotkey v2`,
                `SetTitleMatchMode(2)`, // 2 = Contiene el string
                `target := "${target}"`,
                `if (WinExist(target)) {`,
                `    WinActivate(target)`,
                `    if (WinWaitActive(target, , 3)) {`,
                `        Sleep(400)`,
                `        WinGetPos(&x, &y, &w, &h, target)`,
                `        centerX := x + (w // 2)`,
                `        centerY := y + (h // 2)`,
                `        prevClip := A_Clipboard`,
                `        A_Clipboard := "${safeText}"`,
                `        if (ClipWait(3)) {`,
                `            Click(centerX, centerY, "Right")`,  // ✅ CMD: right-click = paste directo
                `            Sleep(300)`,
                `            Send("{Enter}")`,                   // ✅ Ejecutar comando
                `            Sleep(100)`,
                `        } else {`,
                `            FileAppend("ClipWait failed for: " . target . "\\n", "*")`,
                `        }`,
                `        A_Clipboard := prevClip`,
                `    } else {`,
                `        FileAppend("WinWaitActive failed for: " . target . "\\n", "*")`,
                `    }`,
                `} else {`,
                `    FileAppend("Window not found: " . target . "\\n", "*")`,
                `}`,
                `ExitApp()`
            ].join('\n');

            console.log("[Automation] Script generado:\n", script);
            return automationService.runAhk(script);
        },

        readTerminalContent: async (title: string): Promise<string | null> => {
            let target = title;
            if (hwndCache.has(title)) {
                target = `ahk_id ${hwndCache.get(title)}`;
                console.log(`[Automation] [readTerminalContent] Usando HWND en caché para ${title}: ${target}`);
            }

            const tempResult = join(tmpdir(), `ahk_clip_${Date.now()}.txt`);
            const escapedTempResult = tempResult.replace(/\\/g, "\\\\");

            const script = [
                `#Requires AutoHotkey v2`,
                `SetTitleMatchMode(2)`,
                `target := "${target}"`,
                `if (WinExist(target)) {`,
                `    WinActivate(target)`,
                `    if (WinWaitActive(target, , 3)) {`,
                `        A_Clipboard := ""`, // Limpiar clip
                `        Sleep(200)`,
                `        Send("^A")`,        // Seleccionar Todo (Ctrl+A)
                `        Sleep(200)`,
                `        Send("^C")`,        // Copiar (Ctrl+C)
                `        if (ClipWait(3)) {`,
                `            FileAppend(A_Clipboard, "${escapedTempResult}", "UTF-8")`,
                `            Send("{Down}")`, // Quitar seleccion sin MACRO DE CANCELACION (Esc abortaba el MCP)
                `        } else {`,
                `            FileAppend("ERROR_CLIPWAIT", "${escapedTempResult}", "UTF-8")`,
                `        }`,
                `    } else {`,
                `        FileAppend("ERROR_WINWAIT", "${escapedTempResult}", "UTF-8")`,
                `    }`,
                `} else {`,
                `    FileAppend("ERROR_NOTFOUND", "${escapedTempResult}", "UTF-8")`,
                `}`,
                `ExitApp()`
            ].join('\n');

            await automationService.runAhk(script);

            try {
                if (existsSync(tempResult)) {
                    let text = readFileSync(tempResult, 'utf8');
                    unlinkSync(tempResult);
                    if (text.startsWith("ERROR_")) {
                        console.error(`[Automation] [readTerminalContent] AHK falló con: ${text}`);
                        return null;
                    }
                    return text;
                }
            } catch (e) {
                console.error("[Automation] [readTerminalContent] Error reading clipboard file:", e);
            }
            return null;
        },

        captureHwnd: async (title: string, timeoutMs: number = 8000): Promise<string | null> => {
            console.log(`[Automation] [captureHwnd] Esperando ventana "${title}" por ${timeoutMs}ms...`);
            const tempResult = join(tmpdir(), `ahk_hwnd_${Date.now()}.txt`);
            const escapedTempResult = tempResult.replace(/\\/g, "\\\\");
            const script = [
                `#Requires AutoHotkey v2`,
                `SetTitleMatchMode(2)`,
                `target := "${title}"`,
                `hwnd := 0`,
                // WinWait espera hasta que exista. Timeout en segundos
                `if (WinWait(target, , ${timeoutMs / 1000})) {`,
                `    hwnd := WinGetID(target)`,
                `}`,
                `FileAppend(hwnd, "${escapedTempResult}")`,
                `ExitApp()`
            ].join('\n');

            await automationService.runAhk(script);

            try {
                if (existsSync(tempResult)) {
                    const res = readFileSync(tempResult, 'utf8').trim();
                    unlinkSync(tempResult);
                    if (res && res !== "0" && res !== "") {
                        hwndCache.set(title, res);
                        console.log(`[Automation] [captureHwnd] HWND CAPTURADO EXITOSAMENTE PARA "${title}": ${res}`);
                        return res;
                    }
                }
                console.log(`[Automation] [captureHwnd] No se pudo capturar HWND para "${title}" (timeout o falló).`);
            } catch (e) {
                console.error("[Automation] [captureHwnd] Error reading result:", e);
            }
            return null;
        },

        windowExists: async (title: string, pid?: number): Promise<boolean> => {
            let target = title;
            if (hwndCache.has(title)) {
                target = `ahk_id ${hwndCache.get(title)}`;
            }

            const tempResult = join(tmpdir(), `ahk_res_${Date.now()}.txt`);
            const escapedTempResult = tempResult.replace(/\\/g, "\\\\");
            const script = [
                `#Requires AutoHotkey v2`,
                `SetTitleMatchMode(2)`,
                `target := "${target}"`,
                `if (WinExist(target)) {`,
                `    FileAppend("1", "${escapedTempResult}")`,
                `} else {`,
                `    FileAppend("0", "${escapedTempResult}")`,
                `}`,
                `ExitApp()`
            ].join('\n');

            await automationService.runAhk(script);

            try {
                if (existsSync(tempResult)) {
                    const res = readFileSync(tempResult, 'utf8');
                    unlinkSync(tempResult);
                    return res.trim() === "1";
                }
            } catch (e) {
                console.error("Error reading AHK result:", e);
            }
            return false;
        },

        takeScreenshot: (): Promise<string> => {
            return new Promise((resolve, reject) => {
                const screenPath = join(tmpdir(), `screenshot_${Date.now()}.png`);
                const psScript = `
                    Add-Type -AssemblyName System.Windows.Forms
                    Add-Type -AssemblyName System.Drawing
                    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
                    $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
                    $graphic = [System.Drawing.Graphics]::FromImage($bitmap)
                    $graphic.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size)
                    $bitmap.Save("${screenPath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
                    $graphic.Dispose()
                    $bitmap.Dispose()
                `;

                const { spawn } = require("node:child_process");
                const child = spawn("powershell.exe", ["-Command", psScript]);

                child.on("close", (code: number) => {
                    if (code === 0 && existsSync(screenPath)) {
                        resolve(screenPath);
                    } else {
                        reject(new Error(`Screenshot failed with code ${code}`));
                    }
                });
            });
        }
    }
};
