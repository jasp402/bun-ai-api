import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Database } from "bun:sqlite";
import type { McpServerConfig, McpToolDefinition } from "../types";

const db = new Database("bun-ai-api.sqlite", { create: true });

export interface McpConnection {
    client: Client;
    transport: StdioClientTransport | any; // SSE no lo implementamos para no alargar este demo, pero Stdio abarca el 90%
    tools: McpToolDefinition[];
    config: McpServerConfig;
}

export const mcpService = {
    connections: new Map<string, McpConnection>(),

    // Carga e inicializa todos los servidores activos de la DB
    initServers: async () => {
        console.log("[MCP] Iniciando servidores configurados...");
        const query = db.query("SELECT * FROM mcp_servers WHERE is_active = 1");
        const servers = query.all() as McpServerConfig[];

        for (const srv of servers) {
            try {
                await mcpService.connectServer(srv);
            } catch (err) {
                console.error(`[MCP] Error conectando servidor ${srv.name}:`, err);
            }
        }
    },

    connectServer: async (srv: McpServerConfig) => {
        if (srv.type === 'stdio' && srv.command) {
            let args: string[] = [];
            const envVars: Record<string, string> = {};
            Object.assign(envVars, process.env as Record<string, string>);

            if (srv.args) {
                try { args = JSON.parse(srv.args); } catch (e) { }
            }
            if (srv.env) {
                try {
                    const parsedEnv = JSON.parse(srv.env);
                    Object.assign(envVars, parsedEnv);
                } catch (e) { }
            }

            console.log(`[MCP] Levantando transporte StdIO para: ${srv.name} (${srv.command} ${args.join(" ")})`);

            const transport = new StdioClientTransport({
                command: srv.command,
                args,
                env: envVars
            });

            const client = new Client(
                {
                    name: "bun-ai-api-client",
                    version: "1.0.0",
                },
                {
                    capabilities: {}
                }
            );

            await client.connect(transport);

            // Listar tools
            const response = await client.listTools();
            const tools: McpToolDefinition[] = response.tools.map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema
            }));

            console.log(`[MCP] Servidor ${srv.name} conectado. Herramientas encontradas: ${tools.map(t => t.name).join(', ')}`);

            mcpService.connections.set(srv.name, {
                client,
                transport,
                config: srv,
                tools
            });

        } else {
            console.warn(`[MCP] Tipo de servidor '${srv.type}' no soportado (aún) o falta 'command'. Omitiendo ${srv.name}`);
        }
    },

    // Retorna todas las herramientas unificadas de todos los servidores
    getAllTools: (): { serverName: string, tool: McpToolDefinition }[] => {
        const registry: { serverName: string, tool: McpToolDefinition }[] = [];
        for (const [sName, conn] of mcpService.connections.entries()) {
            for (const t of conn.tools) {
                registry.push({ serverName: sName, tool: t });
            }
        }
        return registry;
    },

    // Ejecuta una herramienta y devuelve la raw respuesta del servidor MCP
    callTool: async (serverName: string, toolName: string, args: any): Promise<any> => {
        const conn = mcpService.connections.get(serverName);
        if (!conn) throw new Error(`[MCP] Servidor '${serverName}' no conectado o no existe.`);

        console.log(`[MCP] Llamando herramienta: ${serverName}/${toolName} con args`, args);
        const result = await conn.client.callTool({
            name: toolName,
            arguments: args
        });

        return result; // Devuelve { content: [ { type: 'text', text: '...' } ], isError: boolean }
    }
};
