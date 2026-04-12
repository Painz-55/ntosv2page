import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { appSettings, firebaseSettings } from "./firebase-config.js";

const app = initializeApp(firebaseSettings);
const auth = getAuth(app);
const db = getDatabase(app);

const state = {
  authUser: null,
  profile: null,
  users: {},
  news: {},
  kills: {},
  audits: {},
  missingProfileWarningShown: false
};

const dom = {
  loginCard: document.getElementById("loginCard"),
  appContent: document.getElementById("appContent"),
  loginForm: document.getElementById("loginForm"),
  logoutButton: document.getElementById("logoutButton"),
  usersPanelButton: document.getElementById("usersPanelButton"),
  closeUsersPanelButton: document.getElementById("closeUsersPanelButton"),
  usersPanel: document.getElementById("usersPanel"),
  usersPanelList: document.getElementById("usersPanelList"),
  welcomeTitle: document.getElementById("welcomeTitle"),
  welcomeSubtitle: document.getElementById("welcomeSubtitle"),
  currentUserPoints: document.getElementById("currentUserPoints"),
  currentUserRole: document.getElementById("currentUserRole"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  newsForm: document.getElementById("newsForm"),
  newsList: document.getElementById("newsList"),
  killForm: document.getElementById("killForm"),
  killReporter: document.getElementById("killReporter"),
  killerName: document.getElementById("killerName"),
  killerLevel: document.getElementById("killerLevel"),
  victimName: document.getElementById("victimName"),
  victimLevel: document.getElementById("victimLevel"),
  killPointsPreview: document.getElementById("killPointsPreview"),
  killPointsBreakdown: document.getElementById("killPointsBreakdown"),
  pendingKillsList: document.getElementById("pendingKillsList"),
  adjustmentForm: document.getElementById("adjustmentForm"),
  adjustmentUser: document.getElementById("adjustmentUser"),
  adjustmentType: document.getElementById("adjustmentType"),
  adjustmentAmount: document.getElementById("adjustmentAmount"),
  adjustmentObservation: document.getElementById("adjustmentObservation"),
  rankingList: document.getElementById("rankingList"),
  refreshRankingButton: document.getElementById("refreshRankingButton"),
  auditList: document.getElementById("auditList"),
  toastContainer: document.getElementById("toastContainer")
};

const refs = {
  users: ref(db, "users"),
  news: ref(db, "news"),
  kills: ref(db, "kills"),
  audits: ref(db, "audits")
};

const realtimeUnsubscribers = [];

const pointsTable = [
  { min: 800, points: 50 },
  { min: 700, points: 30 },
  { min: 600, points: 10 },
  { min: 500, points: 5 },
  { min: 400, points: 3 }
];

function isAdmin() {
  return state.profile?.role === "admin";
}

function sanitizeText(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toDateLabel(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString("pt-BR") : "Sem data";
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

function showFirebaseError(context, error) {
  console.error(`${context}:`, error);

  if (error?.code === "PERMISSION_DENIED" || error?.code === "permission_denied") {
    showToast(`Firebase bloqueou o acesso em ${context}. Verifique as regras e o perfil do usuário.`, "error");
    return;
  }

  showToast(`Falha em ${context}. Veja o console do navegador para mais detalhes.`, "error");
}

function clearRealtimeListeners() {
  while (realtimeUnsubscribers.length) {
    const unsubscribe = realtimeUnsubscribers.pop();
    if (typeof unsubscribe === "function") unsubscribe();
  }
}

function renderEmptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function getBasePoints(victimLevel) {
  const match = pointsTable.find((entry) => victimLevel >= entry.min);
  return match?.points ?? 0;
}

function getMultiplier(killerLevel, victimLevel) {
  const difference = victimLevel - killerLevel;

  if (difference < -100) return 0.5;
  if (difference <= 0) return 1;
  if (difference <= 100) return 1.5;
  return 2;
}

function calculateKillPoints(killerLevel, victimLevel) {
  // Mantém a regra de cálculo centralizada para reaproveitar no preview e no envio.
  const basePoints = getBasePoints(victimLevel);
  const multiplier = getMultiplier(killerLevel, victimLevel);
  const finalPoints = Math.round(basePoints * multiplier * 100) / 100;

  return { basePoints, multiplier, finalPoints };
}

function getUsersArray() {
  return Object.entries(state.users)
    .map(([uid, user]) => ({ uid, ...user }))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}

function setActiveSection(sectionId) {
  document.querySelectorAll(".content-section").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  dom.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionId);
  });
}

