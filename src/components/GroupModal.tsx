'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Group, LibraryItem } from '@/lib/types';
import { FolderPlus, X, Check, Loader2, Trash2 } from 'lucide-react';

interface GroupModalProps {
  item: LibraryItem;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
];

export function GroupModal({ item, isOpen, onClose }: GroupModalProps) {
  const queryClient = useQueryClient();
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  // Buscar todos os grupos existentes
  const { data: allGroups = [], isLoading } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await fetch('/api/groups');
      if (!res.ok) throw new Error('Falha ao carregar grupos');
      return res.json();
    },
    enabled: isOpen,
  });

  // Criar novo grupo
  const createGroupMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      if (!res.ok) throw new Error('Erro ao criar grupo');
      return res.json();
    },
    onSuccess: (newGroup: Group) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      // Vincular imediatamente ao item
      toggleGroupMutation.mutate({ groupId: newGroup.id, action: 'add' });
      setNewGroupName('');
      setIsCreating(false);
    },
  });

  // Vincular/desvincular grupo do item
  const toggleGroupMutation = useMutation({
    mutationFn: async ({ groupId, action }: { groupId: number; action: 'add' | 'remove' }) => {
      const res = await fetch(`/api/library/${item.id}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, action }),
      });
      if (!res.ok) throw new Error('Erro ao alterar grupo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  if (!isOpen) return null;

  const currentGroupIds = new Set((item.groups || []).map((g) => g.id));

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate({
      name: newGroupName.trim(),
      color: selectedColor,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white">Gerenciar Grupos & Coleções</h3>
            <p className="line-clamp-1 text-xs text-neutral-400">{item.media.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista de grupos existentes */}
        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
            </div>
          ) : allGroups.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-500">
              Nenhum grupo criado ainda. Crie o primeiro abaixo!
            </p>
          ) : (
            allGroups.map((group) => {
              const isSelected = currentGroupIds.has(group.id);
              return (
                <div
                  key={group.id}
                  onClick={() =>
                    toggleGroupMutation.mutate({
                      groupId: group.id,
                      action: isSelected ? 'remove' : 'add',
                    })
                  }
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                    isSelected
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: group.color || '#10b981' }}
                    />
                    <span className="text-sm font-medium">{group.name}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-emerald-400" />}
                </div>
              );
            })
          )}
        </div>

        {/* Formulário para novo grupo */}
        <div className="mt-5 border-t border-neutral-800 pt-4">
          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 bg-neutral-950/40 py-2.5 text-xs font-semibold text-neutral-300 hover:border-emerald-500 hover:text-emerald-400"
            >
              <FolderPlus className="h-4 w-4" />
              Criar Novo Grupo
            </button>
          ) : (
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <input
                type="text"
                placeholder='Ex: "Jogos zerados em 2026", "Animes favoritos"'
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`h-5 w-5 rounded-full transition-transform ${
                        selectedColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="rounded-lg px-2.5 py-1 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!newGroupName.trim() || createGroupMutation.isPending}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {createGroupMutation.isPending ? 'Criando...' : 'Salvar Grupo'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
