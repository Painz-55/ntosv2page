// PREENCHA COM AS SUAS CHAVES DO FIREBASE
// Ative no Firebase:
// 1) Authentication > Sign-in method > Email/Password
// 2) Realtime Database
// 3) Hospede no GitHub Pages normalmente

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPnnJRWdKzjVEIaQJjoORtuA_q9kg6sXs",
  authDomain: "databasesitebr2.firebaseapp.com",
  databaseURL: "https://databasesitebr2-default-rtdb.firebaseio.com/",
  projectId: "databasesitebr2",
  storageBucket: "databasesitebr2.firebasestorage.app",
  messagingSenderId: "354607115653",
  appId: "1:354607115653:web:17a30122d7487fd45ee8ec"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;

window.discordWebhookUrl = "https://discord.com/api/webhooks/1490706645095944312/I8vrUtznskwta0wY-H4KWDYU719iSp_czMCigGRv99vZmVlCN0xq_GICi2cB5Hl7vvrB";
