import React from 'react';
import { SearchFilter } from '@/lib/types';
import { LayoutGrid, Gamepad2, Film, Sparkles, BookOpen, Bookmark } from 'lucide-react';

interface TypeTabsProps {
  currentTab: SearchFilter;
  onTabChange: (tab: SearchFilter) => void;
}

export function TypeTabs({ currentTab, onTabChange }: TypeTabsProps) {
  const tabs: { id: SearchFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Todos', icon: <LayoutGrid className="h-4 w-4" /> },
    { id: 'game', label: 'Jogos', icon: <Gamepad2 className="h-4 w-4" /> },
    { id: 'video', label: 'Filmes / Séries', icon: <Film className="h-4 w-4" /> },
    { id: 'anime', label: 'Animes', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'manga', label: 'Mangás', icon: <Bookmark className="h-4 w-4" /> },
    { id: 'book', label: 'Livros', icon: <BookOpen className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isActive
                ? 'bg-neutral-800 text-emerald-400 ring-1 ring-emerald-500/30'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
