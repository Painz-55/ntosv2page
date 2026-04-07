import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  push,
  set,
  update,
  get,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const auth = window.firebaseAuth;
const db = window.firebaseDb;

const state = {
  currentUser: null,
  currentProfile: null,
  newsUnsub: null,
  pendingUnsub: null,
  auditUnsub: null,
  rankingUnsub: null,
  usersUnsub: null,
  usersCache: {}
};

const els = {
  authSection: document.getElementById("authSection"),
  mainSection: document.getElementById("mainSection"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  userBadge: document.getElementById("userBadge"),
  tabs: [...document.querySelectorAll(".tab")],
  tabContents: [...document.querySelectorAll(".tab-content")],
  adminOnly: [...document.querySelectorAll(".admin-only")],
  newsList: document.getElementById("newsList"),
  newsTitle: document.getElementById("newsTitle"),
  newsContent: document.getElementById("newsContent"),
  saveNewsBtn: document.getElementById("saveNewsBtn"),
  refreshNewsBtn: document.getElementById("refreshNewsBtn"),
  registradoPorNome: document.getElementById("registradoPorNome"),
  charMatou: document.getElementById("charMatou"),
  levelMatou: document.getElementById("levelMatou"),
  charMorreu: document.getElementById("charMorreu"),
  levelMorreu: document.getElementById("levelMorreu"),
  previewPontos: document.getElementById("previewPontos"),
  calculateBtn: document.getElementById("calculateBtn"),
  submitKillBtn: document.getElementById("submitKillBtn"),
  pendingList: document.getElementById("pendingList"),
  refreshPendingBtn: document.getElementById("refreshPendingBtn"),
  auditList: document.getElementById("auditList"),
  refreshAuditBtn: document.getElementById("refreshAuditBtn"),
  adjustTargetUser: document.getElementById("adjustTargetUser"),
  adjustType: document.getElementById("adjustType"),
  adjustValue: document.getElementById("adjustValue"),
  adjustObs: document.getElementById("adjustObs"),
  saveAdjustmentBtn: document.getElementById("saveAdjustmentBtn"),
  rankingList: document.getElementById("rankingList"),
  refreshRankingBtn: document.getElementById("refreshRankingBtn"),
  toast: document.getElementById("toast"),
  usersBtn: document.getElementById("usersBtn"),
  usersPanel: document.getElementById("usersPanel"),
  closeUsersPanelBtn: document.getElementById("closeUsersPanelBtn"),
  usersList: document.getElementById("usersList")
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), 2500);
}

function sanitize(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function basePoints(levelMorreu) {
  if (levelMorreu >= 800) return 50;
  if (levelMorreu >= 700) return 30;
  if (levelMorreu >= 600) return 10;
  if (levelMorreu >= 500) return 5;
  if (levelMorreu >= 400) return 3;
  return 0;
}

function calculateKillPoints(levelMatou, levelMorreu) {
  const matou = Number(levelMatou);
  const morreu = Number(levelMorreu);

  if (!Number.isFinite(matou) || !Number.isFinite(morreu) || matou <= 0 || morreu <= 0) {
    return 0;
  }

  const base = basePoints(morreu);
  const diff = matou - morreu;
  let multiplier = 1;

  if (diff < 0) {
    multiplier = Math.abs(diff) <= 100 ? 1.5 : 2;
  } else if (diff > 100) {
    multiplier = 0.5;
  }

  return base * multiplier;
}

function setActiveTab(tabId) {
  els.tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabId));
  els.tabContents.forEach(section => section.classList.toggle("active", section.id === tabId));
}

function updateUiByRole(profile) {
  const isAdmin = profile?.role === "admin";
  els.adminOnly.forEach(el => el.classList.toggle("hidden", !isAdmin));

  if (!isAdmin && els.usersPanel) {
    els.usersPanel.classList.add("hidden");
  }
}

