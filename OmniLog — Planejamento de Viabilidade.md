# OmniLog — Planejamento de Viabilidade

Oct 11, 2026 · @Deivison

## Resumo e viabilidade

O OmniLog é viável como MVP gratuito: login, banco de dados e busca em cinco tipos de mídia existem em planos grátis, desde que o projeto seja não comercial e as APIs externas sejam chamadas por um servidor intermediário (proxy).

**Objetivo:** uma plataforma única, simples e rápida para registrar e acompanhar jogos, filmes, séries, animes, mangás e livros, com busca unificada, status (Backlog, Em andamento, Concluído, Abandonado), nota, resenha privada e visualização em grade ou lista.

A viabilidade depende de quatro condições:

1. **Uso não comercial.** IGDB e TMDB são gratuitos apenas para uso não comercial; monetizar o app exige acordo com cada um.
2. **Proxy no servidor.** O IGDB não aceita chamadas diretas do navegador e exige credenciais secretas, então a busca passa por uma função no servidor.
3. **Cache de metadados.** Guardar o resultado das buscas no banco evita estourar limites de requisições e acelera a interface.
4. **Atribuição obrigatória.** TMDB exige logo e aviso de crédito visíveis no app; IGDB pede atribuição para os dados.

Premissa deste plano: um desenvolvedor, dedicação parcial, sem orçamento. Se a equipe ou o tempo forem diferentes, só os prazos da seção de fases mudam.

## Escopo: o que entra no MVP

O MVP cobre os quatro módulos da especificação; recursos extras ficam para depois, para que o primeiro uso real chegue o quanto antes.

| Módulo | No MVP | Depois do MVP (sugestão) |
| --- | --- | --- |
| Autenticação e perfil | Cadastro e login por e-mail/senha e Google (Supabase Auth); perfil com nome, avatar e resumo de progresso | Recuperação de senha personalizada, exclusão de conta com exportação de dados |
| Busca e integração | Campo único, abas por tipo (Todos, Jogos, Filmes/Séries, Animes/Mangás, Livros), cartão com capa, título, ano e botão Adicionar | Busca por código de barras/ISBN, sugestões enquanto digita |
| Biblioteca | Quatro status, nota (1–10 ou 1–5 estrelas), resenha privada, remover item | Datas de início e fim, progresso por episódio, capítulo ou página |
| Filtros e visualização | Filtrar por tipo e status, ordenar por nome ou data de adição, alternar grade e lista | Listas personalizadas, tags, estatísticas e gráficos de consumo |

Fora do escopo por enquanto: funcionalidades sociais (seguir amigos, perfil público), recomendações automáticas e aplicativo nativo.

## Tecnologias necessárias

A stack recomendada concentra tudo em TypeScript e Supabase, para que uma pessoa consiga manter front-end, proxy e banco sem trocar de linguagem. As APIs de mídia estão na próxima seção.

| Camada | Tecnologia | Para que serve | Alternativa |
| --- | --- | --- | --- |
| Linguagem | TypeScript | Tipagem do front e do proxy; menos erros ao lidar com respostas de APIs diferentes | JavaScript puro |
| Front-end | Next.js (React) | Interface, rotas e as funções de servidor que fazem o proxy | React + Vite com Supabase Edge Functions |
| Estilo | Tailwind CSS | Layout responsivo, grade e lista, tema claro/escuro | CSS Modules |
| Estado de servidor | TanStack Query | Cache das buscas, estados de carregamento e atualização otimista ao mudar status | SWR |
| Formulários e validação | React Hook Form + Zod | Nota, resenha e validação das respostas das APIs | Validação manual |
| Banco de dados | Supabase (PostgreSQL) | Tabelas de mídia e biblioteca, índices, Row Level Security | Neon, PlanetScale |
| Autenticação | Supabase Auth | E-mail/senha e login com Google (OAuth) | Auth.js, Clerk |
| Armazenamento | Supabase Storage | Avatar do usuário | Gravatar |
| Proxy de APIs | Route Handlers do Next.js | Guardam segredos, evitam bloqueio de CORS e aplicam cache e limite de requisições | Supabase Edge Functions (Deno) |
| Hospedagem | Vercel (plano gratuito) | Deploy automático a cada push | Netlify, Cloudflare Pages |
| Controle de versão e CI | Git, GitHub, GitHub Actions | Branches, revisão, lint e testes automáticos | GitLab CI |
| Qualidade | ESLint, Prettier, Vitest, Testing Library, Playwright | Padrão de código, testes unitários e testes de ponta a ponta | Jest, Cypress |
| Design e gestão | Figma, GitHub Projects | Wireframes das telas e quadro Kanban das tarefas | Penpot, Trello |
| Monitoramento | Sentry (plano gratuito), logs da Vercel | Erros em produção e falhas de API | Logs do Supabase |