function updateRoleBasedUI() {
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.classList.toggle("hidden", !isAdmin());
  });
}

function renderHeader() {
  dom.killReporter.value = state.profile?.name ?? "";
  dom.welcomeTitle.textContent = state.profile ? `Bem-vindo, ${state.profile.name}` : "Carregando...";
  dom.currentUserPoints.textContent = String(state.profile?.points ?? 0);
  dom.currentUserRole.textContent = state.profile?.role ?? "user";
  dom.welcomeSubtitle.textContent = isAdmin()
    ? "Você possui privilégios administrativos para moderação, auditoria e ajustes."
    : "Você pode registrar kills e acompanhar notícias, ranking e auditoria.";
}

function renderNews() {
  const items = Object.entries(state.news)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  dom.newsList.innerHTML = items.length
    ? items.map((item) => `
      <article class="list-card">
        <div class="list-card-header">
          <h4>${escapeHtml(item.title)}</h4>
          <span class="pill">${toDateLabel(item.createdAt)}</span>
        </div>
        <p>${escapeHtml(item.content)}</p>
        <div class="list-card-footer">
          <span class="meta-text">Publicado por ${escapeHtml(item.authorName ?? "Sistema")}</span>
        </div>
      </article>
    `).join("")
    : renderEmptyState("Nenhuma notícia cadastrada.");
}

function renderPendingKills() {
  const items = Object.entries(state.kills)
    .map(([id, item]) => ({ id, ...item }))
    .filter((item) => item.status === "pending")
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  dom.pendingKillsList.innerHTML = items.length
    ? items.map((item) => `
      <article class="list-card">
        <div class="list-card-header">
          <div>
            <h4>${escapeHtml(item.killerName)} x ${escapeHtml(item.victimName)}</h4>
            <p>Registrado por ${escapeHtml(item.reporterName)}</p>
          </div>
          <span class="pill warning">Pendente</span>
        </div>
        <div class="audit-meta">
          <span class="meta-text">Lv. ${item.killerLevel} matou Lv. ${item.victimLevel}</span>
          <span class="meta-text">Calculado: ${item.calculatedPoints}</span>
        </div>
        <div class="inline-form-row">
          <input type="number" min="0" step="0.5" value="${item.finalPoints ?? item.calculatedPoints}" data-role="points-input" data-kill-id="${item.id}">
          <textarea rows="2" placeholder="Observação (obrigatória se alterar pontos)" data-role="observation-input" data-kill-id="${item.id}"></textarea>
        </div>
        <div class="list-card-footer">
          <span class="meta-text">Data: ${toDateLabel(item.createdAt)}</span>
          <div class="inline-form-row">
            <button class="primary-button" type="button" data-action="approve-kill" data-kill-id="${item.id}">Aprovar</button>
            <button class="danger-button" type="button" data-action="reject-kill" data-kill-id="${item.id}">Reprovar</button>
          </div>
        </div>
      </article>
    `).join("")
    : renderEmptyState("Nenhuma kill pendente.");
}

function renderRanking() {
  const items = getUsersArray();
  dom.rankingList.innerHTML = items.length
    ? items.map((user, index) => `
      <article class="list-card ranking-row">
        <div>
          <span class="pill">#${index + 1}</span>
          <h4>${escapeHtml(user.name)}</h4>
        </div>
        <div>
          <strong>${user.points ?? 0} pts</strong>
          <p class="meta-text">${escapeHtml(user.role)}</p>
        </div>
      </article>
    `).join("")
    : renderEmptyState("Nenhum usuário encontrado.");
}