async function ensureUserProfile(user, emailFallback = "") {
  const userRef = ref(db, `users/${user.uid}`);
  const snap = await get(userRef);

  if (!snap.exists()) {
    const defaultProfile = {
      email: user.email || emailFallback || "",
      nome: (user.email || emailFallback || "Usuário").split("@")[0],
      role: "user",
      pontos: 0
    };
    await set(userRef, defaultProfile);
    return defaultProfile;
  }

  return snap.val();
}

function bindNews() {
  if (state.newsUnsub) state.newsUnsub();
  state.newsUnsub = onValue(ref(db, "news"), snapshot => {
    const val = snapshot.val() || {};
    const items = Object.entries(val)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    els.newsList.innerHTML = items.length
      ? items.map(item => `
          <div class="card">
            <h3>${sanitize(item.title || "Sem título")}</h3>
            <p>${sanitize(item.content || "")}</p>
            <div class="meta">Publicado por: ${sanitize(item.createdByName || "-")} • ${formatDate(item.createdAt)}</div>
          </div>
        `).join("")
      : `<div class="card"><p>Nenhuma notícia cadastrada ainda.</p></div>`;
  });
}

function bindUsers() {
  if (state.usersUnsub) state.usersUnsub();
  state.usersUnsub = onValue(ref(db, "users"), snapshot => {
    state.usersCache = snapshot.val() || {};
    renderAdjustUsersSelect();
  });
}

function renderAdjustUsersSelect() {
  if (!els.adjustTargetUser) return;

  const items = Object.entries(state.usersCache)
    .map(([uid, item]) => ({ uid, ...item }))
    .sort((a, b) =>
      String(a.nome || a.email || "").localeCompare(String(b.nome || b.email || ""), "pt-BR")
    );

  els.adjustTargetUser.innerHTML = items.length
    ? items.map(user => `
        <option value="${sanitize(user.uid)}">${sanitize(user.nome || user.email || user.uid)}</option>
      `).join("")
    : `<option value="">Nenhum usuário encontrado</option>`;
}

async function toggleUsersPanel() {
  if (state.currentProfile?.role !== "admin") {
    showToast("Apenas administradores podem ver os usuários.");
    return;
  }

  const isHidden = els.usersPanel.classList.contains("hidden");

  if (!isHidden) {
    els.usersPanel.classList.add("hidden");
    return;
  }

  const items = Object.entries(state.usersCache)
    .map(([uid, item]) => ({ uid, ...item }))
    .sort((a, b) =>
      String(a.nome || a.email || "").localeCompare(String(b.nome || b.email || ""), "pt-BR")
    );

  els.usersList.innerHTML = items.length
    ? items.map(user => `
        <div class="card">
          <div><strong>Nome</strong><br>${sanitize(user.nome || user.email || "-")}</div>
          <div class="meta" style="margin-top:8px;">UID: ${sanitize(user.uid)}</div>
          <div class="meta">Função: ${sanitize(user.role || "user")}</div>
        </div>
      `).join("")
    : `<div class="card"><p>Nenhum usuário encontrado.</p></div>`;

  els.usersPanel.classList.remove("hidden");
}

function bindPending() {
  if (state.pendingUnsub) state.pendingUnsub();
  state.pendingUnsub = onValue(ref(db, "killSubmissions"), snapshot => {
    const val = snapshot.val() || {};
    const items = Object.entries(val)
      .map(([id, item]) => ({ id, ...item }))
      .filter(item => item.status === "pending")
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    els.pendingList.innerHTML = items.length
      ? items.map(item => `
          <div class="card">
            <div class="row">
              <div><strong>Registrado por</strong><br>${sanitize(item.registradoPorNome || "-")}</div>
              <div><strong>Matou</strong><br>${sanitize(item.charMatou || "-")} (lvl ${sanitize(item.levelMatou)})</div>
              <div><strong>Morreu</strong><br>${sanitize(item.charMorreu || "-")} (lvl ${sanitize(item.levelMorreu)})</div>
            </div>
            <div class="row" style="margin-top:12px;">
              <label>
                <span>Pontos</span>
                <input type="number" id="points-${item.id}" value="${Number(item.pontosCalculados || 0)}" />
              </label>
              <label>
                <span>OBS</span>
                <textarea id="obs-${item.id}" rows="3" placeholder="Obrigatória se alterar os pontos"></textarea>
              </label>
            </div>
            <div class="actions">
              <button class="success" data-approve="${item.id}">Aprovar</button>
              <button class="danger" data-reject="${item.id}">Reprovar</button>
            </div>
          </div>
        `).join("")
      : `<div class="card"><p>Não há kills pendentes.</p></div>`;

    items.forEach(item => {
      document.querySelector(`[data-approve="${item.id}"]`)?.addEventListener("click", () => reviewKill(item, "approved"));
      document.querySelector(`[data-reject="${item.id}"]`)?.addEventListener("click", () => reviewKill(item, "rejected"));
    });
  });
}

