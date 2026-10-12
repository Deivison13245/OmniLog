# OmniLog — Gerenciador Multimídia Pessoal

O **OmniLog** é um aplicativo web pessoal desenvolvido para registrar, catalogar e acompanhar jogos, filmes, séries, animes, mangás e livros em um único lugar, sem necessidade de servidores na nuvem ou múltiplos usuários.

---

## 1. Principais Funcionalidades

- **Busca Global Unificada**: Pesquise títulos por abas específicas (**Todos**, **Jogos**, **Filmes / Séries**, **Animes**, **Mangás**, **Livros**).
- **Tempo e Estatísticas Detalhadas de Mídia**:
  - 🎮 **Jogos**: Horas estimadas para zerar a história principal e fazer 100% (integração HowLongToBeat).
  - 🎬 **Filmes**: Duração exata em horas e minutos.
  - 📺 **Séries**: Número de temporadas, episódios totais e tempo médio por episódio.
  - 🌟 **Animes**: Contagem total de episódios e duração por episódio.
  - 📖 **Mangás**: Contagem total de capítulos e volumes lançados.
  - 📚 **Livros**: Contagem de páginas e autor.
- **Biblioteca Pessoal**:
  - Classificação por status: **Backlog**, **Em Andamento**, **Concluído** e **Abandonado**.
  - Avaliação privada de 1 a 10 (com conversão em estrelas).
  - Resenhas privadas.
- **Visualização Flexível**:
  - Alternância com um clique entre **Grade** (cards com pôster em proporção 2:3) e **Lista** (tabela compacta).
  - Filtros combinados por status, categoria, grupos e ordenação por data ou título.
- **Coleções & Grupos Customizados**:
  - Crie grupos personalizados com paleta de cores (ex: *"Zerar em 2026"*, *"Favoritos"*) e vincule mídias a múltiplos grupos.
- **Backup e Restauração Local**:
  - Exporte e importe um snapshot completo em arquivo `.json` a qualquer momento para garantir a segurança dos seus dados.

---

## 2. Tecnologias Utilizadas

| Camada | Tecnologia |
| :--- | :--- |
| **Framework Fullstack** | Next.js 16 (App Router) + React 19 |
| **Linguagem** | TypeScript |
| **Estilização** | Tailwind CSS + Lucide Icons (Tema Escuro Nativo) |
| **Banco de Dados Local** | SQLite via `better-sqlite3` (modo WAL) |
| **ORM** | Drizzle ORM |
| **Gerenciamento de Estado & Cache** | TanStack React Query v5 |
| **Validação de Schemas** | Zod |
| **Rate Limiter** | `p-limit` |
| **Testes Automatizados** | Vitest |

---

## 3. Modelo de Banco de Dados

O banco SQLite é inicializado automaticamente na pasta `./data/omnilog.db` com as seguintes tabelas:

- `media`: Armazena metadados e cache das mídias buscadas externamente.
- `library_items`: Itens salvos na sua biblioteca (status, nota, resenha e datas).
- `groups`: Coleções personalizadas criadas por você.
- `library_item_groups`: Relação muitos-para-muitos entre itens da biblioteca e grupos.

---

## 4. Provedores de Dados Externos

- **IGDB (Twitch)**: Base de dados de Jogos.
- **HowLongToBeat**: Estatísticas de tempo para zerar e platinar jogos.
- **TMDB (The Movie Database)**: Base de dados de Filmes e Séries de TV.
- **AniList (GraphQL)**: Base de dados de Animes e Mangás.
- **Open Library & Google Books**: Base de dados de Livros com fallback automático.

---

## 5. Configuração e Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as chaves:

```env
# IGDB (Twitch Developer Console)
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=

# TMDB (The Movie Database)
TMDB_READ_TOKEN=
TMDB_API_KEY=

# Google Books (Opcional - Fallback)
GOOGLE_BOOKS_API_KEY=

# Banco SQLite local
DATABASE_PATH=./data/omnilog.db

# Dias de retenção de cache
CACHE_TTL_DAYS=30
```

> **Nota:** AniList e Open Library são APIs públicas e funcionam imediatamente sem necessidade de chaves.

---

## 6. Como Executar o Projeto

Instale as dependências:
```bash
npm install
```

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

Acesse em seu navegador:
```
http://localhost:3000
```

### Outros Comandos:
- `npm run build`: Cria a versão de produção otimizada.
- `npm test`: Roda a suíte de testes automatizados com Vitest.