function renderAudit() {
  const items = Object.entries(state.audits)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  dom.auditList.innerHTML = items.length
    ? items.map((item) => `
      <article class="list-card">
        <div class="list-card-header">
          <div>
            <h4>${escapeHtml(item.title ?? item.type)}</h4>
            <p>${escapeHtml(item.description ?? "Sem descrição")}</p>
          </div>
          <span class="pill ${item.pointsDelta > 0 ? "success" : item.pointsDelta < 0 ? "danger" : ""}">
            ${item.pointsDelta ?? 0} pts
          </span>
        </div>
        <div class="audit-meta">
          <span class="meta-text">Aprovador: ${escapeHtml(item.approverName ?? "Sistema")}</span>
          <span class="meta-text">Data: ${toDateLabel(item.createdAt)}</span>
        </div>
        <p class="meta-text">Obs: ${escapeHtml(item.observation || "Sem observação")}</p>
        ${isAdmin() ? `<div class="list-card-footer"><button class="danger-button" type="button" data-action="delete-audit" data-audit-id="${item.id}">Remover registro</button></div>` : ""}
      </article>
    `).join("")
    : renderEmptyState("Nenhum item na auditoria.");
}

function renderUsersPanel() {
  const items = getUsersArray().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  dom.usersPanelList.innerHTML = items.length
    ? items.map((user) => `
      <article class="list-card">
        <div class="list-card-header">
          <h4>${escapeHtml(user.name)}</h4>
          <span class="pill">${escapeHtml(user.role)}</span>
        </div>
        <p class="meta-text">UID: ${escapeHtml(user.uid)}</p>
        <p class="meta-text">${escapeHtml(user.email ?? "Sem email")}</p>
      </article>
    `).join("")
    : renderEmptyState("Nenhum usuário cadastrado.");
}

function renderAdjustmentUsers() {
  const items = getUsersArray().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  dom.adjustmentUser.innerHTML = items.length
    ? items.map((user) => `<option value="${user.uid}">${escapeHtml(user.name)} (${user.points ?? 0} pts)</option>`).join("")
    : "<option value=''>Nenhum usuário</option>";
}

function updateKillPreview() {
  const killerLevel = Number(dom.killerLevel.value);
  const victimLevel = Number(dom.victimLevel.value);

  if (!killerLevel || !victimLevel) {
    dom.killPointsPreview.textContent = "0";
    dom.killPointsBreakdown.textContent = "Preencha os levels para visualizar o cálculo.";
    return;
  }

  const { basePoints, multiplier, finalPoints } = calculateKillPoints(killerLevel, victimLevel);
  dom.killPointsPreview.textContent = String(finalPoints);
  dom.killPointsBreakdown.textContent = `Base ${basePoints} x multiplicador ${multiplier} = ${finalPoints} ponto(s).`;
}

function renderAll() {
  renderHeader();
  renderNews();
  renderPendingKills();
  renderRanking();
  renderAudit();
  renderUsersPanel();
  renderAdjustmentUsers();
  updateRoleBasedUI();
}

function updateAppVisibility() {
  const hasAuthenticatedUser = Boolean(state.authUser);
  const hasProfile = Boolean(state.profile);

  if (!hasAuthenticatedUser) {
    dom.loginCard.classList.remove("hidden");
    dom.appContent.classList.add("hidden");
    dom.logoutButton.classList.add("hidden");
    dom.usersPanel.classList.add("hidden");
    return;
  }

  dom.logoutButton.classList.remove("hidden");

  if (!hasProfile) {
    dom.loginCard.classList.remove("hidden");
    dom.appContent.classList.add("hidden");
    return;
  }

  dom.loginCard.classList.add("hidden");
  dom.appContent.classList.remove("hidden");
}

function requireAdmin() {
  if (!isAdmin()) {
    showToast("Apenas administradores podem fazer isso.", "error");
    throw new Error("Admin only");
  }
}