function bindAudit() {
  if (state.auditUnsub) state.auditUnsub();
  state.auditUnsub = onValue(ref(db, "audit"), snapshot => {
    const val = snapshot.val() || {};
    const items = Object.entries(val)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const isAdmin = state.currentProfile?.role === "admin";

    els.auditList.innerHTML = items.length
      ? items.map(item => `
          <div class="card">
            <div class="row">
              <div>
                <strong>Status</strong><br>
                <span class="badge status-${sanitize(item.status || "pending")}">${sanitize(item.status || "-")}</span>
              </div>
              <div>
                <strong>Matou</strong><br>
                ${sanitize(item.charMatou || "-")} ${item.levelMatou !== "-" ? `(lvl ${sanitize(item.levelMatou)})` : ""}
              </div>
              <div>
                <strong>Morreu</strong><br>
                ${sanitize(item.charMorreu || "-")} ${item.levelMorreu !== "-" ? `(lvl ${sanitize(item.levelMorreu)})` : ""}
              </div>
              <div>
                <strong>Pontos</strong><br>
                ${sanitize(item.pontos)}
              </div>
            </div>

            <div class="meta" style="margin-top:12px;">
              Registrado por: ${sanitize(item.registradoPorNome || "-")}<br>
              Avaliado por: ${sanitize(item.avaliadoPorNome || "-")}<br>
              OBS: ${sanitize(item.obs || "-")}<br>
              Data: ${formatDate(item.createdAt)}
            </div>

            ${isAdmin ? `
              <div class="actions">
                <button class="danger" data-delete-audit="${item.id}">Remover</button>
              </div>
            ` : ""}
          </div>
        `).join("")
      : `<div class="card"><p>Sem registros de auditoria.</p></div>`;

    if (isAdmin) {
      items.forEach(item => {
        document.querySelector(`[data-delete-audit="${item.id}"]`)?.addEventListener("click", () => deleteAuditItem(item.id));
      });
    }
  });
}

function bindRanking(showUpdatedToast = false) {
  if (state.rankingUnsub) state.rankingUnsub();
  state.rankingUnsub = onValue(ref(db, "users"), snapshot => {
    const val = snapshot.val() || {};
    const items = Object.entries(val)
      .map(([uid, item]) => ({ uid, ...item }))
      .sort((a, b) => Number(b.pontos || 0) - Number(a.pontos || 0));

    els.rankingList.innerHTML = items.length
      ? items.map((item, index) => `
          <div class="card">
            <div class="row">
              <div><strong>#${index + 1}</strong></div>
              <div><strong>Nome</strong><br>${sanitize(item.nome || item.email || item.uid)}</div>
              <div><strong>Pontos</strong><br>${sanitize(Number(item.pontos || 0))}</div>
              <div><strong>Função</strong><br>${sanitize(item.role || "user")}</div>
            </div>
          </div>
        `).join("")
      : `<div class="card"><p>Nenhum usuário encontrado.</p></div>`;

    if (showUpdatedToast) showToast("Atualizado");
  });
}

