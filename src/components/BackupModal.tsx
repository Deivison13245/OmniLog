'use client';

import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, Upload } from 'lucide-react';
import {
  getLibraryItems,
  importLibraryData,
  libraryDb,
} from '@/lib/library-db';
import {
  chooseOpenSaveFile,
  downloadSaveFile,
  readSaveFile,
} from '@/lib/save-file';

export function BackupModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setMessage(null);
      const [items, groups] = await Promise.all([
        getLibraryItems(),
        libraryDb.groups.toArray(),
      ]);
      await downloadSaveFile(items, groups);
      setMessage({ type: 'success', text: 'Save exportado como omnilog-save.json.' });
    } catch (error: unknown) {
      console.error('Falha ao exportar o save local:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível exportar o save.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      setIsImporting(true);
      setMessage(null);
      const save = await readSaveFile(file);
      const [itemCount, groupCount] = await Promise.all([
        libraryDb.items.count(),
        libraryDb.groups.count(),
      ]);
      if (
        importMode === 'replace' &&
        (itemCount > 0 || groupCount > 0) &&
        !confirm('Substituir todos os itens e grupos atuais pelo conteúdo deste arquivo?')
      ) {
        return;
      }

      await importLibraryData(save, importMode);
      setMessage({
        type: 'success',
        text:
          importMode === 'replace'
            ? 'Progresso substituído com sucesso.'
            : 'Progresso mesclado com sucesso.',
      });
    } catch (error: unknown) {
      console.error('Falha ao importar o save local:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Arquivo de save inválido.',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChooseFile = async () => {
    try {
      const file = await chooseOpenSaveFile();
      if (file) {
        await handleFile(file);
        return;
      }
      fileInputRef.current?.click();
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Falha ao abrir o seletor de save:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível abrir o seletor de arquivo.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-white">Save e Segurança Local</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Exporte ou restaure sua biblioteca, notas, resenhas e grupos. Os dados permanecem no navegador.
        </p>

        {message && (
          <div
            role="status"
            className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs ${
              message.type === 'success'
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">Exportar progresso</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Baixa um arquivo completo chamado <code>omnilog-save.json</code>.
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar save
            </button>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">Carregar progresso</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Escolha se os dados importados substituem ou complementam sua biblioteca.
            </p>
            <label className="mt-3 block text-xs text-neutral-400" htmlFor="import-mode">
              Ação ao importar
            </label>
            <select
              id="import-mode"
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as 'replace' | 'merge')}
              className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200"
            >
              <option value="replace">Substituir tudo</option>
              <option value="merge">Mesclar</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
              accept=".json,application/json"
              className="hidden"
            />
            <button
              type="button"
              onClick={handleChooseFile}
              disabled={isImporting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Selecionar arquivo
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-neutral-400 transition-colors hover:text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
