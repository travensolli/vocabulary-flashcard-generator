# Vocabulary Flashcard Generator

Aplicação web que gera flashcards de vocabulário infantil usando IA generativa (Google Gemini). Suporta dois modos de ilustração — **preto e branco** e **colorido** — com download individual de cada cartão gerado.

---

## Sumário
- [Stack & Requisitos](#stack--requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Execução & Scripts](#execução--scripts)
- [Uso](#uso)
- [Arquitetura & Estrutura](#arquitetura--estrutura)
- [Testes & Qualidade](#testes--qualidade)
- [Deploy](#deploy)
- [Troubleshooting](#troubleshooting)
- [Contribuição](#contribuição)
- [Melhorias Futuras](#melhorias-futuras)
- [Licença](#licença)
- [Changelog](#changelog)

---

## Stack & Requisitos

### Essenciais para Instalação
Para clonar e rodar este projeto em sua máquina, você precisará ter instalado:
- **[Git](https://git-scm.com/downloads)**: Para clonar o repositório.
- **[Node.js](https://nodejs.org/) (≥ 18)**: Execução de javascript e gerenciador de pacotes `npm` incluso.

### Tecnologias Utilizadas
| Tecnologia | Versão |
|------------|--------|
| React | 19 |
| Vite | 6 |
| TypeScript | ~5.8 |
| Express | ^5.2.1 |
| @google/genai | ^1.38.0 |
| Gerenciador de pacotes | npm |
| CSS | Tailwind CSS (via CDN) |
| Testes | Vitest + jsdom |

---

## Instalação

```bash
# clonar o repositório
git clone https://github.com/travensolli/vocabulary-flashcard-generator.git
cd vocabulary-flashcard-generator

# instalar dependências
npm install
```

---

## Configuração

### 1. Obter a Chave da API do Gemini

A aplicação utiliza o **Google Gemini** para gerar as imagens. Siga os passos para obter sua chave gratuitamente:
1. Acesse o **[Google AI Studio](https://aistudio.google.com/)**.
2. Faça login com sua conta do Google.
3. No painel principal ou no menu esquerdo, clique em **"Get API key"**.
4. Clique no botão azul **"Create API key"** (você pode precisar criar um projeto no Google Cloud caso ainda não tenha).
5. Copie a chave gerada.

### 2. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as variáveis abaixo (cole a sua chave no lugar indicado):

```env
GEMINI_API_KEY=<sua-chave-copiada-do-ai-studio>
GEMINI_MODEL=gemini-2.5-flash-image   # opcional
```

| Variável | Obrigatória | Default | Descrição |
|----------|:-----------:|---------|-----------|
| `GEMINI_API_KEY` | ✅ | — | Chave da API Google Gemini. Utilizada com segurança apenas no backend (Node.js). |
| `GEMINI_MODEL` | ❌ | `gemini-2.5-flash-image` | Modelo Gemini utilizado para geração de imagens. |

> [!IMPORTANT]
> O arquivo `.env.local` está no `.gitignore` e agora é lido apenas pelo servidor Express, garantindo que a chave não seja exposta ao front-end.

---

## Execução & Scripts

| Script | Comando | Descrição |
|--------|---------|-----------|
| Dev server | `npm run dev` | Inicia o frontend em `localhost:3000` (Vite) e o backend em `localhost:3001` (com proxy automático). |
| Build (Full) | `npm run build` | Gera bundle de produção em `dist/` (frontend) e compila o servidor TypeScript em `dist-server/`. |
| Start (Prod) | `npm start` | Inicia o servidor Node compilado, que atende a API e serve a aplicação estática. |
| Preview | `npm run preview` | Serve localmente o frontend via Vite. |
| Testes | `npm run test` | Executa os testes unitários do código agnóstico com Vitest. |

```bash
# workflow mais comum durante o desenvolvimento
npm run dev
```

---

## Uso

1. Inicie o servidor local com `npm run dev`.
2. Acesse `http://localhost:3000` no navegador.
3. Digite uma lista de palavras separadas por vírgula (ex.: `apple, book, car`).
4. (Opcional) Ative o toggle **🎨 Colored flashcards** para gerar cartões coloridos.
5. Clique em **Generate Flashcards**.
6. Aguarde a geração — as requisições são enviadas em lotes de 4 itens simultâneos.
7. Passe o mouse sobre cada cartão e clique em **Download** para salvar a imagem.

> [!NOTE]
> - O limite padrão é de **20 itens** por geração (definido em `utils/items.ts`).
> - Duplicatas (case-insensitive) são automaticamente removidas.
> - Cada item aceita no máximo **60 caracteres**.
> - Nomes de download seguem o padrão `<palavra>_flashcard.png` ou `<palavra>_color_flashcard.png`.

---

## Arquitetura & Estrutura

Aplicação Fullstack simples:
- **Frontend (React + Vite)**: Interface do usuário para inserção de palavras.
- **Backend (Express)**: Proxy seguro que detém a `GEMINI_API_KEY` e chama a Google GenAI API.

```
.
├── .env.local                # Variáveis de ambiente (lidas pelo Express)
├── server/
│   └── server.ts             # Backend Express (rotas base /api/*)
├── src/                      # (se aplicável), mas projeto raiz tem:
├── components/               # Componentes UI (React)
├── services/
│   └── geminiService.ts      # Fetch call para o nosso backend Node
├── utils/                    # Funções agnósticas (dedup)
├── dist/                     # Saída do build Vite (Frontend)
├── dist-server/              # Saída do build tsc (Backend)
```

### Fluxo de dados

```mermaid
flowchart LR
    A[UI React] -->|POST /api/generate| B[Express Server]
    B -->|SDK GenAI| C[Google Gemini API]
    C -->|Base64 Image| B
    B -->|JSON {url}| A
```

---

## Testes & Qualidade

O projeto utiliza **Vitest** com ambiente **jsdom**.

```bash
# executar todos os testes
npm run test
```

| Arquivo | Cobertura |
|---------|-----------|
| `__tests__/geminiService.test.ts` | Extração de dados de imagem da resposta Gemini |
| `__tests__/items.test.ts` | Parsing, deduplicação e limite de itens |

> [!TIP]
> Para rodar os testes em modo watch durante o desenvolvimento: `npx vitest --watch`

---

## Deploy

Como a aplicação agora possui um servidor Node.js, ela deve ser hospedada em serviços que suportem Node:

1. Configure a variável `GEMINI_API_KEY` na plataforma de hospedagem (Render, Railway, Heroku, etc).
2. O comando de **build** deve ser o padrão `npm run build` (que faz build do front e back).
3. O comando de **inicialização** deve ser `npm start`.

> [!NOTE]
> Para hosts estáticos puros (como Vercel/Netlify sem backend Serverless extra), considere migrar a lógica de `server/server.ts` para arquivos como `api/generate.ts` (convenção Edge/Serverless da Vercel).

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `Gemini API key missing` | Defina `GEMINI_API_KEY` em `.env.local` e reinicie o dev server. |
| Falha ao gerar imagens | Verifique chave, quota e conectividade. O serviço tenta até **3 vezes** com back-off exponencial para erros transitórios (429, 500, 503, timeout). |
| Saída vazia / nenhum cartão | Confirme que a lista não está vazia e está separada por vírgulas. Items com mais de 60 caracteres são rejeitados. |
| Imagem retornada como texto | Verifique os logs do console — o modelo pode ter respondido com texto em vez de imagem. Tente novamente ou altere o `GEMINI_MODEL`. |

---

## Contribuição

1. Fork o repositório.
2. Crie uma branch: `git checkout -b feature/minha-feature`.
3. Faça commit das alterações: `git commit -m "feat: descrição"`.
4. Push para a branch: `git push origin feature/minha-feature`.
5. Abra um Pull Request.

> TODO: Definir padrões de código (ESLint/Prettier), checklist de PR e templates de issues.

---

## Melhorias Futuras

- Criação de perfil de usuário para personalizar preferências.
- Persistência de flashcards já gerados para reutilização em solicitações idênticas.
- Opções avançadas de saída: nível de detalhes do desenho, estilos adicionais.
- Proxy/backend para proteger a chave da API em produção.

---

## Licença

TODO: Adicionar arquivo `LICENSE` e badge correspondente.

---

## Changelog

| Data | Alteração |
|------|-----------|
| 2026-02-22 | Adicionado modo de flashcards coloridos (`isColored` toggle). |
| 2026-02-22 | Melhoria nos prompts do Gemini para consistência visual (Montserrat 800, layout fixo). |
| 2026-02-22 | README reescrito seguindo template padronizado. |
