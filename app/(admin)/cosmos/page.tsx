"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';

type Report = { total: number; found: number; notFound: number; errors: number; repeats: number; repeated: { ean: string; count: number }[]; rows: { ean: string; outcome: string; http_status: number | null; created_at: string }[] };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const labels: Record<string, string> = { found: 'Produto encontrado', not_found: 'Sem resultado', error: 'Erro' };
export default function CosmosUsagePage() {
  const { profile, loading } = useAuth();
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile?.cargo !== 'owner' || !date) return;
    const controller = new AbortController();
    setBusy(true); setError(''); setReport(null);
    fetch('/api/cosmos/uso?data=' + encodeURIComponent(date), { signal: controller.signal, cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setReport(body); }).catch(err => { if (err.name !== 'AbortError') setError(err.message || 'Erro ao carregar relatório.'); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [date, profile?.cargo]);
  if (loading) return <p>Carregando...</p>;
  if (profile?.cargo !== 'owner') return <p>Acesso restrito ao responsável.</p>;
  return <div className="space-y-6 max-w-6xl mx-auto">
    <div className="flex flex-wrap justify-between items-end gap-4"><div><h1 className="text-2xl font-bold text-stone-900">Uso da Cosmos</h1><p className="text-sm text-stone-500">Acompanhe as consultas da sua empresa por dia.</p></div><label className="text-sm font-semibold text-stone-700">Data <input aria-label="Data do relatório" type="date" value={date} onChange={e => setDate(e.target.value)} className="ml-2 rounded-lg border border-stone-300 bg-white p-2" /></label></div>
    <p className="text-sm text-stone-500">Horário de São Paulo. Consultas repetidas são chamadas adicionais ao mesmo código no dia; podem ser necessárias. Produto encontrado indica resposta com descrição, não confirma cadastro ou venda. A cobrança depende da Cosmos.</p>
    {busy && <p>Carregando consultas...</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {report && <><div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[['Consultas', report.total], ['Produtos encontrados', report.found], ['Sem resultado', report.notFound], ['Erros', report.errors], ['Repetições', report.repeats]].map(([label, value]) => <div key={label} className="bg-white rounded-xl border border-stone-200 p-4"><p className="text-sm text-stone-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>)}</div>
    <p className="text-sm text-stone-600">Aproveitamento: {report.total ? ((report.found / report.total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—'} das consultas retornaram um produto com descrição.</p>
    <section className="bg-white rounded-xl border border-stone-200 p-5"><h2 className="font-bold mb-3">Códigos repetidos</h2>{report.repeated.length ? <ul className="text-sm space-y-1">{report.repeated.map(item => <li key={item.ean}>{item.ean}: {item.count} consultas</li>)}</ul> : <p className="text-sm text-stone-500">Nenhuma repetição no dia.</p>}</section>
    <section className="bg-white rounded-xl border border-stone-200 p-5"><h2 className="font-bold mb-3">Detalhes das consultas</h2>{report.rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b"><th className="py-2">Horário</th><th>EAN</th><th>Resultado</th><th>HTTP</th></tr></thead><tbody>{report.rows.map((row, i) => <tr key={i} className="border-b border-stone-100"><td className="py-2">{new Date(row.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td><td>{row.ean}</td><td>{labels[row.outcome] || row.outcome}</td><td>{row.http_status ?? '—'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-stone-500">Nenhuma consulta registrada nesta data.</p>}</section></>}
  </div>;
}
