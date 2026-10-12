'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, CheckCircle2, CloudDownload, Loader2 } from 'lucide-react';
import { libraryDb, readSetting, useAllLibraryItems } from '@/lib/library-db';
import {
  chooseSaveFile,
  getSaveFileHandle,
  writeSaveFile,
} from '@/lib/save-file';

export function SaveFileStatus() {
  const items = useAllLibraryItems();
  const groups = useAllLibraryGroups();
  const [handle, setHandle] = useState<FileSystemFileHandle>();
  const [supportsSavePicker, setSupportsSavePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const savedSnapshot = useLiveQuery(() => readSetting<string>('lastSavedSnapshot'), []);
  const dirty =
    !!items &&
    !!groups &&
    (savedSnapshot === undefined
      ? items.length > 0 || groups.length > 0
      : JSON.stringify({ items, groups }) !== savedSnapshot);

  useEffect(() => {
    getSaveFileHandle().then(setHandle).catch((error: unknown) => {
      console.error('Falha ao recuperar o arquivo de save vinculado:', error);
      setSaveError('Não foi possível acessar o arquivo de save vinculado.');
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSupportsSavePicker(
        typeof (window as FilePickerWindow).showSaveFilePicker === 'function'
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!handle || !dirty || !items || !groups) return;
    const timer = window.setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(undefined);
        await writeSaveFile(handle, items, groups);
      } catch (error: unknown) {
        console.error('Falha ao salvar automaticamente o arquivo do OmniLog:', error);
        setSaveError('Falha ao salvar o arquivo automaticamente.');
      } finally {
        setIsSaving(false);
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [dirty, groups, handle, items]);

  const handleChooseFile = async () => {
    try {
      await chooseSaveFile();
      setHandle(await getSaveFileHandle());
      setSaveError(undefined);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Falha ao vincular arquivo de save:', error);
      setSaveError(error instanceof Error ? error.message : 'Não foi possível vincular o arquivo.');
    }
  };

  const lastSavedAt = useLastSavedAt();
  const label = getSaveStatusLabel({ dirty, isSaving, lastSavedAt });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 ${
          saveError ? 'text-rose-300' : dirty ? 'text-amber-300' : 'text-neutral-400'
        }`}
        title={saveError}
        role={saveError ? 'alert' : undefined}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saveError ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : dirty ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {saveError ?? label}
      </span>
      {supportsSavePicker && (
        <button
          type="button"
          onClick={handleChooseFile}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-800 px-2 py-1 text-neutral-300 hover:border-neutral-700 hover:text-white"
          title={handle ? 'Trocar arquivo de save automático' : 'Vincular arquivo de save automático'}
        >
          <CloudDownload className="h-3.5 w-3.5" />
          {handle ? 'Arquivo vinculado' : 'Vincular arquivo'}
        </button>
      )}
    </div>
  );
}

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
}

function useAllLibraryGroups() {
  return useLiveQuery(() => libraryDb.groups.toArray(), []);
}

function useLastSavedAt() {
  return useLiveQuery(() => readSetting<string>('lastSavedAt'), []);
}

function getSaveStatusLabel({
  dirty,
  isSaving,
  lastSavedAt,
}: {
  dirty: boolean;
  isSaving: boolean;
  lastSavedAt?: string;
}) {
  if (isSaving) return 'Salvando...';
  if (dirty) return 'Alterações sem salvar';
  if (!lastSavedAt) return 'Ainda não salvo';
  const elapsed = Date.now() - new Date(lastSavedAt).getTime();
  if (elapsed < 2 * 60_000) return 'Salvo agora';
  const days = Math.max(1, Math.floor(elapsed / 86_400_000));
  return `Último save há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}
