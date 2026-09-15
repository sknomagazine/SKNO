# SKNO Admin: diagnóstico da conexão GitHub

## Causa identificada em 14/09/2026

O helper acrescentava `/` mesmo quando o caminho do endpoint era vazio.
Assim, `/api/status` consultava `https://api.github.com/repos/sknomagazine/SKNO/`.
Uma comparação pública, sem credenciais e sem seguir redirects, reproduziu:

| URL | HTTP |
| --- | --- |
| `https://api.github.com/repos/sknomagazine/SKNO/` | 404 |
| `https://api.github.com/repos/sknomagazine/SKNO` | 200 |

A Function convertia esse 404 em 502 com `GITHUB_ERROR`, exatamente o comportamento relatado.
Isso confirma o defeito da URL; a conexão usando o Secret de produção ainda deve ser confirmada após o deployment.
Não houve leitura do Secret do Cloudflare nem teste autenticado com ele.

A versão `2026-03-10` é válida e foi mantida. `Authorization: Bearer`, `Accept: application/vnd.github+json` e `User-Agent: SKNO-Admin` foram preservados.
As Functions continuam recebendo bindings por `context.env`; não usam `process.env`.

## Alterações

- `admin-app/functions/lib/github.js`: URL sem barra final indevida; validação das quatro variáveis; classificação segura de falhas; diagnóstico compartilhado pelo upload; status somente leitura de repositório, branch e Contents.
- `admin-app/functions/lib/http.js`: remove mensagens arbitrárias de exceções do log genérico.
- `admin-app/functions/api/status.js`: informa a branch configurada que foi efetivamente verificada.
- `admin-app/tests/api.test.js`: adapta os testes existentes ao código `CONFIG_ERROR` e à obrigatoriedade da branch.
- `admin-app/tests/github.test.js`: testes com fetch simulado para status, erros, sigilo, encoding, upload e operações do CMS.

Também foram analisados `app.js`, `_headers`, `_middleware.js`, `api/publications.js`, `api/media.js`, `lib/validation.js`, os testes existentes e o manual administrativo.
Design, preview, site público, rotas, middleware Access e configuração de build não foram alterados.

## Verificação somente leitura

Cada chamada de `/api/status` executa sequencialmente:

1. `GET /repos/{owner}/{repo}`
2. `GET /repos/{owner}/{repo}/branches/{branch}`
3. `GET /repos/{owner}/{repo}/contents?ref={branch}`

Os pedidos usam o token recebido pelo servidor. O status só indica conectado depois dos três sucessos.
Isso verifica aceitação das requisições autenticadas e acesso de leitura, mas não comprova autorização de escrita: o repositório público também permite leitura pública, e regras de branch podem restringir commits. Não há gravações nem tentativas automáticas repetidas no status.

