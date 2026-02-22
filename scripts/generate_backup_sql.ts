import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega as variáveis de ambiente do .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local");
    process.exit(1);
}

async function generateBackupSql() {
    console.log("Conectando ao Supabase para buscar a lista de tabelas...");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_KEY}`);

    if (!response.ok) {
        throw new Error(`Falha ao buscar as tabelas: ${response.status} ${response.statusText}`);
    }

    const spec = await response.json();

    const paths = Object.keys(spec.paths || {});
    const tables = new Set<string>();

    for (const p of paths) {
        if (p === '/' || p.startsWith('/rpc/')) continue;
        const tableName = p.split('/')[1];
        if (tableName) tables.add(tableName);
    }

    console.log(`Encontradas ${tables.size} tabelas.`);

    let sqlCommands = `-- Script de Backup Gerado Automaticamente\n`;
    sqlCommands += `-- Data: ${new Date().toISOString()}\n`;
    sqlCommands += `-- Este script cria cópias de todas as tabelas públicas do seu banco de dados.\n\n`;

    const tableArray = Array.from(tables).sort();

    for (const table of tableArray) {
        const backupName = `backup_${table}_antes_migracao`;
        sqlCommands += `-- Backup da tabela: ${table}\n`;
        sqlCommands += `CREATE TABLE ${backupName} AS SELECT * FROM ${table};\n\n`;
    }

    sqlCommands += `-- Backup finalizado.\n`;

    const outputPath = path.resolve(__dirname, '../backup_completo.sql');
    fs.writeFileSync(outputPath, sqlCommands);
    console.log(`\nScript de SQL gerado com sucesso em: ${outputPath}`);
    console.log("Você pode copiar o conteúdo deste arquivo e colar no SQL Editor do Supabase!");
}

generateBackupSql().catch(console.error);
