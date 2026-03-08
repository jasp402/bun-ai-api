import { Database } from "bun:sqlite";
const db = new Database("bun-ai-api.sqlite");

console.log("=== PROCESOS EN EJECUCIÓN ===");
const processes = db.query("SELECT * FROM processes WHERE status = 'running'").all();
console.table(processes);

console.log("\n=== PROYECTOS ACTIVOS ===");
const projects = db.query("SELECT * FROM projects WHERE is_active = 1").all();
console.table(projects);
