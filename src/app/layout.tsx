import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Link from 'next/link';
import { Library, Search, Layers, BarChart3 } from 'lucide-react';
import { SaveFileStatus } from '@/components/SaveFileStatus';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OmniLog — Sua Biblioteca Pessoal',
  description: 'Gerenciador pessoal de jogos, filmes, séries, animes, mangás e livros.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-100 antialiased flex flex-col justify-between`}>
        <Providers>
          <div>
            <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
              <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-lg text-emerald-400">
                  <Layers className="h-6 w-6" />
                  <span>OmniLog</span>
                </Link>
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <nav className="flex items-center gap-2 text-sm font-medium sm:gap-3">
                    <Link
                      href="/"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                    >
                      <Library className="h-4 w-4" />
                      Biblioteca
                    </Link>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/search"
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-white shadow-sm transition-colors hover:bg-emerald-500"
                    >
                      <Search className="h-4 w-4" />
                      Buscar Mídia
                    </Link>
                  </nav>
                  <SaveFileStatus />
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
          </div>

          {/* Rodapé com Atribuições Legais Obrigatórias (Seção de Termos do Artefato) */}
          <footer className="border-t border-neutral-900 bg-neutral-950 py-6 text-center text-xs text-neutral-500 px-4">
            <div className="mx-auto max-w-4xl space-y-1.5 leading-relaxed">
              <p>
                Dados de jogos por <strong>IGDB</strong>. Filmes e séries por <strong>TMDB</strong> (este produto usa a API do TMDB, mas não é endossado nem certificado por ele).
              </p>
              <p>
                Dados de streaming por <strong>JustWatch</strong>. Tempos de jogo por <strong>HowLongToBeat</strong>, quando ativado. Animes e mangás por <strong>AniList</strong> (aplicativo não oficial). Livros por <strong>Open Library</strong> e Google Books.
              </p>
              <p className="text-[11px] text-neutral-600 pt-1">
                OmniLog — Aplicação local-first focada em privacidade. Seus dados e resenhas permanecem no seu navegador.
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
