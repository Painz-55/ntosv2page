// PREENCHA COM AS SUAS CHAVES DO FIREBASE
// Ative no Firebase:
// 1) Authentication > Sign-in method > Email/Password
// 2) Realtime Database
// 3) Hospede no GitHub Pages normalmente

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDc1xAAv-6Namx8bACRS-tsAEpZHiZZE74",
  authDomain: "guildsitentosv2.firebaseapp.com",
  databaseURL: "https://guildsitentosv2-default-rtdb.firebaseio.com",
  projectId: "guildsitentosv2",
  storageBucket: "guildsitentosv2.firebasestorage.app",
  messagingSenderId: "1070647907884",
  appId: "1:1070647907884:web:7897f7a576f917b5cbe389"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;

window.discordWebhookUrl = "https://discord.com/api/webhooks/1490706645095944312/I8vrUtznskwta0wY-H4KWDYU719iSp_czMCigGRv99vZmVlCN0xq_GICi2cB5Hl7vvrB";