Contas e chaves a criar antes de começar: Supabase, GitHub, Vercel, Google Cloud (login com Google e, se usar, Google Books), Twitch Developer (IGDB) e TMDB. Segredos ficam em variáveis de ambiente do servidor, nunca no código do navegador.

## APIs externas: o que cada uma exige

Cinco APIs cobrem as seis categorias de mídia, todas gratuitas no uso pessoal; as restrições que mais afetam o projeto são o proxy obrigatório do IGDB e a atribuição do TMDB.

| Mídia | API | Acesso | Limites e termos | Observação |
| --- | --- | --- | --- | --- |
| Jogos | [IGDB](https://api-docs.igdb.com/) | Conta Twitch com verificação em duas etapas, Client ID e Secret (OAuth2) | Grátis só para uso não comercial; 4 requisições por segundo, até 8 abertas | Não aceita chamadas do navegador (sem CORS): proxy obrigatório; pede atribuição visível |
| Filmes e séries | [TMDB](https://developer.themoviedb.org/docs/getting-started) | Chave ou token de leitura | Grátis para uso não comercial, com logo e aviso de crédito; os termos limitam o cache dos dados a 6 meses | Uso comercial exige contato com o TMDB; tratar erro 429 com nova tentativa |
| Animes e mangás | [AniList](https://docs.anilist.co/guide/rate-limiting) | Sem chave para leitura pública (GraphQL) | 90 requisições por minuto; a documentação avisa que o limite pode cair para 30 por minuto em período de instabilidade | Planejar para 30 por minuto e cachear tudo; uma consulta GraphQL pode trazer vários campos de uma vez |
| Livros (principal) | Open Library | Sem chave | Aberta, sem cota formal; a busca só devolve ISBN, editora e páginas se os campos forem pedidos | Capas por endereço próprio de capas; boa cobertura de edições |
| Livros (reserva) | Google Books | Chave gratuita própria | Sem chave, a cota compartilhada costuma esgotar e devolve erro 429 | Usar só como reserva quando o Open Library não achar o título |

**Como integrar sem acoplar o app às APIs**

- **Adaptador por API.** Cada fonte tem um módulo que converte a resposta para um formato único: fonte, id externo, tipo, título, ano e capa.
- **Busca em paralelo.** O proxy consulta as fontes do filtro escolhido ao mesmo tempo, com tempo máximo por fonte; se uma falhar, as outras ainda aparecem e a tela avisa qual ficou de fora.
- **Cache no banco.** Resultados e detalhes ficam em uma tabela de cache com validade (sugestão: 30 dias, abaixo do teto de 6 meses do TMDB); a busca consulta o cache antes de chamar a API.
- **Controle de ritmo.** Um limitador de requisições por fonte no proxy respeita 4 por segundo no IGDB e o limite mais baixo do AniList.
- **Debounce na interface.** A busca só dispara depois de uma pausa na digitação, o que reduz chamadas.
- **Atribuição.** Rodapé com os créditos exigidos (TMDB com logo, IGDB, AniList, Open Library).

## Modelo de dados e segurança

Três tabelas bastam para o MVP, e as regras de acesso (Row Level Security) garantem que cada pessoa só enxergue a própria biblioteca e as próprias resenhas.

| Tabela | Campos principais | Regra de acesso |
| --- | --- | --- |
| profiles | id (igual ao usuário do Auth), nome de usuário, avatar, data de criação | Cada pessoa lê e edita só o próprio perfil |
| media | id, fonte (igdb, tmdb, anilist, openlibrary), id externo, tipo, título, ano, capa, dados extras (JSON), data da última atualização; único por fonte + id externo | Leitura para usuários logados; escrita só pelo servidor, com a chave de serviço |
| library\_items | id, usuário, mídia, status, nota, resenha, data de adição e de alteração; único por usuário + mídia | Cada pessoa lê, cria, edita e apaga só as próprias linhas (usuário igual a quem está logado) |

Decisões de modelagem:

- **Status como lista fechada:** backlog, em andamento, concluído, abandonado, com restrição no banco para impedir valores inválidos.
- **Nota com restrição de faixa:** guardar de 1 a 10 e, se a interface escolher estrelas, exibir como 1 a 5.
- **Mídia compartilhada:** o mesmo título salvo por vários usuários aponta para uma única linha em media, o que poupa os 500 MB do plano gratuito do Supabase.
- **Índices:** usuário + status e usuário + data de adição, porque os filtros do painel usam essas combinações.
- **Segredos:** chaves do IGDB, TMDB e Google ficam só no servidor; o navegador recebe apenas a chave pública do Supabase.
- **Limite do plano gratuito:** o projeto pausa após uma semana sem uso; antes de uma demonstração, abrir o app com antecedência ou agendar uma consulta simples periódica.

## Métodos e práticas

O projeto combina uma gestão ágil leve com padrões de arquitetura que resolvem os dois problemas centrais: várias APIs diferentes e limites de requisições.

| Método ou padrão | Onde aplicar | O que entrega |
| --- | --- | --- |
| Kanban com iterações de 1 semana | Gestão das tarefas no GitHub Projects (A fazer, Fazendo, Revisão, Feito) | Progresso visível e escopo ajustável a cada semana |
| Priorização MoSCoW | Separar o que é obrigatório no MVP do que pode esperar | Escopo fechado e cortes decididos antes de faltar tempo |
| Histórias de usuário com critérios de aceite | Cada funcionalidade da especificação (ex.: Como usuário, quero mover um item para Concluído) | Definição objetiva de pronto |
| Wireframes e protótipo, mobile-first | Telas de busca, dashboard (grade e lista) e detalhe do item, no Figma | Layout validado antes de programar |
| Padrão adaptador | Um módulo por API de mídia, todos devolvendo o mesmo formato | Trocar ou acrescentar uma API sem mexer na interface |
| Proxy no servidor (BFF) | Rotas que recebem a busca, chamam as APIs e devolvem JSON limpo | Segredos protegidos e sem bloqueio de CORS |
| Cache-aside com validade | Tabela media: consultar o cache, chamar a API só se faltar ou vencer | Menos chamadas, busca mais rápida |
| Limitador de requisições (token bucket) e retry com espera crescente | Chamadas ao IGDB e ao AniList | Respeito aos limites e tolerância a erros 429 |
| Atualização otimista | Mudar status ou nota na interface antes da confirmação do servidor | Sensação de resposta instantânea |
| Migrações versionadas e Row Level Security | Esquema do banco gerenciado pela CLI do Supabase e guardado no Git | Banco reproduzível e dados isolados por usuário |
| Fluxo com branches curtas, pull requests e Conventional Commits | Todo o código no GitHub | Histórico legível e revisão antes de integrar |
| Integração e entrega contínuas | GitHub Actions: lint, testes e build a cada pull request; deploy automático na Vercel | Falhas detectadas antes de ir ao ar |
| Pirâmide de testes | Unitários nos adaptadores (com respostas simuladas), integração das regras de acesso, ponta a ponta no cadastro, busca e adição | Confiança para mudar o código |
| Teste de usabilidade | 3 a 5 pessoas usando o MVP com tarefas simples | Ajustes de interface antes da versão final |
| Desempenho | Lighthouse, paginação ou rolagem infinita, imagens com carregamento tardio | Painel rápido mesmo com bibliotecas grandes |
| Privacidade e LGPD | Coletar o mínimo, resenha privada por padrão, opção de excluir conta e dados | Conformidade básica com a lei brasileira |
| Registro de decisões (ADR) e README | Por que Next.js, por que Open Library, como rodar o projeto | Projeto fácil de retomar e de apresentar |

## Riscos e mitigações

Os riscos mais sérios vêm de fora do código: termos de uso das APIs e limites de requisições.

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Termos de IGDB e TMDB permitem só uso não comercial | Alto, se o projeto for monetizado | Manter o projeto não comercial; se isso mudar, negociar com cada API antes ou trocar de fonte |
| Conta Twitch exigir verificação em duas etapas e atrasar o acesso ao IGDB | Médio | Criar a conta e testar a primeira chamada na semana 1 |
| AniList reduzir o limite (a documentação cita 30 por minuto em instabilidade) | Médio | Cache agressivo, limitador no proxy, uma consulta por busca |
| Google Books esgotar a cota compartilhada | Baixo | Open Library como fonte principal; chave própria só para a reserva |
| Projeto do Supabase pausar por uma semana sem uso | Médio | Consulta periódica simples ou abrir o app antes de demonstrações |
| Passar dos 500 MB do banco | Baixo no MVP | Guardar só metadados essenciais, mídia compartilhada entre usuários, monitorar o tamanho |
| Mesmo título aparecer em duas fontes (filme e anime, por exemplo) | Médio | Campo de tipo em cada resultado e deduplicação só dentro do mesmo tipo |
| Capas lentas ou quebradas | Baixo | Imagem de reserva, carregamento tardio e tamanhos reduzidos |
| Cache de TMDB acima do prazo permitido | Médio | Validade de 30 dias e rotina que apaga ou atualiza dados antigos |
| Vazamento de chaves | Alto | Chaves só em variáveis de ambiente do servidor, verificação de segredos no GitHub |
| Escopo crescer durante o desenvolvimento | Alto | MoSCoW, MVP congelado após a fase 1 e novas ideias no backlog |
