'use client';

import React, { useState } from 'react';
import { Check, FolderPlus, Loader2, Trash2, X } from 'lucide-react';
import {
  createGroup as createLocalGroup,
  deleteGroup as deleteLocalGroup,
  setItemGroup,
  useLibraryItem,
  useLibraryGroups,
} from '@/lib/library-db';
import { LibraryItem } from '@/lib/types';

interface GroupModalProps {
  item: LibraryItem;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
];

export function GroupModal({ item, isOpen, onClose }: GroupModalProps) {
  const allGroups = useLibraryGroups();
  const currentItem = useLibraryItem(item.id);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  if (!isOpen) return null;

  const displayedItem = currentItem ?? item;
  const currentGroupIds = new Set((displayedItem.groups ?? []).map((group) => group.id));
  const handleCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setIsSaving(true);
      setErrorMessage(undefined);
      await createLocalGroup(newGroupName.trim(), selectedColor, item.id);
      setNewGroupName('');
      setIsCreating(false);
    } catch (error: unknown) {
      console.error('Falha ao criar grupo local:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível criar o grupo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleGroup = async (groupId: number) => {
    try {
      setErrorMessage(undefined);
      await setItemGroup(item.id, groupId, !currentGroupIds.has(groupId));
    } catch (error: unknown) {
      console.error('Falha ao alterar grupo do item:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível alterar o grupo.');
    }
  };

  const handleDeleteGroup = async (groupId: number, name: string) => {
    if (!confirm(`Excluir o grupo "${name}"? Ele será removido de todos os itens.`)) return;
    try {
      setErrorMessage(undefined);
      await deleteLocalGroup(groupId);
    } catch (error: unknown) {
      console.error('Falha ao excluir grupo local:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível excluir o grupo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white">Gerenciar Grupos & Coleções</h3>
            <p className="line-clamp-1 text-xs text-neutral-400">{displayedItem.media.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar grupos"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">
            {errorMessage}
          </p>
        )}

        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
          {allGroups === undefined ? (
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
                  className={`flex items-center justify-between rounded-xl border p-3 ${
                    isSelected
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void handleToggleGroup(group.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color || '#10b981' }}
                    />
                    <span className="truncate text-sm font-medium">{group.name}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteGroup(group.id, group.name)}
                    aria-label={`Excluir grupo ${group.name}`}
                    className="ml-2 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

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
                onChange={(event) => setNewGroupName(event.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Selecionar cor ${color}`}
                      onClick={() => setSelectedColor(color)}
                      className={`h-5 w-5 rounded-full transition-transform ${
                        selectedColor === color
                          ? 'scale-125 ring-2 ring-white'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
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
                    disabled={!newGroupName.trim() || isSaving}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isSaving ? 'Criando...' : 'Salvar Grupo'}
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
