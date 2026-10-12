import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Link from 'next/link';
import { Library, Search, Layers } from 'lucide-react';

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
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-100 antialiased`}>
        <Providers>
          <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-bold text-lg text-emerald-400">
                <Layers className="h-6 w-6" />
                <span>OmniLog</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium">
                <Link
                  href="/"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  <Library className="h-4 w-4" />
                  Biblioteca
                </Link>
                <Link
                  href="/search"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500 transition-colors shadow-sm"
                >
                  <Search className="h-4 w-4" />
                  Buscar Mídia
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
