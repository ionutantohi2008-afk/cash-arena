let isRegistered = false;
let isDailyRegistered = false;

const TOURNAMENT_ID = "weekly2";
const TOURNAMENT_HAS_REWARDS = true;

const tournamentStartDate = new Date("2026-08-17T21:00:00");
const tournamentDurationDays = 7;

const tournamentEndDate = new Date(
  tournamentStartDate.getTime() + tournamentDurationDays * 24 * 60 * 60 * 1000
);

function getDailyStartDate() {

  const now = new Date();
  const start = new Date(now);

  start.setHours(19);
  start.setMinutes(30);
  start.setSeconds(0);

  if (now > start) {
    start.setDate(start.getDate() + 1);
  }

  return start;
}

const dailyStartDate =
  getDailyStartDate();

const dailyEndDate = new Date(
  dailyStartDate.getTime() +
  24 * 60 * 60 * 1000
);

let rewardsAlreadyTriggered = false;

auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location = "index.html";
    return;
  }

  document.getElementById("userEmail").innerText = user.email;

  const userDoc = await db.collection("users").doc(user.uid).get();
  const userData = userDoc.data() || {};

  document.getElementById("balance").innerText =
    "💰 Solde : " + (userData.balance || 0) + "€";

  if (userData.leaguePoints === undefined) {
  await db.collection("users").doc(user.uid).set({
    leaguePoints: 0,
    leagueRank: "Bronze"
  }, { merge: true });

  userData.leaguePoints = 0;
  userData.leagueRank = "Bronze";
}

  const playerDoc = await db.collection("tournaments")
    .doc(TOURNAMENT_ID)
    .collection("players")
    .doc(user.uid)
    .get();

  isRegistered = playerDoc.exists;

  updateJoinButton();
  updateTimer();
  updateEndTimer();

  const dailyPlayerDoc = await db
  .collection("tournaments")
  .doc(getDailyTournamentId())
  .collection("players")
  .doc(user.uid)
  .get();

isDailyRegistered = dailyPlayerDoc.exists;

updateDailyButton();
});