async function reviewKill(item, status) {
  if (state.currentProfile?.role !== "admin") {
    showToast("Apenas administradores podem avaliar.");
    return;
  }

  const pointsInput = document.getElementById(`points-${item.id}`);
  const obsInput = document.getElementById(`obs-${item.id}`);
  const finalPoints = Number(pointsInput?.value || 0);
  const obs = (obsInput?.value || "").trim();

  if (status === "approved" && finalPoints < 0) {
    showToast("Os pontos não podem ser negativos.");
    return;
  }

  if (finalPoints !== Number(item.pontosCalculados || 0) && !obs) {
    showToast("Se alterar os pontos, preencha a OBS.");
    return;
  }

  await update(ref(db, `killSubmissions/${item.id}`), {
    status,
    pontosAprovados: status === "approved" ? finalPoints : 0,
    obsAvaliacao: obs,
    avaliadoPorUid: state.currentUser.uid,
    avaliadoPorNome: state.currentProfile?.nome || state.currentUser.email || "ADM",
    reviewedAt: Date.now()
  });

  const auditRef = push(ref(db, "audit"));
  await set(auditRef, {
    killId: item.id,
    status,
    registradoPorUid: item.registradoPorUid,
    registradoPorNome: item.registradoPorNome,
    charMatou: item.charMatou,
    levelMatou: Number(item.levelMatou),
    charMorreu: item.charMorreu,
    levelMorreu: Number(item.levelMorreu),
    pontos: status === "approved" ? finalPoints : 0,
    obs: obs || (status === "approved" ? "Aprovado sem observações" : "Reprovado"),
    avaliadoPorUid: state.currentUser.uid,
    avaliadoPorNome: state.currentProfile?.nome || state.currentUser.email || "ADM",
    createdAt: Date.now()
  });

  if (status === "approved" && item.registradoPorUid) {
    const userRef = ref(db, `users/${item.registradoPorUid}`);
    const userSnap = await get(userRef);

    if (userSnap.exists()) {
      const current = Number(userSnap.val().pontos || 0);
      await update(userRef, { pontos: current + finalPoints });
    }
  }

  showToast(status === "approved" ? "Kill aprovada" : "Kill reprovada");
  bindRanking();
}

async function saveNews() {
  if (state.currentProfile?.role !== "admin") {
    showToast("Apenas administradores podem publicar notícias.");
    return;
  }

  const title = els.newsTitle.value.trim();
  const content = els.newsContent.value.trim();

  if (!title || !content) {
    showToast("Preencha título e conteúdo.");
    return;
  }

  const newsRef = push(ref(db, "news"));
  await set(newsRef, {
    title,
    content,
    createdAt: Date.now(),
    createdBy: state.currentUser.uid,
    createdByName: state.currentProfile?.nome || state.currentUser.email || "ADM"
  });

  els.newsTitle.value = "";
  els.newsContent.value = "";
  showToast("Notícia publicada");
}

function calculatePreview() {
  els.previewPontos.value = calculateKillPoints(els.levelMatou.value, els.levelMorreu.value);
}

async function sendDiscordWebhook(payload) {
  const webhookUrl = window.discordWebhookUrl;

  if (!webhookUrl || webhookUrl === "COLOQUE_AQUI_O_WEBHOOK_DO_DISCORD") {
    return;
  }

  const content =
    "📢 **Nova kill registrada**\n" +
    `**Registrado por:** ${payload.registradoPorNome}\n` +
    `**Matou:** ${payload.charMatou} (lvl ${payload.levelMatou})\n` +
    `**Morreu:** ${payload.charMorreu} (lvl ${payload.levelMorreu})\n` +
    `**Pontos calculados:** ${payload.pontosCalculados}\n` +
    `**Status:** Pendente de aprovação`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
  } catch (error) {
    console.error("Falha ao enviar webhook para o Discord:", error);
  }
}

