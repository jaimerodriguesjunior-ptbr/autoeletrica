'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchLocalNcm, LocalNcmItem } from '@/src/actions/fiscal_db';
import { Loader2, Search, Check } from 'lucide-react';

interface NcmAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onSelectNcm?: (ncm: LocalNcmItem) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    title?: string;
    autoFocus?: boolean;
}

export function NcmAutocomplete({
    value,
    onChange,
    onBlur,
    onSelectNcm,
    placeholder = "NCM",
    className = "",
    disabled = false,
    title,
    autoFocus = false
}: NcmAutocompleteProps) {
    const [inputValue, setInputValue] = useState(value || '');
    const [suggestions, setSuggestions] = useState<LocalNcmItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSuggestions = (query: string) => {
        if (!query || query.trim().length < 2) {
            setSuggestions([]);
            setIsOpen(false);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        debounceTimerRef.current = setTimeout(async () => {
            try {
                const results = await searchLocalNcm(query);
                setSuggestions(results);
                setIsOpen(results.length > 0);
                setSelectedIndex(-1);
            } catch (err) {
                console.error("Erro na busca de NCM:", err);
                setSuggestions([]);
            } finally {
                setIsLoading(false);
            }
        }, 200);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        onChange(val);
        fetchSuggestions(val);
    };

    const handleSelect = (item: LocalNcmItem) => {
        setInputValue(item.codigo);
        onChange(item.codigo);
        if (onSelectNcm) onSelectNcm(item);
        setIsOpen(false);
        setSuggestions([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                e.preventDefault();
                handleSelect(suggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (inputValue.trim().length >= 2 && suggestions.length > 0) {
                        setIsOpen(true);
                    }
                }}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled}
                title={title}
                autoFocus={autoFocus}
                className={className}
            />

            {isLoading && (
                <div className="absolute right-7 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <Loader2 size={12} className="animate-spin" />
                </div>
            )}

            {isOpen && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 min-w-[280px] overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-xl text-left">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase text-stone-400 border-b border-stone-100 flex items-center gap-1">
                        <Search size={10} />
                        Catálogo NCM ({suggestions.length})
                    </div>
                    {suggestions.map((item, idx) => {
                        const isSelected = selectedIndex === idx;
                        const isCurrent = inputValue === item.codigo;
                        return (
                            <button
                                key={item.codigo}
                                type="button"
                                onClick={() => handleSelect(item)}
                                className={`w-full px-2.5 py-1.5 text-xs rounded-md text-left transition flex flex-col gap-0.5 ${
                                    isSelected
                                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                        : 'hover:bg-stone-50 text-stone-700'
                                }`}
                            >
                                <div className="flex items-center justify-between font-mono font-bold text-stone-900">
                                    <span>{item.codigo.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1.$2.$3")}</span>
                                    {isCurrent && <Check size={12} className="text-emerald-600" />}
                                </div>
                                <div className="text-[11px] text-stone-500 line-clamp-2 leading-snug">
                                    {item.descricao}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
