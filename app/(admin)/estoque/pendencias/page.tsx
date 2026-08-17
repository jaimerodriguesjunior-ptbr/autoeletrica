"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, Package, Search } from "lucide-react";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";

type PendingItem = {
  id: string;
  work_order_id: number | string;
  name: string;
  marca: string | null;
  unit_price: number;
  created_at: string;
  work_orders?: { id: number | string; clients?: { nome: string }[] | null }[] | null;
};

type Product = {
  id: string;
  nome: string;
  marca: string | null;
  codigo_ref: string | null;
  ncm: string | null;
  preco_venda: number;
};

export default function CatalogPendingPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [ncm, setNcm] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    const [pendingRes, productsRes] = await Promise.all([
      supabase.from("work_order_items")
        .select("id, work_order_id, name, marca, unit_price, created_at, work_orders(id, clients(nome))")
        .eq("organization_id", profile.organization_id)
        .eq("catalog_status", "pending")
        .eq("tipo", "peca")
        .eq("peca_cliente", false)
        .order("created_at", { ascending: true }),
      supabase.from("products")
        .select("id, nome, marca, codigo_ref, ncm, preco_venda")
        .eq("organization_id", profile.organization_id)
        .order("nome")
    ]);
    if (pendingRes.error) console.error(pendingRes.error);
    if (productsRes.error) console.error(productsRes.error);
    setPending((pendingRes.data || []) as PendingItem[]);
    setProducts((productsRes.data || []) as Product[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [profile?.organization_id]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return products.slice(0, 8);
    return products.filter((p) => [p.nome, p.marca, p.codigo_ref, p.ncm].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term)).slice(0, 8);
  }, [products, search]);

  const linkProduct = async (item: PendingItem, product: Product) => {
    setSaving(true);
    const { error } = await supabase.from("work_order_items").update({
      product_id: product.id,
      name: product.nome,
      marca: product.marca || null,
      catalog_status: "resolved",
    }).eq("id", item.id).eq("organization_id", profile?.organization_id);
    if (error) alert("Erro ao vincular produto: " + error.message);
    else { setActiveId(null); setSearch(""); await load(); }
    setSaving(false);
  };

  const createProduct = async (item: PendingItem) => {
    if (!profile?.organization_id) return;
    setSaving(true);
    const { data: product, error } = await supabase.from("products").insert({
      organization_id: profile.organization_id,
      nome: item.name,
      marca: brand.trim() || item.marca || "Sem Marca",
      ncm: ncm.replace(/\D/g, "").slice(0, 8) || null,
      preco_venda: 0,
      estoque_atual: 0,
      estoque_min: 0,
      custo_reposicao: 0,
      custo_contabil: 0,
    }).select("id, nome, marca, codigo_ref, ncm, preco_venda").single();
    if (error || !product) {
      alert("Erro ao criar produto: " + (error?.message || "produto não retornado"));
      setSaving(false);
      return;
    }
    await linkProduct(item, product as Product);
    setBrand("");
    setNcm("");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-32">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Itens avulsos pendentes</h1>
          <p className="mt-1 text-sm text-stone-500">Complete o cadastro para habilitar a identificação fiscal da OS original.</p>
        </div>
        <Link href="/estoque" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-600 shadow-sm">Voltar</Link>
      </div>

      {loading && <div className="flex items-center gap-2 text-stone-500"><Loader2 className="animate-spin" size={18} /> Carregando...</div>}
      {!loading && pending.length === 0 && <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-500">Nenhum item avulso pendente.</div>}
      <div className="space-y-3">
        {pending.map((item) => (
          <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><AlertTriangle size={17} className="text-amber-700" /><h2 className="font-bold text-[#1A1A1A]">{item.name}</h2></div>
                <p className="mt-1 text-xs text-stone-600">{item.marca || "Marca não informada"} · OS #{item.work_order_id} · R$ {Number(item.unit_price || 0).toFixed(2)}</p>
                <p className="mt-1 text-xs text-stone-500">Cliente: {item.work_orders?.[0]?.clients?.[0]?.nome || "não identificado"}</p>
              </div>
              <button onClick={() => { setActiveId(activeId === item.id ? null : item.id); setSearch(item.name); }} className="rounded-xl bg-[#1A1A1A] px-4 py-2 text-xs font-bold text-[#FACC15]">Resolver</button>
            </div>
            {activeId === item.id && (
              <div className="mt-4 space-y-3 rounded-xl bg-white p-4">
                <div className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2"><Search size={16} className="text-stone-400" /><input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto existente" className="w-full outline-none text-sm" /></div>
                <div className="space-y-2">
                  {filteredProducts.map((product) => <button key={product.id} disabled={saving} onClick={() => void linkProduct(item, product)} className="flex w-full items-center justify-between rounded-lg border border-stone-100 p-3 text-left hover:border-[#FACC15]"><span><span className="block text-sm font-bold">{product.nome}</span><span className="text-xs text-stone-500">{product.marca || "Sem marca"}{product.ncm ? ` · NCM ${product.ncm}` : ""}</span></span><Check size={16} className="text-stone-300" /></button>)}
                </div>
                <div className="border-t border-stone-100 pt-3"><p className="mb-2 text-xs font-bold text-stone-500">Ou criar cadastro oficial</p><div className="grid grid-cols-1 gap-2 md:grid-cols-2"><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marca" className="rounded-lg border border-stone-200 px-3 py-2 text-sm" /><input value={ncm} onChange={(e) => setNcm(e.target.value)} placeholder="NCM (opcional)" className="rounded-lg border border-stone-200 px-3 py-2 text-sm" /></div><button disabled={saving} onClick={() => void createProduct(item)} className="mt-3 flex items-center gap-2 rounded-lg bg-[#FACC15] px-4 py-2 text-xs font-bold text-[#1A1A1A]"><Package size={15} /> Criar e vincular</button></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
