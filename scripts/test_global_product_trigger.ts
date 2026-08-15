import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function createValidGtin14() {
  const body = `9${Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')}`;
  const sum = [...body]
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

async function main() {
  const { data: sourceProduct, error: sourceError } = await supabase
    .from('products')
    .select('organization_id')
    .not('organization_id', 'is', null)
    .limit(1)
    .single();

  if (sourceError) throw sourceError;

  let ean = createValidGtin14();
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const { data, error } = await supabase
      .from('global_products')
      .select('id')
      .eq('ean', ean)
      .maybeSingle();
    if (error) throw error;
    if (!data) break;
    ean = createValidGtin14();
  }

  let testProductId: string | null = null;
  let createdGlobalProductId: string | null = null;

  try {
    const { data: createdLocal, error: createError } = await supabase
      .from('products')
      .insert({
        organization_id: sourceProduct.organization_id,
        nome: 'Teste temporario de catalogo global',
        ean: null,
      })
      .select('id, global_product_id')
      .single();

    if (createError) throw createError;
    testProductId = createdLocal.id;
    if (createdLocal.global_product_id !== null) {
      throw new Error('Produto sem EAN recebeu vínculo global.');
    }

    const { data: updatedLocal, error: updateError } = await supabase
      .from('products')
      .update({ ean })
      .eq('id', testProductId)
      .select('global_product_id')
      .single();

    if (updateError) throw updateError;
    createdGlobalProductId = updatedLocal.global_product_id;
    if (!createdGlobalProductId) {
      throw new Error('Produto não foi vinculado ao catálogo global após receber EAN.');
    }

    const { data: globalProduct, error: globalError } = await supabase
      .from('global_products')
      .select('id, ean')
      .eq('id', createdGlobalProductId)
      .eq('ean', ean)
      .maybeSingle();

    if (globalError) throw globalError;
    if (!globalProduct) {
      throw new Error('O vínculo global não aponta para o EAN informado.');
    }

    console.log(JSON.stringify({
      productWithoutEanStayedLocal: true,
      productGainedGlobalLinkAfterEan: true,
      globalProductExistsWithMatchingEan: true,
      ok: true,
    }, null, 2));
  } finally {
    if (testProductId) {
      const { error } = await supabase.from('products').delete().eq('id', testProductId);
      if (error) throw error;
    }
    if (createdGlobalProductId) {
      const { error } = await supabase.from('global_products').delete().eq('id', createdGlobalProductId);
      if (error) throw error;
    }
  }
}

main().catch((error) => {
  console.error('Falha no teste do gatilho de catálogo global:', error);
  process.exitCode = 1;
});
