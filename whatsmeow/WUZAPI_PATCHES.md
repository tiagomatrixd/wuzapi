# whatsmeow — cópia local com patch (wuzapi)

Esta pasta é uma cópia de `go.mau.fi/whatsmeow@v0.0.0-20260713112832-d8960d9575d2`,
usada via `replace` no `go.mod` do wuzapi.

## Por quê

O whatsmeow upstream **não trata nós `<status>`** (updates de canais/newsletters
seguidos pela conta): `handleFrame` descarta o nó sem enviar `<ack>`. O servidor
do WhatsApp então reentrega esses itens a cada conexão (atributo `offline="N"`
crescendo) e, quando eles estão na frente de uma fila offline grande, o servidor
**para de despejar o resto da fila** — a sessão fica conectada, envia, mas nunca
recebe as mensagens pendentes nem as novas (caso da sessão Patricia/c0b0, fila
presa em ~2200 itens com 13 status de newsletter na frente).

## Patch aplicado (manter ao atualizar!)

1. `wuzapi_status_ack.go` (arquivo novo): `handleUnsupportedStatusNode` — acka e
   descarta o nó.
2. `client.go`: entrada `"status": cli.handleUnsupportedStatusNode` no mapa
   `cli.nodeHandlers` (procure por `WUZAPI LOCAL PATCH`).

## Como atualizar o whatsmeow no futuro

1. `go mod download go.mau.fi/whatsmeow@<versão-nova>` (temporariamente remova o
   `replace` do go.mod e rode `go get go.mau.fi/whatsmeow@latest`).
2. Substitua o conteúdo desta pasta pela nova versão do cache de módulos
   (`$(go env GOMODCACHE)/go.mau.fi/whatsmeow@<versão>`), com permissão de escrita.
3. Reaplique os 2 itens do patch acima (ou remova o patch se o upstream passar a
   tratar nós `status` — verifique se `"status"` existe no `nodeHandlers` do
   `client.go` novo).
4. Restaure o `replace` e rode `go build ./...`.