Variáveis obrigatórias: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`.
Não há mais valores padrão silenciosos. Para o token, a única validação é `Boolean(env.GITHUB_TOKEN)`.

## Segurança dos logs

Nenhum secret foi adicionado ao código, documentação ou logs. Os testes usam apenas uma credencial fictícia.
Os logs não contêm token, prefixo, tamanho ou hash do token, Authorization, cookies, JWT, ambiente completo, headers completos, corpos retornados pelo GitHub ou exceções originais do fetch.
Endpoints aparecem como modelos fixos, sem nomes de arquivos ou parâmetros de consulta.
A mensagem do GitHub é examinada somente para classificar rate limit secundário e nunca é registrada ou retornada.
O navegador recebe a mensagem genérica e um código estável. HTTP 409 mantém o aviso de conflito existente.

## Testes

Na raiz do repositório:

```sh
node --test admin-app/tests/*.test.js
```

51 testes passaram. Cobertura inclui HTTP 200, 401, 403, 404, 409, 429, 500, rede, JSON inválido, variáveis ausentes, sigilo, UTF-8/Base64, branch com barra, upload novo/existente e criação/listagem/edição/exclusão de texto, QC, arte, música e filme.
Todos os testes de integração usam mocks; nenhum commit de conteúdo ou upload real é executado por eles.
O teste público das duas URLs acima foi uma verificação manual separada, sem credenciais.
A compilação e o comportamento autenticado no Cloudflare devem ser confirmados no deployment de produção.

## Próximo teste em produção

1. Cloudflare → **Workers & Pages → skno-admin → Deployments**. Confirme um deployment de **Production**, branch **main**, correspondente ao commit da correção, com resultado **Success**.
2. Nesse deployment, abra **View details → Functions → Real-time Logs** e inicie a visualização antes de testar; os logs são transmitidos em tempo real.
3. Abra `https://skno-admin.pages.dev` e entre normalmente pelo Cloudflare Access.
4. Recarregue a página. Deve aparecer `GitHub: conectado (sknomagazine/SKNO)`.
5. No mesmo navegador autenticado, abra `https://skno-admin.pages.dev/api/status`. Espere HTTP 200, `github: "conectado"`, `repository: "sknomagazine/SKNO"` e `branch: "main"`.
6. Abra o gerenciamento de publicações para confirmar a listagem. O diagnóstico não exige criar, editar ou excluir conteúdo real.

## Logs exatos

Sucesso:

```text
GitHub connection verified
{ tokenConfigured: true, repositoryAccessible: true, branchAccessible: true, contentsReadable: true }
```

Falha de API, por exemplo:

```text
GitHub API request failed
{ endpoint: '/repos/{owner}/{repo}', method: 'GET', status: 404, code: 'GITHUB_NOT_FOUND', reason: 'http_error' }
SKNO Admin error GITHUB_NOT_FOUND
```

O endpoint pode ser `/repos/{owner}/{repo}/branches/{branch}` ou `/repos/{owner}/{repo}/contents/{path}`, indicando qual etapa falhou.
`status` é o HTTP do GitHub, não o 502 da Function. Para falha de fetch, será `null`, com `GITHUB_NETWORK_ERROR` e `reason: 'fetch_failed'`.
`reason` também pode ser `invalid_json`, `response_read_failed`, `invalid_repository_response`, `invalid_branch_response` ou `invalid_contents_response`.

Configuração:

```text
GitHub configuration invalid
{ code: 'CONFIG_ERROR', tokenConfigured: false, ownerConfigured: true, repoConfigured: true, branchConfigured: true }
SKNO Admin error CONFIG_ERROR
```

Os booleanos refletem apenas a presença das variáveis. Se todos forem `true`, verifique erros de formato ou espaços nas variáveis não secretas.

## Ações do proprietário, somente se houver erro

Não é necessário criar outro token para corrigir a barra final. Primeiro teste o deployment corrigido.

| Código | Ação |
| --- | --- |
| `CONFIG_ERROR` | Cloudflare → Workers & Pages → skno-admin → Settings → Variables and Secrets → Production. Confira a presença das quatro variáveis. Valores não secretos: owner `sknomagazine`, repo `SKNO`, branch `main`, sem espaços. O token deve continuar como Secret/Encrypted. |
| `GITHUB_AUTH_ERROR` (401) | No mesmo local, confirme que o Secret existente está associado a Production e ao deployment atual. No GitHub → foto → Settings → Developer settings → Personal access tokens → Fine-grained tokens → token existente, confira validade/revogação. Não revele o token. |
| `GITHUB_PERMISSION_ERROR` (403) | Na tela do token existente, confira Resource owner `sknomagazine`, Repository access `SKNO`, Metadata Read e Contents Read and write; confira eventual aprovação pendente se o GitHub a indicar. |
| `GITHUB_NOT_FOUND` (404) | Confira owner/repo/branch no Cloudflare e a seleção do repositório no token. A etapa indicada pelo endpoint distingue repositório, branch e Contents. GitHub também pode responder 404 quando o recurso não está acessível à credencial. |
| `GITHUB_RATE_LIMIT` (403/429) | Aguarde antes de recarregar; evite requisições repetidas. Não regenere o token. |
| `GITHUB_API_ERROR` ou `GITHUB_NETWORK_ERROR` | Verifique o HTTP e reason nos logs e a disponibilidade do GitHub; tente novamente depois. |
| `GITHUB_CONFLICT` (409) | Recarregue as publicações antes de tentar salvar novamente. |

Depois de alterar uma variável, faça novo deployment em **Workers & Pages → skno-admin → Deployments**. Preserve Root directory `admin-app`, build vazio e saída `.`. Não desative o Access.

## Fontes oficiais

- [GitHub: troubleshooting, incluindo barra final e HTTP 404](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api)
- [GitHub: versões da API](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
- [GitHub: branch](https://docs.github.com/en/rest/branches/branches#get-a-branch)
- [GitHub: Contents](https://docs.github.com/en/rest/repos/contents#get-repository-content)
- [Cloudflare: logs de Functions](https://developers.cloudflare.com/pages/functions/debugging-and-logging/)
- [Cloudflare: bindings e Secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets)
