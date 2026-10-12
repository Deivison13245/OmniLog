import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, onSubmit, placeholder = 'Buscar por título...' }: SearchBarProps) {
  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-4 h-5 w-5 text-neutral-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-neutral-800 bg-neutral-900/90 py-3.5 pl-12 pr-28 text-base text-neutral-100 placeholder-neutral-500 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="absolute right-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
