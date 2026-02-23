# Vocabulary Flashcard Generator ![Version](https://img.shields.io/badge/version-0.0.0-blue) ![License](https://img.shields.io/badge/license-TODO-lightgrey)

Aplicação web que gera flashcards de vocabulário infantil usando IA generativa (Google Gemini) com diferentes estilos de ilustração, desde cartões simplificados até representações fotorrealísticas.

## Sumário
- [Stack & Requisitos](#stack--requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Execução](#execução)
- [Uso](#uso)
- [API](#api)
- [Arquitetura](#arquitetura)
- [Testes & Qualidade](#testes--qualidade)
- [Deploy](#deploy)
- [Troubleshooting](#troubleshooting)
- [Contribuição](#contribuição)
- [Licença](#licença)
- [Changelog](#changelog)

## Stack & Requisitos
- **Linguagem/Runtime**: TypeScript (~5.8.2), Node.js (≥ 18)
- **Gerenciador**: npm
- **Frontend**: React (^19.2.4), Vite (^6.2.0)
- **Backend**: Express, @google/genai (^1.38.0)
- **Testes**: Vitest (^2.1.4), jsdom (^28.1.0)

## Instalação
```bash
# Clonar o repositório
git clone https://github.com/travensolli/vocabulary-flashcard-generator.git
cd vocabulary-flashcard-generator

# Instalar dependências
npm install
```

## Configuração
| Variável | Obrigatória | Default | Descrição |
|---------|-------------|---------|-----------|
| `PORT` | não | `3001` | Porta onde o servidor Node será executado. |
| `GEMINI_API_KEY` | não (se via UI) | — | Chave da API Gemini. Pode ser inserida diretamente na interface de usuário. |
| `GEMINI_MODEL` | não | `gemini-2.5-flash-image` | Modelo padrão Gemini utilizado para geração de imagens caso não seja especificado. |

## Execução
```bash
# dev workflow
npm run dev

# build (gerar bundle do frontend)
npm run build

# test
npm run test

# preview
npm run preview
```

## Uso
```bash
# 1. Inicie a aplicação localmente
npm run dev

# 2. Acesse http://localhost:3000
# 3. Insira sua chave da API Gemini (Google AI Studio) na interface.
# 4. Ajuste os níveis de realismo e as cores da ilustração.
# 5. Digite listas de palavras (ex: "apple, sun, house").
# 6. Gere os cartões e clique na imagem resultante para baixá-la via browser.
```

## API
| Método | Rota | Descrição | Auth | Exemplo |
|--------|------|-----------|------|---------|
| POST | `/api/generate` | Recebe prompt formatado e retorna res URL do flashcard. | Body (`apiKey`) | `{ "item": "apple", "isColored": true, "realism": 2, "apiKey": "<sua_chave>" }` |

## Arquitetura
Aplicação Fullstack simples: Frontend com React (Vite) interagindo com um Backend que cuida dos prompts de sistema e lógica do Google GenAI.

```
.
├── components/          # Componentes visuais UI (React)
├── server/
│   └── server.ts        # Backend Express servindo a API do Gemini
├── services/
│   └── geminiService.ts # Camada de conexão do Frontend disparando requisições REST
├── utils/               # Arquivos utilitários (ex: tratativa de items)
├── dist/                # Saída do build Vite (Frontend) -> Criada em npm run build
└── dist-server/         # Saída do build tsc (Backend) -> Criada em tsc build (se houver config ativa)
```

## Testes & Qualidade
Suporte a ambiente de testes isolado usando Vitest com jsdom.

```bash
# Executar todos os testes
npm run test

# Executar testes em modo watch (interativo dev)
npx vitest --watch
```

## Deploy
- **Ambiente de hospedagem Node**: Configure a variável `GEMINI_API_KEY` (se desejar hardcodar no backend) ou instrua o cliente a colocar em UI.
- **Produção**: O servidor `server/server.ts` tentará servir os estáticos da pasta `dist/` gerada pelo comando `npm run build` quando a variável de SO `NODE_ENV` for `production`.
> TODO: Esclarecer scripts npm como `start` caso sejam inseridos posteriormente.

## Troubleshooting
- **Problema**: `Gemini API key is missing. Please provide your API key in the application settings.`
  - **Solução**: Preencha o input da API Key na interface (Settings). A chave não precisa mais ficar fixa no backend.
- **Problema**: Erros 429 ou Falha de Download de Imagens.
  - **Solução**: O servidor possui *retries* exponenciais automáticos de até 2 tentativas para atenuar erros rate limiting (429) do Gemini. Aguarde.

## Contribuição
1. Fork o repositório.
2. Crie uma branch: `git checkout -b feature/minha-feature`.
3. Faça commit das alterações: `git commit -m "feat: descrição"`.
4. Push para a branch: `git push origin feature/minha-feature`.
5. Abra um Pull Request.
> TODO: Definir padrões de código, checklist de PR e templates de issues.

## Licença
TODO: Adicionar arquivo LICENSE e configurar o registro formal.

## Changelog
- 2026-02-23 – Integração finalizada da UI para envio de chave de API dinâmica do Gemini; remoção opcional de estado estático no formulário.
- 2026-02-22 – Adicionado controle fino de estilos de ilustração (Realism Level 1-5).
- 2026-02-22 – Suporte para imagens coloridas via backend e frontend express.
