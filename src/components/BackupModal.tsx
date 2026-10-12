'use client';

import React, { useRef, useState } from 'react';
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function BackupModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setMessage(null);
      const res = await fetch('/api/backup/export');
      if (!res.ok) throw new Error('Falha ao exportar backup');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `omnilog-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setMessage({ type: 'success', text: 'Arquivo de backup exportado e baixado com sucesso!' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Não foi possível gerar o arquivo de backup.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setMessage(null);

      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao importar backup');
      }

      const result = await res.json();
      setMessage({
        type: 'success',
        text: `Backup restaurado com sucesso! (${result.importedMedia} mídias processadas)`,
      });

      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch (err: unknown) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Arquivo de backup inválido ou corrompido.',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-white">Backup e Segurança Local</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Exporte um arquivo com todos os seus registros, notas, resenhas e coleções para guardar com segurança ou restaurar a qualquer momento.
        </p>

        {message && (
          <div
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
          {/* Botão de Exportar */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">Exportar Dados Locais</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Gera um arquivo <code>.json</code> completo com toda a sua biblioteca.
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar Arquivo de Backup (.json)
            </button>
          </div>

          {/* Botão de Importar / Restaurar */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <h3 className="text-sm font-semibold text-neutral-200">Restaurar de um Arquivo</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Carregue um arquivo de backup previamente exportado.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar / Restaurar Backup
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
