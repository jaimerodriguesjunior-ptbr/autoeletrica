"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

type DatabaseProduct = {
    id: string;
    nome: string;
    ean: string | null;
    estoque_atual: number;
    custo_reposicao: number;
};

interface ProductComboboxProps {
    products: DatabaseProduct[];
    value: string | 'new';
    onChange: (value: string | 'new') => void;
}

export function ProductCombobox({ products, value, onChange }: ProductComboboxProps) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fecha ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    // Filtra produtos
    const filteredProducts = products.filter((product) =>
        product.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Encontra o produto selecionado para exibir o nome
    const selectedProduct = products.find((p) => p.id === value);

    const handleSelect = (newValue: string | 'new') => {
        onChange(newValue);
        setOpen(false);
        setSearchTerm(""); // Reseta a busca ao selecionar
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between bg-white border border-stone-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FACC15] hover:bg-stone-50 transition text-left"
            >
                <div className="truncate">
                    {value === 'new' ? (
                        <span className="flex items-center gap-2 text-[#1A1A1A]">
                            <Plus size={16} className="text-[#FACC15]" />
                            Cadastrar como Novo Produto
                        </span>
                    ) : (
                        selectedProduct?.nome || "Selecione um produto..."
                    )}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>

            {open && (
                <div className="absolute z-[100] w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-80 overflow-auto">
                    <div className="sticky top-0 bg-white p-2 border-b border-stone-100">
                        <input
                            type="text"
                            placeholder="Buscar produto..."
                            className="w-full p-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#FACC15]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="p-1">
                        <div
                            onClick={() => handleSelect('new')}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm ${value === 'new' ? 'bg-[#FACC15]/10 text-[#1A1A1A]' : 'hover:bg-stone-50 text-stone-700'
                                }`}
                        >
                            <span className="flex-1 flex items-center gap-2 font-medium">
                                <Plus size={16} className="text-[#FACC15]" />
                                Cadastrar como Novo Produto
                            </span>
                            {value === 'new' && <Check size={16} className="text-[#FACC15]" />}
                        </div>

                        {filteredProducts.length === 0 && (
                            <div className="p-4 text-center text-sm text-stone-400">
                                Nenhum produto encontrado.
                            </div>
                        )}

                        {filteredProducts.map((product) => (
                            <div
                                key={product.id}
                                onClick={() => handleSelect(product.id)}
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm ${value === product.id ? 'bg-[#FACC15]/10 text-[#1A1A1A]' : 'hover:bg-stone-50 text-stone-700'
                                    }`}
                            >
                                <span className="flex-1 truncate">{product.nome}</span>
                                {value === product.id && <Check size={16} className="text-[#FACC15]" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