async function submitKill() {
  if (!state.currentUser) {
    showToast("Faça login primeiro.");
    return;
  }

  const registradoPorNome = els.registradoPorNome.value.trim();
  const charMatou = els.charMatou.value.trim();
  const levelMatou = Number(els.levelMatou.value);
  const charMorreu = els.charMorreu.value.trim();
  const levelMorreu = Number(els.levelMorreu.value);

  if (!registradoPorNome || !charMatou || !charMorreu || !levelMatou || !levelMorreu) {
    showToast("Preencha todos os campos da kill.");
    return;
  }

  const pontosCalculados = calculateKillPoints(levelMatou, levelMorreu);
  const killRef = push(ref(db, "killSubmissions"));

  const killPayload = {
    status: "pending",
    registradoPorUid: state.currentUser.uid,
    registradoPorNome,
    charMatou,
    levelMatou,
    charMorreu,
    levelMorreu,
    pontosCalculados,
    pontosAprovados: null,
    obsAvaliacao: "",
    createdAt: Date.now()
  };

  await set(killRef, killPayload);
  await sendDiscordWebhook(killPayload);

  els.charMatou.value = "";
  els.levelMatou.value = "";
  els.charMorreu.value = "";
  els.levelMorreu.value = "";
  els.previewPontos.value = "";
  showToast("Kill enviada para aprovação");
}

async function saveAdjustment() {
  if (state.currentProfile?.role !== "admin") {
    showToast("Apenas administradores podem ajustar pontos.");
    return;
  }

  const targetUid = els.adjustTargetUser.value;
  const targetUser = state.usersCache[targetUid];
  const targetNome = targetUser?.nome || targetUser?.email || "";
  const type = els.adjustType.value;
  const value = Number(els.adjustValue.value);
  const obs = els.adjustObs.value.trim();

  if (!targetUid || !targetNome || !value || value <= 0 || !obs) {
    showToast("Preencha todos os campos e informe a OBS.");
    return;
  }

  const userRef = ref(db, `users/${targetUid}`);
  const userSnap = await get(userRef);

  if (!userSnap.exists()) {
    showToast("Usuário não encontrado.");
    return;
  }

  const currentPoints = Number(userSnap.val().pontos || 0);
  const nextPoints = type === "debit" ? currentPoints - value : currentPoints + value;

  await update(userRef, { pontos: nextPoints });

  const adjRef = push(ref(db, "pointAdjustments"));
  await set(adjRef, {
    targetUid,
    targetNome,
    tipo: type,
    valor: value,
    obs,
    feitoPorUid: state.currentUser.uid,
    feitoPorNome: state.currentProfile?.nome || state.currentUser.email || "ADM",
    createdAt: Date.now()
  });

  const auditRef = push(ref(db, "audit"));
  await set(auditRef, {
    adjustmentId: adjRef.key,
    status: type === "debit" ? "point-debit" : "point-credit",
    registradoPorUid: targetUid,
    registradoPorNome: targetNome,
    charMatou: "-",
    levelMatou: "-",
    charMorreu: "-",
    levelMorreu: "-",
    pontos: type === "debit" ? -value : value,
    obs,
    avaliadoPorUid: state.currentUser.uid,
    avaliadoPorNome: state.currentProfile?.nome || state.currentUser.email || "ADM",
    createdAt: Date.now()
  });

  els.adjustValue.value = "";
  els.adjustObs.value = "";
  showToast("Success");
  bindRanking();
  bindAudit();
}