function updateTimer() {
  const now = new Date();
  const diff = tournamentStartDate - now;

  const timer = document.getElementById("timer");
  const joinBtn = document.getElementById("joinBtn");
  const endTimer = document.getElementById("endTimer");

  if (!timer || !joinBtn) return;

  if (endTimer) {
    endTimer.style.display = isRegistered ? "block" : "none";
  }

  if (isRegistered) {
    timer.innerText = "✅ Tu es déjà inscrit au tournoi.";
    updateJoinButton();
    return;
  }

  if (diff <= 0) {
    timer.innerText = "✅ Le tournoi a commencé ! Les inscriptions sont ouvertes.";
    joinBtn.disabled = false;
    joinBtn.style.opacity = "1";
    joinBtn.style.cursor = "pointer";
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  timer.innerText =
    `⏳ Début du tournoi dans ${days}j ${hours}h ${minutes}m ${seconds}s`;

  joinBtn.disabled = true;
  joinBtn.style.opacity = "0.6";
  joinBtn.style.cursor = "not-allowed";
}

setInterval(updateTimer, 1000);
updateTimer();

function updateEndTimer() {

  const endTimer =
    document.getElementById("endTimer");

  if (!endTimer) return;

  // IMPORTANT
  if (
    document.getElementById("classement")
      .style.display !== "block"
  ) {

    endTimer.style.display = "none";

    return;
  }

  endTimer.style.display = "block";

  const now = new Date();

  const diff =
    tournamentEndDate - now;

  if (diff <= 0) {

    endTimer.innerText =
      "🏁 Le tournoi est terminé.";

    return;
  }

  const days = Math.floor(
    diff / (1000 * 60 * 60 * 24)
  );

  const hours = Math.floor(
    (diff / (1000 * 60 * 60)) % 24
  );

  const minutes = Math.floor(
    (diff / (1000 * 60)) % 60
  );

  const seconds = Math.floor(
    (diff / 1000) % 60
  );

  endTimer.innerText =
    `🏁 Fin du tournoi dans ${days}j ${hours}h ${minutes}m ${seconds}s`;
}

setInterval(updateEndTimer, 1000);
updateEndTimer();

function updateDailyTimer() {

  const timer =
    document.getElementById("dailyTimer");

  if (!timer) return;

  const now = new Date();

  const nextReset = new Date();

  nextReset.setHours(19);
  nextReset.setMinutes(30);
  nextReset.setSeconds(0);

  // Si déjà passé aujourd'hui
  if (now >= nextReset) {

    nextReset.setDate(
      nextReset.getDate() + 1
    );
  }

  const diff =
    nextReset - now;

  const hours = Math.floor(
    diff / (1000 * 60 * 60)
  );

  const minutes = Math.floor(
    (diff / (1000 * 60)) % 60
  );

  const seconds = Math.floor(
    (diff / 1000) % 60
  );

  timer.innerText =
    `⚡ Daily Cup en cours • Fin dans ${hours}h ${minutes}m ${seconds}s`;
}

setInterval(updateDailyTimer, 1000);

updateDailyTimer();

async function joinTournament(tournamentId) {
  const now = new Date();

  if (now < tournamentStartDate) {
    alert("Les inscriptions ouvriront le 18 mai à 19h30.");
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    alert("Connecte-toi !");
    return;
  }

  const userDoc = await db.collection("users").doc(user.uid).get();
  const userData = userDoc.data() || {};

  const ref = db.collection("tournaments")
    .doc(tournamentId)
    .collection("players")
    .doc(user.uid);

  const doc = await ref.get();

  if (doc.exists) {
    isRegistered = true;
    updateJoinButton();
    updateTimer();
    updateEndTimer();
    showClassement();
    return;
  }

  await ref.set({
  uid: user.uid,
  email: user.email,

  pseudo:
    userData.pseudo ||
    userData.brawlName ||
    user.email,

  isContentCreator:
    userData.isContentCreator || false,

  leagueRank:
    userData.leagueRank || "Bronze",

  leaguePoints:
    userData.leaguePoints || 0,

  brawlTag:
    userData.brawlTag || null,

  brawlName:
    userData.brawlName || null,

  brawlTrophies:
    userData.brawlTrophies || 0,

  points: 0,

  joinedAt: new Date()
});

  alert("Inscription réussie !");

  isRegistered = true;
  updateJoinButton();
  updateTimer();
  updateEndTimer();
  showClassement();
}

function showClassement() {

  hideAllTournaments();

  document.getElementById("classement")
    .style.display = "block";

  document.getElementById("dailyClassement")
    .style.display = "none";

  document.getElementById("endTimer")
    .style.display = "block";

  loadBrawlPlayers();
}

async function loadBrawlPlayers() {

  console.log("loadBrawlPlayers lancé");

  const table =
    document.getElementById("brawlTable");

  if (!table) return;

  const snapshot = await db
    .collection("tournaments")
    .doc(TOURNAMENT_ID)
    .collection("players")
    .get();

  console.log(
    "Tournoi lu :",
    TOURNAMENT_ID
  );

  console.log(
    "Nombre de joueurs :",
    snapshot.size
  );

  let players = [];

  snapshot.forEach(doc => {

    players.push({

      id: doc.id,

      ...doc.data()
    });
  });

  players.sort(
    (a, b) =>
      (b.points || 0)
      - (a.points || 0)
  );

  table.innerHTML = "";

  players.forEach((p, index) => {

    if (TOURNAMENT_HAS_REWARDS) {

      let reward = "0 LP";

      if (index === 0) reward = "150 LP";
      else if (index === 1) reward = "125 LP";
      else if (index === 2) reward = "100 LP";
      else if (index === 3) reward = "70 LP";
      else if (index === 4) reward = "60 LP";
      else if (index === 5) reward = "50 LP";
      else if (index === 6) reward = "40 LP";
      else if (index === 7) reward = "30 LP";
      else if (index === 8) reward = "30 LP";
      else if (index === 9) reward = "30 LP";

      table.innerHTML += `

      <tr>

        <td class="lp-reward">
          ${reward}
        </td>

        <td>
          ${index + 1}
        </td>

        <td class="${index === 0 ? 'top-player' : ''}">

          ${p.pseudo || p.brawlName || p.email}

          ${getRankBadge(
            p.leagueRank || "Bronze"
          )}

          ${
            p.isContentCreator
            ? "<span class='creator-badge'>Content Creator</span>"
            : ""
          }

        </td>

        <td>
          ${p.points || 0}
        </td>

      </tr>
      `;
    }

    else {

      table.innerHTML += `

      <tr>

        <td>
          ${index + 1}
        </td>

        <td class="${index === 0 ? 'top-player' : ''}">

          ${p.pseudo || p.brawlName || p.email}

          ${getRankBadge(
            p.leagueRank || "Bronze"
          )}

          ${
            p.isContentCreator
            ? "<span class='creator-badge'>Content Creator</span>"
            : ""
          }

        </td>

        <td>
          ${p.points || 0}
        </td>

      </tr>
      `;
    }
  });
}

async function finishTournament() {
  if (!TOURNAMENT_HAS_REWARDS) return;

  try {
    const res = await fetch(`https://cash-arena-api.onrender.com/api/tournaments/${TOURNAMENT_ID}/give-rewards`, {
      method: "POST"
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      alert(data.message || "Erreur récompenses");
      return;
    }

    alert("Récompenses distribuées !");
    loadBrawlPlayers();

  } catch (e) {
    console.error(e);
    alert("Erreur serveur");
  }
}

async function autoGiveRewards() {
  if (!TOURNAMENT_HAS_REWARDS) return;
  if (rewardsAlreadyTriggered) return;

  rewardsAlreadyTriggered = true;

  try {
    const res = await fetch(`https://cash-arena-api.onrender.com/api/tournaments/${TOURNAMENT_ID}/give-rewards`, {
      method: "POST"
    });

    const data = await res.json();

    const status = document.getElementById("rewardStatus");

    if (!res.ok || data.error) {
      if (status) status.innerText = data.message || "Erreur récompenses";
      return;
    }

    if (status) status.innerText = "✅ Récompenses distribuées automatiquement !";
    loadBrawlPlayers();

  } catch (e) {
    console.error(e);

    const status = document.getElementById("rewardStatus");
    if (status) status.innerText = "Erreur serveur récompenses.";
  }
}

function parseBrawlTime(battleTime) {
  const year = battleTime.slice(0, 4);
  const month = battleTime.slice(4, 6);
  const day = battleTime.slice(6, 8);
  const hour = battleTime.slice(9, 11);
  const minute = battleTime.slice(11, 13);
  const second = battleTime.slice(13, 15);

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

function updateJoinButton() {
  const joinBtn = document.getElementById("joinBtn");

  if (!joinBtn) return;

  if (isRegistered) {
    joinBtn.innerText = "CLASSEMENT";
    joinBtn.disabled = false;
    joinBtn.style.opacity = "1";
    joinBtn.style.cursor = "pointer";
    joinBtn.onclick = () => showClassement();
  } else {
    joinBtn.innerText = "REJOINDRE LE TOURNOI";
    joinBtn.onclick = () => joinTournament(TOURNAMENT_ID);

    const endTimer = document.getElementById("endTimer");
    if (endTimer) endTimer.style.display = "none";
  }
}

function getRankBadge(rank) {

  switch(rank) {

    case "Bronze":
      return `
        <span class="rank-badge rank-bronze">
          <img src="bronze.png" alt="Bronze">
        </span>
      `;

    case "Silver":
      return `
         <span class="rank-badge rank-silver">
           <img src="silver.png" alt="Silver">
         </span>
       `;

    case "Gold":
      return `
         <span class="rank-badge rank-gold">
           <img src="gold.png" alt="Gold">
         </span>
       `;

    case "Platinum":
      return `
         <span class="rank-badge rank-platinum">
           <img src="platinum.png" alt="Platinum">
         </span>
       `;

    case "Diamond":
      return `
         <span class="rank-badge rank-diamond">
           <img src="diamond.png" alt="Diamond">
         </span>
       `;

    case "Champion":
      return `
         <span class="rank-badge rank-champion">
           <img src="champion.png" alt="Champion">
         </span>
       `;

    case "Legend":
      return `
         <span class="rank-badge rank-legend">
           <img src="legend.png" alt="Legend">
         </span>
       `;

    default:
      return `
        <span class="rank-badge rank-bronze">
          <img src="bronze.png" alt="Bronze">
        </span>
      `;
  }
}

function getDailyTournamentId() {

  const now = new Date();

  // Heure reset : 19h30
  const resetHour = 19;
  const resetMinute = 30;

  // Si avant 19h30
  // on utilise le tournoi d'hier
  if (

    now.getHours() < resetHour ||

    (
      now.getHours() === resetHour &&
      now.getMinutes() < resetMinute
    )

  ) {

    now.setDate(now.getDate() - 1);
  }

  const year =
    now.getFullYear();

  const month =
    String(now.getMonth() + 1)
    .padStart(2, "0");

  const day =
    String(now.getDate())
    .padStart(2, "0");

  return `brawl-daily-${year}-${month}-${day}`;
}

async function joinDailyTournament() {

  const user = auth.currentUser;

  if (!user) {
    alert("Connecte-toi !");
    return;
  }

  const tournamentId =
    getDailyTournamentId();

  const userDoc = await db
    .collection("users")
    .doc(user.uid)
    .get();

  const userData = userDoc.data() || {};

  const ref = db.collection("tournaments")
    .doc(tournamentId)
    .collection("players")
    .doc(user.uid);

  const doc = await ref.get();

  if (doc.exists) {

    alert("Déjà inscrit !");
    return;
  }

  await ref.set({

  uid: user.uid,

  email: user.email,

  pseudo:
    userData.pseudo ||
    user.email,

  isContentCreator:
    userData.isContentCreator || false,

  leagueRank:
    userData.leagueRank || "Bronze",

  leaguePoints:
    userData.leaguePoints || 0,

  brawlTag:
    userData.brawlTag || null,

  brawlName:
    userData.brawlName || null,

  points: 0,

  joinedAt: new Date()
});

  alert("Inscription Daily réussie !");
  isDailyRegistered = true;

  updateDailyButton();

  showDailyClassement();
}

db.collection("tournaments")
  .doc(tournamentId)

function hideAllTournaments() {

  const cards =
    document.querySelectorAll(".tournament-card");

  cards.forEach(card => {
    card.style.display = "none";
  });
}

function showDailyClassement() {

  hideAllTournaments();

  document.getElementById("dailyClassement")
    .style.display = "block";

  document.getElementById("classement")
    .style.display = "none";

  loadDailyPlayers();
}

async function loadDailyPlayers() {

  const table =
    document.getElementById("dailyTable");

  const tournamentId =
    getDailyTournamentId();

  const snapshot = await db
    .collection("tournaments")
    .doc(tournamentId)
    .collection("players")
    .get();

  let players = [];

  snapshot.forEach(doc => {

    players.push({
      id: doc.id,
      ...doc.data()
    });
  });

  players.sort(
    (a, b) =>
      (b.points || 0) - (a.points || 0)
  );

  table.innerHTML = "";

  players.forEach((p, index) => {

    let reward = "";

    if (index === 0) reward = "40 LP";
    else if (index === 1) reward = "30 LP";
    else if (index === 2) reward = "25 LP";
    else if (index <= 4) reward = "20 LP";
    else if (index <= 9) reward = "10 LP";

    table.innerHTML += `

      <tr>

        <td>${reward}</td>

        <td>${index + 1}</td>

        <td class="${index === 0 ? 'top-player' : ''}">

          ${p.pseudo || p.brawlName || p.email}

          ${getRankBadge(p.leagueRank)}

          ${p.isContentCreator
            ? "<span class='creator-badge'>Content Creator</span>"
            : ""
          }

        </td>

        <td>${p.points || 0}</td>

      </tr>
    `;
  });
}

function showTournaments() {

  document.querySelectorAll(".tournament-card")
    .forEach(card => {
      card.style.display = "block";
    });

  document.getElementById("classement")
    .style.display = "none";

  document.getElementById("dailyClassement")
    .style.display = "none";

  document.getElementById("endTimer")
    .style.display = "none";
}

function updateDailyButton() {

  const btn =
    document.getElementById("dailyJoinBtn");

  if (!btn) return;

  if (isDailyRegistered) {

    btn.innerText = "CLASSEMENT";

    btn.onclick = () => {

      showDailyClassement();
    };

  } else {

    btn.innerText =
      "REJOINDRE LE TOURNOI";

    btn.onclick = () => {

      joinDailyTournament();
    };
  }
}

// ======================================================
// 🏆 CONFIGURATION GOLD CUP
// ======================================================
const GOLD_CUP = {
    enabled: true,
    id: "cash1",
    startDate: "2026-09-01T20:00:00", // Date de début
    durationDays: 14,                  // Durée en jours
    rewards: [0.50, 0.30, 0.20, 0.20, 0.20, 0.20, 0.10, 0.10, 0.10, 0.10]
};

// ======================================================
// 📅 RÉCUPÈRE LES DATES (Sécurisé)
// ======================================================
function getGoldCupDates() {
    // Remplacement des tirets par des slashs si nécessaire pour la compatibilité iOS/Safari
    const safeDateString = GOLD_CUP.startDate.replace(/-/g, "/");
    const startDate = new Date(safeDateString);
    
    // Si la date est invalide, fallback sur la chaîne originale
    const validStartDate = isNaN(startDate.getTime()) ? new Date(GOLD_CUP.startDate) : startDate;

    const endDate = new Date(validStartDate.getTime() + GOLD_CUP.durationDays * 24 * 60 * 60 * 1000);

    return {
        startDate: validStartDate,
        endDate
    };
}

// ======================================================
// 🏆 STATUT GOLD CUP
// ======================================================
function getGoldCupStatus() {
    const now = new Date();
    const dates = getGoldCupDates();

    if (now < dates.startDate) {
        return "upcoming";
    }
    if (now >= dates.endDate) {
        return "finished";
    }
    return "live";
}

// ======================================================
// ⏱️ FORMAT DU TEMPS (Corrigé sans saut de ligne après return)
// ======================================================
function formatGoldCupTime(milliseconds) {
    if (milliseconds <= 0) {
        return "00j 00h 00m 00s";
    }

    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    return `${days}j ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

// ======================================================
// ⏱️ TIMER GOLD CUP (Amélioré avec gestion d'état)
// ======================================================
function updateGoldCupTimer() {
    const timer = document.getElementById("goldCupTimer");
    const statusElement = document.getElementById("goldCupStatus");
    const joinButton = document.getElementById("goldCupJoinBtn");

    if (!timer || !statusElement || !joinButton) {
        return;
    }

    // Sécurité : Si le joueur est déjà inscrit, on ne touche pas au texte de son bouton
    const isAlreadyJoined = joinButton.dataset.alreadyJoined === "true";

    // Gold Cup désactivée
    if (!GOLD_CUP.enabled) {
        timer.innerText = "Tournoi indisponible";
        statusElement.innerText = "● INDISPONIBLE";
        statusElement.className = "tournament-status gold-status status-disabled";
        joinButton.disabled = true;
        if (!isAlreadyJoined) joinButton.innerText = "INDISPONIBLE";
        return;
    }

    const now = new Date();
    const dates = getGoldCupDates();
    const status = getGoldCupStatus();

    // ==============================================
    // PAS ENCORE COMMENCÉE
    // ==============================================
    if (status === "upcoming") {
        const remaining = dates.startDate - now;

        timer.innerText = "Début dans : " + formatGoldCupTime(remaining);
        statusElement.innerText = "● BIENTÔT";
        statusElement.className = "tournament-status gold-status status-upcoming";
        
        if (!isAlreadyJoined) {
            joinButton.disabled = false;
            joinButton.innerText = "REJOINDRE LE TOURNOI";
        }
        return;
    }

    // ==============================================
    // LIVE
    // ==============================================
    if (status === "live") {
        const remaining = dates.endDate - now;

        timer.innerText = "Fin dans : " + formatGoldCupTime(remaining);
        statusElement.innerText = "● LIVE";
        statusElement.className = "tournament-status gold-status status-live";
        
        if (!isAlreadyJoined) {
            joinButton.disabled = false;
            joinButton.innerText = "REJOINDRE LE TOURNOI";
        }
        return;
    }

    // ==============================================
    // TERMINÉE
    // ==============================================
    if (status === "finished") {
        timer.innerText = "🏁 Tournoi terminé";
        statusElement.innerText = "● TERMINÉ";
        statusElement.className = "tournament-status gold-status status-finished";
        joinButton.disabled = true;
        joinButton.innerText = "TOURNOI TERMINÉ";
    }
}

// ======================================================
// 💰 AFFICHAGE DES RÉCOMPENSES (Optimisé pour l'UI)
// ======================================================
function loadGoldCupRewards() {
    const rewardElement = document.getElementById("goldCupReward");

    if (!rewardElement) {
        return;
    }

    const rewards = GOLD_CUP.rewards;

    if (!rewards || rewards.length === 0) {
        rewardElement.innerText = "Aucune récompense";
        return;
    }

    // Version optimisée : On affiche de manière propre. 
    // Si vous préférez une liste à puces en HTML, on génère de petits badges.
    let rewardText = "";
    rewards.forEach((reward, index) => {
        if (index > 0) {
            rewardText += "  ";
        }
        // Utilisation de .toFixed(2) pour afficher "0.50€" au lieu de "0.5€" (plus pro)
        rewardText += `#${index + 1}: ${Number(reward).toFixed(2)}€`;
    });

    // Option alternative pour ne pas casser votre design HTML si la ligne est trop longue :
    // On affiche par exemple le top 1 en priorité, ou la liste complète stylisée.
    rewardElement.innerText = `#1 : ${Number(rewards[0]).toFixed(2)}€ (Top 10 dispos)`;
    
    // Si vous préférez garder votre affichage en ligne défilante originel (décommentez la ligne ci-dessous) :
    // rewardElement.innerText = rewards.map((r, i) => `#${i + 1} : ${r}€`).join(" • ");
}

// ======================================================
// 🔒 VÉRIFICATION RANG GOLD OU +
// ======================================================
function canJoinGoldCup(leaguePoints) {
    // Gold commence à 250 LP
    // Bronze : 0 - 99 | Silver : 100 - 249 | Gold : 250+
    const points = Number(leaguePoints);
    return !isNaN(points) && points >= 250;
}

// ======================================================
// 👤 VÉRIFICATION UTILISATEUR (Sécurisée)
// ======================================================
async function checkGoldCupAccess() {
    // Sécurité Firebase : si auth n'est pas encore initialisé
    if (typeof auth === "undefined") {
        console.error("Firebase Auth n'est pas défini sur cette page.");
        alert("Erreur de connexion au serveur d'authentification.");
        return false;
    }

    const user = auth.currentUser;

    if (!user) {
        alert("Tu dois être connecté pour participer à la Gold Cup.");
        return false;
    }

    try {
        if (typeof db === "undefined") {
            console.error("Firestore 'db' n'est pas défini.");
            return false;
        }

        const userDoc = await db.collection("users").doc(user.uid).get();

        if (!userDoc.exists) {
            alert("Profil utilisateur introuvable dans la base de données.");
            return false;
        }

        const userData = userDoc.data() || {};
        const leaguePoints = userData.leaguePoints || 0;

        if (!canJoinGoldCup(leaguePoints)) {
            alert(
                `🔒 Ce tournoi est réservé aux joueurs Gold et plus.\n\n` +
                `Tes LP actuels : ${leaguePoints} LP\n` +
                `Minimum requis : 250 LP`
            );
            return false;
        }

        return {
            user,
            userData,
            leaguePoints
        };

    } catch (error) {
        console.error("Erreur lors de la vérification des accès :", error);
        alert("Impossible de vérifier vos autorisations d'accès.");
        return false;
    }
}

// ======================================================
// 🏆 REJOINDRE LA GOLD CUP
// ======================================================
async function joinGoldCup() {
    const button = document.getElementById("goldCupJoinBtn");
    
    try {
        // ==============================================
        // TOURNOI ACTIF ?
        // ==============================================
        if (typeof GOLD_CUP === "undefined" || !GOLD_CUP.enabled) {
            alert("La Gold Cup est actuellement indisponible.");
            return;
        }

        const status = getGoldCupStatus();

        // ==============================================
        // TERMINÉ
        // ==============================================
        if (status === "finished") {
            alert("🏁 La Gold Cup est terminée.");
            return;
        }

        // Bloquer le bouton pendant le chargement (Évite le double clic)
        if (button) button.disabled = true;

        // ==============================================
        // VÉRIFICATION RANG
        // ==============================================
        const access = await checkGoldCupAccess();
        if (!access) {
            if (button) button.disabled = false;
            return;
        }

        const { user, userData } = access;

        // ==============================================
        // RÉFÉRENCE JOUEUR
        // ==============================================
        const playerRef = db
            .collection("tournaments")
            .doc(GOLD_CUP.id)
            .collection("players")
            .doc(user.uid);

        // ==============================================
        // DÉJÀ INSCRIT ?
        // ==============================================
        const playerDoc = await playerRef.get();
        if (playerDoc.exists) {
            alert("🏆 Tu es déjà inscrit à la Gold Cup.");
            if (button) {
                button.innerText = "✓ DÉJÀ INSCRIT";
                button.disabled = true;
                button.dataset.alreadyJoined = "true"; // Marqueur pour empêcher le timer d'écraser le texte
            }
            return;
        }

        // ==============================================
        // AJOUT JOUEUR
        // ==============================================
        await playerRef.set({
            uid: user.uid,
            pseudo: userData.pseudo || user.displayName || "Joueur",
            email: user.email || null,
            brawlTag: userData.brawlTag || null,
            brawlName: userData.brawlName || null,
            points: 0,
            isBot: false,
            rewardGiven: false,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("🏆 Inscription réussie à la Gold Cup !");
        console.log("🏆 Joueur inscrit à la Gold Cup :", user.uid);

        // ==============================================
        // CHANGE LE BOUTON APRES INSCRIPTION
        // ==============================================
        if (button) {
            button.innerText = "✓ DÉJÀ INSCRIT";
            button.disabled = true;
            button.dataset.alreadyJoined = "true"; // Marqueur de sécurité pour le timer
        }

    } catch (error) {
        console.error("❌ Erreur Gold Cup :", error);
        alert("Une erreur est survenue lors de l'inscription.");
        if (button) button.disabled = false; // Réactive le bouton en cas d'erreur
    }
}

// ======================================================
// 🖱️ INITIALISATION ET ÉVÉNEMENTS
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
    const goldCupButton = document.getElementById("goldCupJoinBtn");

    if (goldCupButton) {
        goldCupButton.addEventListener("click", joinGoldCup);
    }

    // Chargement des récompenses (assurez-vous que cette fonction existe)
    if (typeof loadGoldCupRewards === "function") {
        loadGoldCupRewards();
    }

    // Gestion propre du Timer s'il est présent
    if (typeof updateGoldCupTimer === "function") {
        updateGoldCupTimer();
        setInterval(updateGoldCupTimer, 1000);
    }
});
