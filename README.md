# Vocabulary Flashcard Generator <!-- TODO: adicionar badges de build/licença -->

Aplicação web que gera flashcards em preto e branco para vocabulário infantil usando o modelo de imagem Gemini.

## Sumário
- [Stack & Requisitos](#stack--requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Execução & Scripts](#execução--scripts)
- [Uso](#uso)
- [API](#api)
- [Arquitetura & Estrutura](#arquitetura--estrutura)
- [Testes & Qualidade](#testes--qualidade)
- [Deploy](#deploy)
- [Troubleshooting](#troubleshooting)
- [Contribuição](#contribuição)
- [Melhorias Futuras](#melhorias-futuras)
- [Licença](#licença)
- [Changelog](#changelog)

## Stack & Requisitos
- Frontend: React 19 + Vite 6
- Linguagem: TypeScript 5.8
- SDK de IA: @google/genai (modelo gemini-2.5-flash-image)
- Gerenciador: npm (scripts em package.json)
- TODO: Documentar versão de Node.js testada

## Instalação
```bash
# instalar dependências
npm install
```

## Configuração
| Variável | Obrigatória | Default | Descrição |
|----------|-------------|---------|-----------|
| VITE_GEMINI_API_KEY | sim | — | Chave da API Gemini para builds Vite |
| GEMINI_API_KEY | sim (fallback Node) | — | Nome alternativo para contexts Node/SSR |

Crie `.env.local` e defina ao menos uma das chaves acima.

## Execução & Scripts
```bash
# dev server com hot reload
npm run dev

# build de produção (saída em dist/)
npm run build

# preview local do build
npm run preview
```

## Uso
1) Inicie o dev server (`npm run dev`) e abra a URL indicada.
2) Digite uma lista de palavras separadas por vírgula (ex.: `apple, book, car`).
3) Envie para gerar os flashcards; baixe cada imagem pelo botão de download.

## API
Aplicação somente UI; nenhum endpoint HTTP exposto. TODO: Documentar caso APIs sejam adicionadas.

## Arquitetura & Estrutura
SPA em React: recebe entrada textual, chama Gemini para cada item e renderiza cartões baixáveis.
```
.
├─ App.tsx                  # Shell da página, estado e orquestração das requisições
├─ components/
│  ├─ GeneratorForm.tsx     # Formulário de entrada e CTA
│  ├─ Header.tsx            # Hero/título
│  ├─ ImageGrid.tsx         # Galeria com download
│  ├─ Spinner.tsx           # Indicador de loading
│  └─ Icons.tsx             # Ícones SVG inline
├─ services/
│  └─ geminiService.ts      # Prompt + chamada @google/genai (retorna data URI)
└─ types.ts                 # Tipos compartilhados (CardData)
```

## Testes & Qualidade
- Não há testes automatizados configurados. TODO: adicionar testes unitários para geminiService e componentes.

## Deploy
- Gerar artefatos com `npm run build` (saída em `dist/`).
- Servir `dist/` em qualquer host estático (Vercel, Azure Static Web Apps, Netlify, GitHub Pages, etc.).
- Garantir `VITE_GEMINI_API_KEY` no ambiente de hospedagem.
- TODO: Documentar pipeline/CI se existente.

## Troubleshooting
- Erro `GEMINI_API_KEY ... not set` → Defina `VITE_GEMINI_API_KEY` (ou `GEMINI_API_KEY`) em `.env.local` e reinicie.
- Falha ao gerar imagens → Verifique chave, quota e rede; tente novamente após breve intervalo.
- Saída vazia → Confirme lista não vazia e separada por vírgulas.

## Contribuição
- Fluxo padrão GitHub: branch, commit, PR.
- TODO: Adicionar padrões de código, checklist de PR e templates de issues.

## Melhorias Futuras
- Criação de perfil de usuário para personalizar preferências.
- Persistência de flashcards já gerados para reutilização em solicitações idênticas.
- Formulário com opções de saída colorida ou preto e branco e nível de detalhes do desenho.

## Licença
TODO: Adicionar arquivo de licença e badge correspondente.

## Changelog
- TODO: Adicionar histórico de releases.