async function deleteAuditItem(auditId) {
  if (state.currentProfile?.role !== "admin") {
    showToast("Apenas administradores podem remover auditoria.");
    return;
  }

  const ok = confirm("Deseja remover este registro da auditoria e desfazer seus efeitos?");
  if (!ok) return;

  const auditRef = ref(db, `audit/${auditId}`);
  const auditSnap = await get(auditRef);

  if (!auditSnap.exists()) {
    showToast("Registro de auditoria não encontrado.");
    return;
  }

  const auditData = auditSnap.val();

  if (auditData.status === "approved" && auditData.registradoPorUid && Number(auditData.pontos || 0) > 0) {
    const userRef = ref(db, `users/${auditData.registradoPorUid}`);
    const userSnap = await get(userRef);

    if (userSnap.exists()) {
      const currentPoints = Number(userSnap.val().pontos || 0);
      const nextPoints = currentPoints - Number(auditData.pontos || 0);
      await update(userRef, { pontos: nextPoints });
    }
  }

  if ((auditData.status === "point-debit" || auditData.status === "point-credit") && auditData.registradoPorUid) {
    const userRef = ref(db, `users/${auditData.registradoPorUid}`);
    const userSnap = await get(userRef);

    if (userSnap.exists()) {
      const currentPoints = Number(userSnap.val().pontos || 0);
      const pontosAuditoria = Number(auditData.pontos || 0);
      const nextPoints = currentPoints - pontosAuditoria;
      await update(userRef, { pontos: nextPoints });
    }
  }

  if (auditData.killId) {
    await remove(ref(db, `killSubmissions/${auditData.killId}`));
  }

  if (auditData.adjustmentId) {
    await remove(ref(db, `pointAdjustments/${auditData.adjustmentId}`));
  }

  await remove(auditRef);

  showToast("Registro removido e efeitos desfeitos.");
  bindRanking();
  bindAudit();
  bindPending();
}

async function login() {
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  if (!email || !password) {
    showToast("Informe email e senha.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Login realizado");
  } catch (error) {
    showToast("Falha no login. Verifique usuário e senha.");
  }
}

async function logout() {
  await signOut(auth);
  showToast("Sessão encerrada");
}

function registerEvents() {
  els.loginBtn.addEventListener("click", login);
  els.logoutBtn.addEventListener("click", logout);
  els.calculateBtn.addEventListener("click", calculatePreview);
  els.submitKillBtn.addEventListener("click", submitKill);
  els.saveNewsBtn.addEventListener("click", saveNews);
  els.saveAdjustmentBtn.addEventListener("click", saveAdjustment);

  els.refreshNewsBtn.addEventListener("click", () => {
    bindNews();
    showToast("Atualizado");
  });

  els.refreshPendingBtn?.addEventListener("click", () => {
    bindPending();
    showToast("Atualizado");
  });

  els.refreshAuditBtn.addEventListener("click", () => {
    bindAudit();
    showToast("Atualizado");
  });

  els.refreshRankingBtn.addEventListener("click", () => {
    bindRanking(true);
  });

  els.tabs.forEach(tab => {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
  });

  [els.levelMatou, els.levelMorreu].forEach(input => {
    input.addEventListener("input", calculatePreview);
  });

  els.usersBtn?.addEventListener("click", toggleUsersPanel);
  els.closeUsersPanelBtn?.addEventListener("click", () => {
    els.usersPanel.classList.add("hidden");
  });
}

function startBindings() {
  bindNews();
  bindAudit();
  bindRanking();
  bindUsers();

  if (state.currentProfile?.role === "admin") {
    bindPending();
  } else if (state.pendingUnsub) {
    state.pendingUnsub();
    state.pendingUnsub = null;
  }
}

onAuthStateChanged(auth, async user => {
  state.currentUser = user;

  if (!user) {
    state.currentProfile = null;
    els.authSection.classList.remove("hidden");
    els.mainSection.classList.add("hidden");
    els.logoutBtn.classList.add("hidden");
    els.userBadge.classList.add("hidden");
    els.usersPanel.classList.add("hidden");
    updateUiByRole(null);
    return;
  }

  const profile = await ensureUserProfile(user, els.loginEmail.value.trim());
  state.currentProfile = profile;

  els.authSection.classList.add("hidden");
  els.mainSection.classList.remove("hidden");
  els.logoutBtn.classList.remove("hidden");
  els.userBadge.classList.remove("hidden");
  els.userBadge.textContent = `${profile.nome || user.email} • ${profile.role || "user"}`;

  updateUiByRole(profile);
  els.registradoPorNome.value = profile.nome || user.email || "";
  setActiveTab("homeTab");
  startBindings();
});

registerEvents();
