# WN-7 (Serviços, PIX, Avisos e Conta): revisão adversarial da implementação

**Alvo:** working tree de `motoka-web` sobre `36cc2de` (sem commit), §21 do `WN-plano.md`. API em `e58438c`.
**Lentes:** devil-advocate, hm-engineer e hm-qa.
**Data:** 2026-10-05.

> **VEREDITO: REPROVADO.** 1 bloqueador, 3 ressalvas e 4 notas.

## Verificações executadas (sem Docker)

| Verificação | Resultado |
|---|---|
| lint, typecheck | exit 0 |
| Vitest | 362/362 |
| Build e2e com estilo + Playwright mockado | **74/74** |
| `size:login` | `entrar` com 218,6 KiB gz, dentro do teto de 220 |
| `check-error-codes` | 226 códigos na API e 218 no painel (ver a ressalva 3) |
| E2E real | não existe, por decisão do usuário. O contrato foi conferido só por leitura |

## Bloqueador

### B-1. [BLOQUEADOR] "Excluir conta" leva a um 404

- **Onde:** `src/features/account/AccountScreen.tsx:124`, `<a href="/excluir-conta">`.
- **Evidência:**
  - O link é relativo e resolve para `painel.motokadriver.com/excluir-conta`.
  - O painel não tem essa rota: não há `out/excluir-conta`, e o `_redirects` só tem `/convite/*` e
    `/r/*`. O Workers serve o `404.html`.
  - A página existe só na landing (`motoka-web/app/excluir-conta/page.tsx`), em outro host, e só
    orienta a pedir a exclusão por e-mail.
  - O app faz a exclusão dentro dele, pelo `DeleteAccountViewmodel` (`motoka_app/lib/src/features/profile/view/profile_page.dart:38-112`),
    contra `DELETE /v1/users/{id}` (`motoka-api/src/apps/users/presentation/routers.py:362-370`).
  - O E2E (`test/e2e/services.spec.ts:141`) confere só o `href`, nunca o destino. Por isso passa.
- **Falha:** a loja clica em "Excluir conta" e cai em "Página não encontrada". É um fluxo exigido
  pela LGPD e pelas lojas de apps.
- **Correção:** escolher uma das duas.
  - (a) **Paridade com o app:** confirmação forte (por exemplo, digitar "EXCLUIR"), depois
    `DELETE /users/{sub}`, depois `logout()`. Escrever teste unitário e E2E com o mock.
  - (b) **Link absoluto da landing:** usar uma URL validada no build, como o `NEXT_PUBLIC_PAINEL_URL`
    do WS-08, e um E2E que siga o link.

## Ressalvas

### 1. [RESSALVA] A Conta não tem troca de e-mail e de senha, e o app tem as duas

- **Evidência:**
  - O app tem `features/profile/view/profile_email_pages` e `profile_password_pages`.
  - A API expõe `POST /users/email-code`, `POST /users/confirm-email-code`, `PATCH /users/{id}/email`
    e `PATCH /users/{id}/password` (`users/presentation/routers.py:177,186,405,432`).
  - A §21 põe as duas como "Fora", sem decisão do usuário registrada, e a Conta passa a abrir sem elas.
- **Falha:** quem usa só o web não troca a senha nem o e-mail. Como o login web não tem "Esqueci a
  senha" (§11), quem perde a senha depende do app.
- **Correção:** implementar a troca de senha, que é simples: senha atual + nova, sem código. Para o
  e-mail, implementar o fluxo com código, ou registrar as duas como decisão do usuário e mostrar
  "Para trocar o e-mail ou a senha, use o app Motoka." com os links das lojas.
- **Itens que não são lacunas:**
  - **Bônus de chuva:** o app não tem na criação de pedido. Só aparece em
    `features/settlement/.../shift_settlement.dart`.
  - **Limite de 1 a 5 motoboys:** é mais restrito que o app (`establishment_create_order_page.dart:419`,
    só "Obrigatório") e que a API (`requested_drivers: int = Field(ge=1)`, sem teto). O limite segue o
    plano e o design. Ver a nota 1.

### 2. [RESSALVA] Cancelar serviço já pago não estorna, e a tela não avisa

