# Revisão de Código — vocabulary-flashcard-generator

## Resumo Executivo
- API key exposta no front-end e erro de import bloqueia o build quando a env não está presente.
- Tratamento frágil da resposta do modelo: ausência de checagens para `candidates`/`content` causa falhas em tempo de execução.
- Geração paralela sem limites e fail-fast: qualquer erro cancela todas as imagens e pode disparar estouro de concorrência/quotas.
- Chaves de lista instáveis e validação de entrada ausente prejudicam usabilidade/manutenção.
- Ausência de testes e observabilidade básica impede detectar regressões e erros de geração.

## Índice de Achados
| # | Severidade | Categoria | Arquivo | Título |
|---|------------|----------|---------|--------|
| 1 | Alta | Segurança | services/geminiService.ts#L2-L13 | API key exposta no client e erro de import |
| 2 | Média | Corretude | services/geminiService.ts#L63-L88 | Falta de checagem da resposta do modelo |
| 3 | Média | Performance | App.tsx#L15-L42 | Concorrência ilimitada e falha total em lote |
| 4 | Baixa | Manutenibilidade | components/ImageGrid.tsx#L14-L31 | Uso de índice como key na lista |
| 5 | Baixa | Testes | [Não informado] | Sem testes para fluxos críticos |

## Achados Detalhados
### 1 — API key exposta no client e erro de import
**Severidade:** Alta  
**Categoria:** Segurança  
**Localização:** services/geminiService.ts#L2-L13  
**Descrição:** A SDK é instanciada no front-end, exigindo `VITE_GEMINI_API_KEY` no bundle. Isso expõe a chave ao usuário final e, na ausência da env, lança erro em tempo de import, quebrando `npm run dev`.  
**Recomendação:** Mover a chamada de geração para um backend/proxy (Cloud Function/Edge) que injete a chave no servidor. No front, chamar um endpoint sem segredo. Enquanto isso, trocar o throw por erro lazy no handler para não quebrar o build.  
**Exemplo (diff sugerido):**
```diff
- if (!apiKey) {
-   throw new Error("GEMINI_API_KEY (or VITE_GEMINI_API_KEY) environment variable not set");
- }
+ if (!apiKey) {
+   console.warn("Gemini API key not set; generation will fail until configured.");
+ }
+
+ const assertApiKey = () => {
+   if (!apiKey) throw new Error("Gemini API key missing. Set VITE_GEMINI_API_KEY.");
+ };
 
- const ai = new GoogleGenAI({ apiKey });
+ const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
```
**Impacto esperado:** Evita quebra de build/local dev e reduz exposição de segredo quando migrar para backend.  
**Referências:** [OWASP API4:2019 Lack of Resources & Rate Limiting](https://owasp.org/API-Security/editions/2019/en/0x08-api4-lack-of-resources-and-rate-limiting/), [Google AI Studio security guidance](https://ai.google.dev/gemini-api/docs/security).

### 2 — Falta de checagem da resposta do modelo
**Severidade:** Média  
**Categoria:** Corretude  
**Localização:** services/geminiService.ts#L63-L88  
**Descrição:** O código assume `response.candidates[0].content.parts` sempre definido. Respostas vazias ou filtradas retornam `undefined`, causando TypeError antes do `throw` planejado.  
**Recomendação:** Validar estrutura da resposta, usar optional chaining e erro descritivo.  
**Exemplo (diff sugerido):**
```diff
-        for (const part of response.candidates[0].content.parts) {
+        const candidates = response.candidates ?? [];
+        const parts = candidates[0]?.content?.parts ?? [];
+        for (const part of parts) {
             if (part.inlineData) {
                 const base64EncodeString: string = part.inlineData.data;
                 const mimeType = part.inlineData.mimeType;
                 return `data:${mimeType};base64,${base64EncodeString}`;
             }
         }
 
-        throw new Error(`No image data found in response for item: ${item}`);
+        throw new Error(`No image data found in response for item: ${item}`);
```
**Impacto esperado:** Elimina falhas inesperadas e produz mensagens acionáveis para o usuário/log.  
**Referências:** [Google Gemini API response format](https://ai.google.dev/gemini-api/docs/vision?lang=node).

### 3 — Concorrência ilimitada e falha total em lote
**Severidade:** Média  
**Categoria:** Performance  
**Localização:** App.tsx#L15-L42  
**Descrição:** `Promise.all` dispara requisições em paralelo sem limite para cada item da lista. Um único erro invalida todas as gerações e perde resultados parciais. Em listas grandes, isso pode estourar quota ou lentificar o navegador.  
**Recomendação:** Impor limite de paralelismo (p. ex., 3–4) e usar `Promise.allSettled` para retornar itens bem-sucedidos.  
**Exemplo (diff sugerido):**
```diff
-      const promises = items.map(async (item) => {
-        const imageUrl = await generateFlashcard(item);
-        return { url: imageUrl, name: item };
-      });
-
-      const results = await Promise.all(promises);
-      setGeneratedCards(results);
+      const limit = 4;
+      const batches: CardData[] = [];
+      for (let i = 0; i < items.length; i += limit) {
+        const slice = items.slice(i, i + limit);
+        const settled = await Promise.allSettled(
+          slice.map(async (item) => ({ url: await generateFlashcard(item), name: item }))
+        );
+        settled.forEach((res) => res.status === "fulfilled" && batches.push(res.value));
+      }
+      setGeneratedCards(batches);
```
**Impacto esperado:** Menor risco de throttling/erros em massa e preservação dos itens gerados com sucesso.  
**Referências:** [MDN Promise.allSettled](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled).

### 4 — Uso de índice como key na lista
**Severidade:** Baixa  
**Categoria:** Manutenibilidade  
**Localização:** components/ImageGrid.tsx#L14-L31  
**Descrição:** `key={index}` quebra reconciliação estável quando a lista muda, podendo reusar DOM incorretamente.  
**Recomendação:** Use um identificador estável (ex.: slug do nome).  
**Exemplo (diff sugerido):**
```diff
-      {cards.map((card, index) => (
-        <div key={index} className="group ...">
+      {cards.map((card) => (
+        <div key={card.name.toLowerCase()} className="group ...">
```
**Impacto esperado:** Re-render confiável e menos risco de glitches visuais.  
**Referências:** [React docs – lists and keys](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key).

### 5 — Sem testes para fluxos críticos
**Severidade:** Baixa  
**Categoria:** Testes  
**Localização:** [Não informado]  
**Descrição:** Não há testes cobrindo parsing de entrada, fallback de erro, ou integração com o serviço de geração.  
**Recomendação:** Adicionar testes unitários para `handleGenerate` (split/trim/erro vazio) e teste de serviço mockando resposta vazia e válida.  
**Impacto esperado:** Maior confiança em mudanças e prevenção de regressões em fluxos principais.  
**Referências:** [Vitest](https://vitest.dev/) para React/Vite.

## Plano de Ação
- **Quick Wins (0–2 dias):** Checagens defensivas da resposta; remover throw em import e avisar quando chave ausente; key estável na grade; validação de entrada (limite de itens e tamanho).
- **Médio Prazo (1–2 sprints):** Implementar limite de paralelismo + `allSettled`; adicionar testes unitários; mensagens de erro diferenciadas por item.
- **Estratégico:** Migrar geração para backend/proxy seguro que injete segredo; adicionar métricas/logs estruturados das chamadas (latência, erro).

## Checklist DoD / Quality Gate
- [ ] Build/linters passam sem erros
- [ ] Testes unitários cobrindo paths críticos
- [ ] Tratamento de erros padronizado
- [ ] Entradas validadas e saneadas
- [ ] Sem segredos em código/logs
- [ ] N+1 e hot paths mitigados
- [ ] Logs estruturados e métricas essenciais
- [ ] Dependências atualizadas/sem CVEs relevantes