async function sendDiscordWebhook(payload) {
  const webhookUrl = sanitizeText(appSettings.discordWebhookUrl);
  if (!webhookUrl || webhookUrl.includes("COLE_AQUI")) return;

  const content = [
    "**Nova kill registrada**",
    `Jogador: ${payload.reporterName}`,
    `Matou: ${payload.killerName} (Lv ${payload.killerLevel})`,
    `Morreu: ${payload.victimName} (Lv ${payload.victimLevel})`,
    `Pontos: ${payload.calculatedPoints}`
  ].join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
  } catch (error) {
    console.error("Webhook Discord falhou:", error);
    showToast("Kill salva, mas o webhook do Discord falhou.", "warning");
  }
}

async function sendApprovalDiscordWebhook(payload) {
  const webhookUrl = sanitizeText(appSettings.discordApprovalWebhookUrl);
  if (!webhookUrl || webhookUrl.includes("COLE_AQUI")) return;

  const content = [
    "**Kill aprovada**",
    `Jogador: ${payload.reporterName}`,
    `Assassino: ${payload.killerName} (Lv ${payload.killerLevel})`,
    `Vitima: ${payload.victimName} (Lv ${payload.victimLevel})`,
    `Pontos finais: ${payload.finalPoints}`,
    `Aprovado por: ${payload.reviewedByName}`,
    `Observacao: ${payload.observation || "Sem observacao."}`
  ].join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
  } catch (error) {
    console.error("Webhook de aprovacao falhou:", error);
    showToast("Kill aprovada, mas o webhook de aprovação falhou.", "warning");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = sanitizeText(document.getElementById("loginEmail").value);
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    dom.loginForm.reset();
    showToast("Login realizado com sucesso.");
  } catch (error) {
    console.error(error);
    showToast("Falha no login. Verifique email e senha.", "error");
  }
}

async function handleNewsSubmit(event) {
  event.preventDefault();
  requireAdmin();

  const title = sanitizeText(document.getElementById("newsTitle").value);
  const content = sanitizeText(document.getElementById("newsContent").value);

  if (!title || !content) {
    showToast("Preencha título e conteúdo.", "error");
    return;
  }

  const newsRef = push(refs.news);
  await set(newsRef, {
    title,
    content,
    authorUid: state.authUser.uid,
    authorName: state.profile.name,
    createdAt: Date.now()
  });

  dom.newsForm.reset();
  showToast("Notícia publicada com sucesso.");
}

async function handleKillSubmit(event) {
  event.preventDefault();
  if (!state.profile) return;

  const killerName = sanitizeText(dom.killerName.value);
  const victimName = sanitizeText(dom.victimName.value);
  const killerLevel = Number(dom.killerLevel.value);
  const victimLevel = Number(dom.victimLevel.value);

  if (!killerName || !victimName || !killerLevel || !victimLevel) {
    showToast("Preencha todos os campos da kill.", "error");
    return;
  }

  const calculation = calculateKillPoints(killerLevel, victimLevel);
  const killRef = push(refs.kills);
  const payload = {
    reporterUid: state.authUser.uid,
    reporterName: state.profile.name,
    reporterEmail: state.profile.email,
    killerName,
    killerLevel,
    victimName,
    victimLevel,
    basePoints: calculation.basePoints,
    multiplier: calculation.multiplier,
    calculatedPoints: calculation.finalPoints,
    finalPoints: calculation.finalPoints,
    status: "pending",
    createdAt: Date.now()
  };

  await set(killRef, payload);
  await sendDiscordWebhook(payload);
  dom.killForm.reset();
  dom.killReporter.value = state.profile.name;
  updateKillPreview();
  showToast("Kill enviada para avaliação.");
}

