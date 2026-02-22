import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Necessário SERVICE_ROLE para criar usuários

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createTenantUser() {
    // =========================================================================
    // 📝 PREENCHA OS DADOS DO NOVO USUÁRIO (RALLY AUTO-CENTER) AQUI 📝
    // =========================================================================

    // ID da organização "Rally auto-center" (copie do Supabase Dashboard)
    const ORGANIZATION_ID = "a66bcf26-4389-420e-94bd-2605166c126d";

    // Dados do usuário
    const NOME_USUARIO = "Admin Rally"; // Nome que vai aparecer na tela
    const EMAIL_USUARIO = "admin@rallyautocenter.com.br"; // E-mail de login
    const SENHA_USUARIO = "Rally@2026"; // Senha inicial
    const CARGO_USUARIO = "owner"; // 'owner' ou 'employee'

    // =========================================================================

    console.log(`\n=== CRIANDO USUÁRIO PARA NOVO TENANT ===\n`);
    console.log(`Organização: ${ORGANIZATION_ID}`);
    console.log(`Nome:        ${NOME_USUARIO}`);
    console.log(`E-mail:      ${EMAIL_USUARIO}`);
    console.log(`Cargo:       ${CARGO_USUARIO}`);
    console.log(`----------------------------------------`);

    // 1. Verificar se a organização existe
    const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', ORGANIZATION_ID)
        .single();

    if (orgError) {
        console.error("❌ Erro: Organização não encontrada. Crie ela primeiro no painel.");
        return;
    }
    console.log(`✅ Organização encontrada: ${org.name}\n`);

    // 2. Criar o usuário no Auth
    console.log(`⏳ Criando usuário no auth.users...`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: EMAIL_USUARIO,
        password: SENHA_USUARIO,
        email_confirm: true, // Força a confirmação do e-mail
    });

    if (authError) {
        if (authError.message.includes("already registered")) {
            console.error(`❌ Erro: O e-mail ${EMAIL_USUARIO} já existe no sistema.`);
            // Opcional: buscar o ID dele para atualizar o profile
        } else {
            console.error(`❌ Erro ao criar usuário auth:`, authError.message);
        }
        return;
    }

    const userId = authData.user.id;
    console.log(`✅ Usuário auth criado com sucesso! ID: ${userId}\n`);

    // 3. Criar/Atualizar o profile
    console.log(`⏳ Vinculando usuário à organização na tabela profiles...`);

    // Como a trigger pode já ter criado um profile vazio, fazemos um upsert
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: userId, // Tem que ser exatamente o mesmo ID do auth
            organization_id: ORGANIZATION_ID,
            nome: NOME_USUARIO,
            email: EMAIL_USUARIO,
            cargo: CARGO_USUARIO,
            ativo: true
        });

    if (profileError) {
        console.error(`❌ Erro ao criar profile:`, profileError.message);
        // Em caso de erro grave, consideramos deletar o usuário do auth para manter consistência
        // await supabaseAdmin.auth.admin.deleteUser(userId);
        return;
    }

    console.log(`✅ Profile vinculado com sucesso!\n`);

    console.log(`🎉 PRONTO! O acesso foi criado.`);
    console.log(`   URL de Login: http://localhost:3000/login`);
    console.log(`   E-mail:       ${EMAIL_USUARIO}`);
    console.log(`   Senha:        ${SENHA_USUARIO}`);
    console.log(`\nImportante: Anote essa senha provisória e passe para o cliente.`);
}

createTenantUser().catch(console.error);