- **Evidência:**
  - A regra de 3 h é idêntica à do app (`logic.ts:106-126` contra `establishment_order_details_page.dart:262-300`),
    inclusive a liberação em `pending_payment` e `paid`.
  - Na API, o `DELETE /orders/{id}` (`orders/application/order/remove_order.py:23`) tem
    `# TODO Adicionar lógica de cancelamento de pagamento`: cancelar um serviço `paid` não devolve a
    taxa.
- **Correção:** com `status === "paid"`, o diálogo de cancelamento precisa dizer que a taxa paga não
  é devolvida automaticamente e que a loja deve falar com o suporte. Registrar a pendência na lane da
  API. O app tem a mesma falha, mas o painel não deve repeti-la calado.

### 3. [RESSALVA] Os 9 códigos sem texto: um deles já é usado pela API

- **Integrações (6):** `INTEGRATION*` e `INTEGRATIONS_NOT_CONFIGURED` são do WN-4. Nenhuma tela
  atual chama essas rotas, então cair no fallback por status é aceitável hoje.
- **`TEAM_SESSION_END_TOO_EARLY`:** só o motoboy encerra turno. O painel nunca recebe esse código.
- **`TEAM_REMINDER_NOT_APPLICABLE` e `TEAM_REMINDER_TOO_SOON`:** o E17 já está commitado na API
  (`POST /teams/me/members/{id}/remind-location`, `teams/presentation/routers.py:152-162`, commit
  `e58438c` WS-03d). O botão "Lembrar de ativar localização" do WN-3 deixou de estar bloqueado e
  continua ausente.
- **Correção:**
  1. Pôr os 9 textos no catálogo agora: é barato, e a memória do projeto registra que o catálogo
     dessincroniza.
  2. Abrir o item "E17 no mapa ao vivo" como pendência do WN-3.

## Conferido sem achado

### Contrato de serviços

- **Orders:** `POST /orders` com união por `type`, `value` e `price_per_delivery` (`schemas.py:16-55`);
  `POST /orders/review` com `establishment_id` lido do JWT (`routers.py:345-367`); `DELETE /orders/{id}`.
- **Negociação:** `/negotiations/{id}/offers|accept|reject|cancel`.
- **Pagamentos:** `/payments` (POST e GET); a resposta de status traz `payment_metadata`
  (`routers.py:595-614`).
- **Cartões:** `GET` e `DELETE /users/{id}/bank-cards` (`ListUserBankCardsSchemaResponse`).
- **Notificações:** `GET /notifications?is_read=`, `/unread-count`, `PATCH /{id}/read` e
  `POST /read-all`.

### Pagamento (DN-25)

- **PIX:** o QR só vira `data:` se for base64 válido (`model.ts:213-228`).
- **Cartão salvo:** só com `bank_card_id`.
- **Confirmação:** "pago" só com o status `paid` da API (`PayPanel.tsx:54,87`). "Já fiz o pagamento"
  só relê o status.
- **Idempotência:** o `POST` devolve o pagamento ativo (`create_payment.py:80-85`).
- **CSP e cartão:** nenhum campo de cartão no DOM, nenhum script ou host novo na CSP.

### Segurança

- Todo id vira caminho só depois de `isUuid` (`services/api.ts:23-26,106-109,136-146`).
- As notificações só navegam para destinos internos que tenham UUID.

## Notas

1. **Teto de 5 motoboys.** O limite de 1 a 5 é uma regra do painel que o app e a API não têm. Uma loja
   que hoje pede 6 ou mais pelo app não consegue fazer isso no web. Confirmar com o usuário.
2. **Parâmetro morto.** O `orderBody` e o `reviewOrder` aceitam `rainBonusPercent`
   (`services/api.ts:61,72,86`), que a UI nunca preenche. Remover, ou ligar no futuro como decisão.
3. **Testes só com mock.** São unidade e E2E com a API mockada, sem E2E real (decisão do usuário).
   O contrato foi conferido só por leitura nesta revisão.
4. **Fluxos críticos sem cobertura (hm-qa):**
   - E2E de "Excluir conta" que siga o link;
   - PIX expirado seguido de novo pagamento;
   - recusar contraproposta com a lista de ofertas atualizando.

## Resumo hm-engineer

- 1 finding CRÍTICO: o B-1.
- 2 ALTOS: as ressalvas 1 e 2.
- 1 MÉDIO: a ressalva 3.
- 2 BAIXOS: as notas 1 e 2.

Recomendação: corrigir primeiro.