async function reviewKill(killId, nextStatus) {
  requireAdmin();
  const kill = state.kills[killId];
  if (!kill || kill.status !== "pending") {
    showToast("Kill não encontrada ou já processada.", "error");
    return;
  }

  const pointsInput = document.querySelector(`[data-role="points-input"][data-kill-id="${killId}"]`);
  const observationInput = document.querySelector(`[data-role="observation-input"][data-kill-id="${killId}"]`);
  const finalPoints = Number(pointsInput?.value ?? kill.calculatedPoints);
  const observation = sanitizeText(observationInput?.value);
  const changed = finalPoints !== Number(kill.calculatedPoints);

  if (changed && !observation) {
    showToast("Observação obrigatória ao alterar os pontos.", "error");
    return;
  }

  const reviewedAt = Date.now();
  const pointsDelta = nextStatus === "approved" ? finalPoints : 0;

  await set(ref(db, `kills/${killId}`), {
    ...kill,
    status: nextStatus,
    finalPoints,
    observation,
    reviewedAt,
    reviewedByUid: state.authUser.uid,
    reviewedByName: state.profile.name
  });

  if (nextStatus === "approved") {
    // A soma de pontos usa transaction para reduzir risco de conflito em updates simultâneos.
    await runTransaction(ref(db, `users/${kill.reporterUid}/points`), (currentValue) => (Number(currentValue) || 0) + finalPoints);
  }

  const auditRef = push(refs.audits);
  await set(auditRef, {
    type: nextStatus === "approved" ? "kill_approved" : "kill_rejected",
    relatedKillId: killId,
    targetUid: kill.reporterUid,
    targetName: kill.reporterName,
    title: nextStatus === "approved" ? "Kill aprovada" : "Kill reprovada",
    description: `${kill.killerName} derrotou ${kill.victimName}`,
    killerName: kill.killerName,
    victimName: kill.victimName,
    pointsDelta,
    approverUid: state.authUser.uid,
    approverName: state.profile.name,
    observation: observation || "Sem observação.",
    createdAt: reviewedAt
  });

  if (nextStatus === "approved") {
    await sendApprovalDiscordWebhook({
      ...kill,
      finalPoints,
      observation,
      reviewedByName: state.profile.name
    });
  }

  showToast(nextStatus === "approved" ? "Kill aprovada." : "Kill reprovada.", nextStatus === "approved" ? "success" : "warning");
}

async function handleAdjustmentSubmit(event) {
  event.preventDefault();
  requireAdmin();

  const targetUid = dom.adjustmentUser.value;
  const type = dom.adjustmentType.value;
  const amount = Number(dom.adjustmentAmount.value);
  const observation = sanitizeText(dom.adjustmentObservation.value);
  const targetUser = state.users[targetUid];

  if (!targetUid || !targetUser || amount < 1 || !observation) {
    showToast("Selecione jogador, quantidade e observação.", "error");
    return;
  }

  if (type === "remove" && Number(targetUser.points || 0) < amount) {
    showToast("O jogador não possui pontos suficientes para esta remoção.", "error");
    return;
  }

  const pointsDelta = type === "remove" ? -amount : amount;

  await runTransaction(ref(db, `users/${targetUid}/points`), (currentValue) => {
    const next = (Number(currentValue) || 0) + pointsDelta;
    return next < 0 ? 0 : next;
  });

  const auditRef = push(refs.audits);
  await set(auditRef, {
    type: "points_adjustment",
    targetUid,
    targetName: targetUser.name,
    title: pointsDelta >= 0 ? "Ajuste positivo de pontos" : "Ajuste negativo de pontos",
    description: `Ajuste manual para ${targetUser.name}`,
    pointsDelta,
    approverUid: state.authUser.uid,
    approverName: state.profile.name,
    observation,
    createdAt: Date.now()
  });

  dom.adjustmentForm.reset();
  renderAdjustmentUsers();
  showToast("Ajuste de pontos salvo.");
}

