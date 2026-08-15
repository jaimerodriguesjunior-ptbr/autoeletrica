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

type LocalProduct = {
  id: string;
  ean: string | null;
  global_product_id: string | null;
};

type GlobalProduct = {
  id: string;
  ean: string;
};

async function fetchAllLocalProducts() {
  const products: LocalProduct[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('products')
      .select('id, ean, global_product_id')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    products.push(...(data as LocalProduct[]));
    if (data.length < pageSize) return products;
  }
}

async function fetchAllGlobalProducts() {
  const products: GlobalProduct[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('global_products')
      .select('id, ean')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    products.push(...(data as GlobalProduct[]));
    if (data.length < pageSize) return products;
  }
}

function normalizeEan(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  return /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits) ? digits : null;
}

async function main() {
  const [localProducts, globalProducts] = await Promise.all([
    fetchAllLocalProducts(),
    fetchAllGlobalProducts(),
  ]);

  const globalByEan = new Map(globalProducts.map((product) => [product.ean, product.id]));
  const eligible = localProducts.filter((product) => normalizeEan(product.ean));
  const linkedCorrectly = eligible.filter((product) => {
    const ean = normalizeEan(product.ean);
    return ean !== null && product.global_product_id === globalByEan.get(ean);
  });
  const invalidlyLinked = localProducts.filter(
    (product) => !normalizeEan(product.ean) && product.global_product_id !== null,
  );

  const result = {
    localProducts: localProducts.length,
    eligibleLocalProducts: eligible.length,
    uniqueEligibleEans: new Set(eligible.map((product) => normalizeEan(product.ean))).size,
    globalProducts: globalProducts.length,
    correctlyLinkedEligibleProducts: linkedCorrectly.length,
    eligibleProductsMissingOrWithWrongLink: eligible.length - linkedCorrectly.length,
    productsWithoutValidEanLinkedGlobally: invalidlyLinked.length,
    ok:
      linkedCorrectly.length === eligible.length &&
      invalidlyLinked.length === 0,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Falha na auditoria do catalogo global:', error);
  process.exitCode = 1;
});
