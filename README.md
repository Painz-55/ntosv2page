[README.md](https://github.com/user-attachments/files/26540969/README.md)
# Kill Tracker Cyberpunk

Sistema web frontend puro para GitHub Pages com Firebase Authentication e Realtime Database.

## Arquivos

- `index.html`
- `style.css`
- `app.js`
- `firebase-config.js`
- `database.rules.json`

## Estrutura do banco

```json
{
  "users": {
    "UID_DO_USUARIO": {
      "name": "Player One",
      "email": "player1@email.com",
      "points": 120,
      "role": "user"
    },
    "UID_DO_ADMIN": {
      "name": "Guild Master",
      "email": "admin@email.com",
      "points": 999,
      "role": "admin"
    }
  },
  "news": {},
  "kills": {
    "KILL_ID": {
      "reporterUid": "UID_DO_USUARIO",
      "reporterName": "Player One",
      "reporterEmail": "player1@email.com",
      "killerName": "Knight Alpha",
      "killerLevel": 650,
      "victimName": "Mage Beta",
      "victimLevel": 720,
      "basePoints": 30,
      "multiplier": 1,
      "calculatedPoints": 30,
      "finalPoints": 30,
      "status": "pending",
      "createdAt": 1712500000000
    }
  },
  "audits": {
    "AUDIT_ID": {
      "type": "kill_approved",
      "relatedKillId": "KILL_ID",
      "targetUid": "UID_DO_USUARIO",
      "targetName": "Player One",
      "title": "Kill aprovada",
      "description": "Knight Alpha derrotou Mage Beta",
      "killerName": "Knight Alpha",
      "victimName": "Mage Beta",
      "pointsDelta": 30,
      "approverUid": "UID_DO_ADMIN",
      "approverName": "Guild Master",
      "observation": "Sem observação.",
      "createdAt": 1712500000000
    }
  }
}
```

## Setup

1. Crie um projeto no Firebase.
2. Ative `Authentication > Email/Password`.
3. Crie os usuários manualmente em `Authentication`.
4. Copie o `UID` de cada usuário e crie manualmente os perfis em `users`.
5. Ative o `Realtime Database`.
6. Publique as regras de `database.rules.json`.
7. Preencha `firebase-config.js` com as credenciais do seu projeto.
8. Se quiser usar Discord, preencha `discordWebhookUrl` em `firebase-config.js`.
9. Adicione a URL do GitHub Pages em `Authentication > Settings > Authorized domains`.
10. Publique os arquivos no GitHub Pages.

## Fluxo de uso

1. O usuário entra com email e senha.
2. O perfil é carregado a partir do nó `users`.
3. Usuário comum registra a kill.
4. A kill entra como `pending`.
5. Admin aprova ou reprova.
6. Ao aprovar, os pontos são somados e um item é criado em `audits`.
7. Ajustes manuais também criam auditoria.
8. Ao remover um item da auditoria, o sistema tenta reverter os pontos automaticamente.

## Observações

- O webhook do Discord ficará exposto no frontend se usado diretamente.
- Em produção, o ideal é usar Cloud Functions ou outro backend intermediário para o webhook.
- O app usa apenas HTML, CSS e JavaScript via CDN do Firebase v10, então pode ser publicado diretamente no GitHub Pages.