async function deleteAuditRecord(auditId) {
  requireAdmin();
  const audit = state.audits[auditId];

  if (!audit) {
    showToast("Registro não encontrado.", "error");
    return;
  }

  if (audit.pointsDelta) {
    // Reverter o delta registrado na auditoria mantém o ranking consistente ao excluir o histórico.
    await runTransaction(ref(db, `users/${audit.targetUid}/points`), (currentValue) => {
      const next = (Number(currentValue) || 0) - Number(audit.pointsDelta);
      return next < 0 ? 0 : next;
    });
  }

  if (audit.relatedKillId) {
    await remove(ref(db, `kills/${audit.relatedKillId}`));
  }

  await remove(ref(db, `audits/${auditId}`));
  showToast("Registro removido e pontos revertidos.");
}

function bindRealtimeData() {
  clearRealtimeListeners();

  realtimeUnsubscribers.push(onValue(refs.users, (snapshot) => {
    state.users = snapshot.val() || {};
    state.profile = state.authUser ? state.users[state.authUser.uid] || null : null;

    if (state.authUser && !state.profile && !state.missingProfileWarningShown) {
      state.missingProfileWarningShown = true;
      showToast("Login feito, mas o perfil do usuário não existe em /users/{uid}.", "error");
    }

    if (state.profile) {
      state.missingProfileWarningShown = false;
    }

    updateAppVisibility();
    renderAll();
  }, (error) => {
    showFirebaseError("users", error);
  }));

  realtimeUnsubscribers.push(onValue(refs.news, (snapshot) => {
    state.news = snapshot.val() || {};
    renderNews();
  }, (error) => {
    showFirebaseError("news", error);
  }));

  realtimeUnsubscribers.push(onValue(refs.kills, (snapshot) => {
    state.kills = snapshot.val() || {};
    renderPendingKills();
  }, (error) => {
    showFirebaseError("kills", error);
  }));

  realtimeUnsubscribers.push(onValue(refs.audits, (snapshot) => {
    state.audits = snapshot.val() || {};
    renderAudit();
  }, (error) => {
    showFirebaseError("audits", error);
  }));
}

function handleAuthState(user) {
  state.authUser = user;
  state.missingProfileWarningShown = false;

  if (!user) {
    state.profile = null;
    state.users = {};
    state.news = {};
    state.kills = {};
    state.audits = {};
    clearRealtimeListeners();
    updateAppVisibility();
    updateRoleBasedUI();
    renderAll();
    return;
  }

  state.profile = state.users[user.uid] || null;
  bindRealtimeData();
  updateAppVisibility();
  updateRoleBasedUI();

  if (state.profile) {
    setActiveSection(isAdmin() ? appSettings.defaultTabForAdmin : appSettings.defaultTabForUser);
    renderAll();
  }
}

function bindEvents() {
  dom.loginForm.addEventListener("submit", handleLogin);
  dom.newsForm.addEventListener("submit", handleNewsSubmit);
  dom.killForm.addEventListener("submit", handleKillSubmit);
  dom.adjustmentForm.addEventListener("submit", handleAdjustmentSubmit);

  dom.logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    showToast("Logout realizado.", "warning");
  });

  dom.killerLevel.addEventListener("input", updateKillPreview);
  dom.victimLevel.addEventListener("input", updateKillPreview);

  dom.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveSection(button.dataset.section));
  });

  dom.refreshRankingButton.addEventListener("click", () => {
    renderRanking();
    showToast(appSettings.rankingRefreshMessage);
  });

  dom.usersPanelButton.addEventListener("click", () => {
    dom.usersPanel.classList.remove("hidden");
    dom.usersPanel.setAttribute("aria-hidden", "false");
  });

  dom.closeUsersPanelButton.addEventListener("click", () => {
    dom.usersPanel.classList.add("hidden");
    dom.usersPanel.setAttribute("aria-hidden", "true");
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    try {
      if (target.dataset.action === "approve-kill") {
        await reviewKill(target.dataset.killId, "approved");
      }
      if (target.dataset.action === "reject-kill") {
        await reviewKill(target.dataset.killId, "rejected");
      }
      if (target.dataset.action === "delete-audit") {
        await deleteAuditRecord(target.dataset.auditId);
      }
    } catch (error) {
      console.error(error);
    }
  });
}

bindEvents();
onAuthStateChanged(auth, handleAuthState);
