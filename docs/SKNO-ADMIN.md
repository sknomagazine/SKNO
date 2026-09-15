# SKNO Admin — manual do proprietário

## O que é

O SKNO Admin é uma tela privada para publicar, editar e excluir textos, QC, artes, músicas e filmes sem editar HTML ou JSON. O site público continua estático e aberto em `https://skno.pages.dev`. O painel deve ser um segundo projeto, por exemplo `https://skno-admin.pages.dev`, inteiramente protegido pelo Cloudflare Access.

O fluxo é: navegador do administrador → Cloudflare Access → Pages Function → API do GitHub → commit na branch `main` → novo deploy automático do site público. O token do GitHub fica criptografado na Cloudflare e nunca é enviado ao navegador.

## Custos e limites gratuitos

A solução usa apenas GitHub, Cloudflare Pages, Pages Functions e Access. Na situação documentada em setembro de 2026, o Pages Free permite 500 builds por mês e arquivos de até 25 MiB; as Functions compartilham a franquia Workers Free de 100.000 requisições diárias. Verifique a página de preços antes de mudar de plano. Ultrapassar uma franquia não faz parte deste projeto e não deve ser habilitado sem revisar possíveis cobranças.

O painel aceita até 10 MiB por imagem, 20 MiB por PDF, 20 MiB por faixa e 20 MiB por vídeo. São aceitas imagens JPEG/PNG/WebP, PDF, áudio MP3/OGG/Opus/WAV e vídeo MP4/WebM. Arquivos maiores devem ser hospedados em um local externo compatível e informados por URL. O GitHub não deve ser usado como depósito de vídeos grandes.

## 1. Preparar o GitHub

1. Entre no GitHub com a conta que pode alterar `sknomagazine/SKNO`.
2. Abra sua foto → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**.
3. Crie um token com nome como `SKNO Admin`, prazo de expiração curto e renovável.
4. Em **Repository access**, escolha **Only select repositories** e selecione apenas `SKNO`.
5. Em **Repository permissions**, marque somente **Contents: Read and write**. Não marque Administration, Actions, Secrets ou Workflows.
6. Gere e copie o token uma única vez. Trate-o como uma senha. Não cole em arquivo do projeto, chat, e-mail ou código.

O histórico de commits funciona como auditoria. O painel usa mensagens legíveis e sempre lê o SHA atual antes de alterar o JSON. Um conflito não sobrescreve a versão nova.

## 2. Criar o projeto administrativo no Cloudflare Pages

1. Abra o painel Cloudflare → **Workers & Pages** → **Create** → **Pages** → conecte o repositório `sknomagazine/SKNO`.
2. Nome sugerido: `skno-admin`.
3. Escolha a branch de produção `main`.
4. Use `admin-app` como **Root directory**.
5. Não há build: deixe o comando de build vazio. Use `.` como diretório de saída quando o formulário exigir um valor.
6. Faça o primeiro deploy. Ainda não use o painel para publicar até concluir o Access e as variáveis.

Não aplique Access ao projeto `skno` público. A aplicação protegida deve apontar somente para o hostname administrativo.

## 3. Configurar variáveis e o Secret

No projeto `skno-admin`, abra **Settings → Variables and Secrets**. Cadastre para produção (e também preview, se previews forem usados):

- `GITHUB_TOKEN`: escolha **Encrypt/Secret** e cole o token. Este é o único valor secreto do GitHub.
- `GITHUB_OWNER`: `sknomagazine`
- `GITHUB_REPO`: `SKNO`
- `GITHUB_BRANCH`: `main`
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN`: endereço completo como `https://sua-equipe.cloudflareaccess.com`
- `CLOUDFLARE_ACCESS_AUD`: Audience Tag da aplicação Access criada na etapa seguinte.
- `ADMIN_EMAIL`: endereço exato do único administrador.

Faça um novo deploy depois de salvar. Se `GITHUB_TOKEN` faltar, o painel mostra “Configuração incompleta” sem revelar valor algum. Para desenvolvimento local, copie `.dev.vars.example` para `.dev.vars`; nunca versione esse arquivo.

## 4. Proteger com Cloudflare Access

1. Abra **Zero Trust → Access controls → Applications → Add an application → Self-hosted**.
2. Informe somente o hostname administrativo, por exemplo `skno-admin.pages.dev`. Não inclua `skno.pages.dev`.
3. Crie uma política **Allow** que inclua apenas o administrador. Prefira o provedor de identidade Cloudflare e restrinja ao membro autorizado da conta. Se usar One-Time PIN, inclua explicitamente apenas o e-mail do administrador; nunca use “qualquer e-mail”.
4. Copie o **Application Audience (AUD) Tag** em Additional settings e grave em `CLOUDFLARE_ACCESS_AUD`.
5. Confirme o Team Domain e grave em `CLOUDFLARE_ACCESS_TEAM_DOMAIN`.
6. Ative MFA na conta Cloudflare: perfil → Authentication → Two-factor authentication. Guarde os códigos de recuperação em local seguro.
7. Teste em janela anônima: usuário não autorizado deve parar no Access; o administrador autorizado deve entrar.

Mesmo depois da barreira do Access, as Functions conferem criptograficamente o JWT, a chave pública, algoritmo RS256, issuer, audience, expiração e o e-mail de `ADMIN_EMAIL`. Uma simples falsificação de cabeçalho não é aceita.

## 5. Uso cotidiano

### Publicar texto

Clique **TEXTO**, informe título, autor, data, descrição e conteúdo. Separe parágrafos com uma linha em branco. O slug nasce do título e pode ser alterado. Clique **VISUALIZAR** e depois **PUBLICAR**.

### Publicar QC

Clique **QC** e preencha os dados. Selecione um PDF de até 20 MiB ou informe uma URL direta. O arquivo enviado vai para `uploads/qc/<slug>/`.

### Publicar arte

Clique **ARTE VISUAL**, preencha os dados e selecione até 20 imagens. Use as setas para ordenar e **REMOVER** para retirar antes da publicação. Originais não são comprimidos. Os arquivos vão para `uploads/artes/<slug>/`.

### Publicar música

Clique **MÚSICA**, adicione capa opcional e faixas. Cada faixa precisa de título e arquivo ou URL. Use as setas para ordenar. Arquivos vão para `uploads/musicas/<slug>/`.

### Publicar filme

Clique **FILME**, adicione poster e vídeo de até 20 MiB ou URL direta. Arquivos vão para `uploads/filmes/<slug>/`. Para vídeo maior, use URL externa.

**SALVAR RASCUNHO LOCAL** guarda apenas texto editorial no navegador atual. Não guarda arquivos e nunca guarda credenciais. Depois de publicar, a confirmação mostra o commit. O deploy pode levar algum tempo; não há prazo exato prometido.

## 6. Gerenciar, editar e excluir

Clique **GERENCIAR PUBLICAÇÕES** e filtre por categoria. **VISUALIZAR** abre a página pública; **EDITAR** carrega o registro atual. Ao salvar, o servidor relê o JSON e seu SHA, altera somente o item e preserva os demais.

**EXCLUIR** exige digitar `EXCLUIR`. A exclusão remove apenas o registro do JSON. Mídias não são apagadas automaticamente porque podem estar compartilhadas; isso evita perda irrecuperável.

## 7. Recuperar ou desfazer uma publicação

1. Abra o repositório no GitHub e clique em **Commits**.
2. Localize o commit `SKNO Admin: ...` anterior ao problema.
3. Abra o arquivo JSON alterado e veja a versão anterior no histórico.
4. Use a opção de reverter commit do GitHub quando disponível, ou peça ajuda técnica para restaurar somente aquele arquivo. Não faça force-push nem reescreva o histórico.

As mídias mantidas após exclusão facilitam recuperação. Não apague arquivos manualmente sem confirmar todas as referências.

## 8. Renovar token e resolver expiração

Antes do vencimento, crie outro fine-grained token com as mesmas permissões mínimas. No Pages, edite `GITHUB_TOKEN`, escolha Secret/Encrypt, salve e faça novo deploy. Depois que o novo token funcionar, revogue o antigo no GitHub. Erros `GITHUB_TOKEN_INVALID` ou `GITHUB_FORBIDDEN` normalmente indicam expiração, revogação, repositório errado ou falta de **Contents: Read and write**.

Se houver suspeita de vazamento, revogue imediatamente o token no GitHub, crie outro e substitua o Secret. Nunca registre o valor em chamados ou capturas de tela.

## 9. Problemas comuns

- **Deploy falhou:** abra Workers & Pages → projeto → Deployments → log. Confirme Root directory `admin-app`, branch e variáveis. O site público anterior continua no ar.
- **Conflito:** recarregue publicações e tente novamente. O painel não sobrescreve cegamente.
- **JSON inválido:** o painel bloqueia alterações. Restaure uma versão válida pelo histórico do GitHub.
- **Upload parcial:** o painel informa caminhos já enviados, mas não grava o item no JSON. Esses arquivos ficam órfãos e podem ser revisados depois; não há limpeza automática arriscada.
- **Site não atualizou:** veja o deploy do projeto público e o commit no GitHub. Aguarde o deploy terminar, sem repetir a publicação.
- **Acesso negado:** confira a política Access, o e-mail exato, AUD e Team Domain.

## 10. Segurança e manutenção

Use MFA, renove o token, mantenha somente um e-mail na política, não desative a validação JWT e não habilite CORS amplo. O painel usa requisições same-origin, CSP, `nosniff`, política contra iframes e `noindex`. Slugs e caminhos são normalizados; MIME, extensão, tamanho e quantidade são validados no navegador e no servidor. SVG, HTML, JavaScript e executáveis são bloqueados.

O rate limiting complexo não foi adicionado: o Access limita o painel a uma pessoa e os endpoints já limitam payloads e quantidades. Revise cotas caso o uso mude.

`data/qc.json` armazena as publicações de QC (Quadrinhos e Charges) e é usado pela home, categoria, página de publicação e painel administrativo. A cópia legada idêntica foi removida.

## Checklist do primeiro lançamento

- Site público abre sem login, incluindo as cinco categorias.
- Admin pede autenticação e bloqueia outro e-mail.
- Status mostra GitHub conectado.
- Um texto de teste pode ser visualizado, publicado, editado e excluído.
- Token não aparece no código, DevTools, URL, localStorage ou logs.
- Deploy público começa após o commit.

## Referências oficiais

- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Cloudflare Pages bindings e Secrets: https://developers.cloudflare.com/pages/functions/bindings/
- Validação de JWT do Access: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Limites do Pages: https://developers.cloudflare.com/pages/platform/limits/
- Preços de Functions: https://developers.cloudflare.com/pages/functions/pricing/
- GitHub Contents API: https://docs.github.com/en/rest/repos/contents
- Fine-grained tokens: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- Limites de repositório: https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
