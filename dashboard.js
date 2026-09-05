let isRegistered = false;
let isDailyRegistered = false;

const TOURNAMENT_ID = "weekly5";
const TOURNAMENT_HAS_REWARDS = true;

const tournamentStartDate = new Date("2026-09-07T21:10:00");
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

      if (index === 0) reward = "500 LP";
      else if (index === 1) reward = "400 LP";
      else if (index === 2) reward = "300 LP";
      else if (index === 3) reward = "200 LP";
      else if (index === 4) reward = "200 LP";
      else if (index === 5) reward = "150 LP";
      else if (index === 6) reward = "150 LP";
      else if (index === 7) reward = "150 LP";
      else if (index === 8) reward = "150 LP";
      else if (index === 9) reward = "150 LP";
      else if (index <= 14) reward = "100 LP";
      else if (index <= 19) reward = "50 LP";

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

// ======================================================
// 📅 GESTION DU TOURNOI JOURNALIER (DAILY)
// ======================================================

function getDailyTournamentId() {
  const now = new Date();

  // Heure reset : 19h30
  const resetHour = 19;
  const resetMinute = 30;

  // Si avant 19h30, on utilise le tournoi d'hier
  if (
    now.getHours() < resetHour ||
    (now.getHours() === resetHour && now.getMinutes() < resetMinute)
  ) {
    now.setDate(now.getDate() - 1);
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `brawl-daily-${year}-${month}-${day}`;
}

async function joinDailyTournament() {
  const user = auth.currentUser;

  if (!user) {
    alert("Connecte-toi !");
    return;
  }

  const tournamentId = getDailyTournamentId();

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
    pseudo: userData.pseudo || user.email,
    isContentCreator: userData.isContentCreator || false,
    leagueRank: userData.leagueRank || "Bronze",
    leaguePoints: userData.leaguePoints || 0,
    brawlTag: userData.brawlTag || null,
    brawlName: userData.brawlName || null,
    points: 0,
    joinedAt: new Date()
  });

  alert("Inscription Daily réussie !");
  isDailyRegistered = true;

  updateDailyButton();
  showDailyClassement();
}

// ✅ CORRECTION : La ligne parasite non définie a été supprimée ici !

function hideAllTournaments() {
  const cards = document.querySelectorAll(".tournament-card");
  cards.forEach(card => {
    card.style.display = "none";
  });
}

function showDailyClassement() {
  hideAllTournaments();

  document.getElementById("dailyClassement").style.display = "block";
  document.getElementById("classement").style.display = "none";

  loadDailyPlayers();
}

async function loadDailyPlayers() {
  const table = document.getElementById("dailyTable");
  const tournamentId = getDailyTournamentId();

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

  players.sort((a, b) => (b.points || 0) - (a.points || 0));

  table.innerHTML = "";

  players.forEach((p, index) => {
    let reward = "";

    if (index === 0) reward = "150 LP";
    else if (index === 1) reward = "120 LP";
    else if (index === 2) reward = "100 LP";
    else if (index <= 4) reward = "80 LP";
    else if (index <= 9) reward = "50 LP";
    else if (index <= 14) reward = "30 LP";

    table.innerHTML += `
      <tr>
        <td>${reward}</td>
        <td>${index + 1}</td>
        <td class="${index === 0 ? 'top-player' : ''}">
          ${p.pseudo || p.brawlName || p.email}
          ${typeof getRankBadge === "function" ? getRankBadge(p.leagueRank) : p.leagueRank}
          ${p.isContentCreator ? "<span class='creator-badge'>Content Creator</span>" : ""}
        </td>
        <td>${p.points || 0}</td>
      </tr>
    `;
  });
}

function showTournaments() {
  document.querySelectorAll(".tournament-card").forEach(card => {
    card.style.display = "block";
  });

  document.getElementById("classement").style.display = "none";
  document.getElementById("dailyClassement").style.display = "none";
  
  // ✅ Masque proprement le classement de la Gold Cup au retour
  const goldClassement = document.getElementById("goldCupClassement");
  if (goldClassement) goldClassement.style.display = "none";
  
  const endTimer = document.getElementById("endTimer");
  if (endTimer) endTimer.style.display = "none";
}


function updateDailyButton() {
  const btn = document.getElementById("dailyJoinBtn");
  if (!btn) return;

  if (typeof isDailyRegistered !== "undefined" && isDailyRegistered) {
    btn.innerText = "CLASSEMENT";
    btn.onclick = () => {
      showDailyClassement();
    };
  } else {
    btn.innerText = "REJOINDRE LE TOURNOI";
    btn.onclick = () => {
      joinDailyTournament();
    };
  }
}

// ======================================================
// 🏆 MODULE CLIENT GLOBAL : GOLD CUP (VERSION OPTIMISÉE CACHE & READS)
// ======================================================

// Stockage direct en mémoire RAM (0 accès disque tant que la page est ouverte)
let GOLD_CUP_DATA = null;
let IS_PLAYER_REGISTERED_RAM = null; 

// Intervalle du timer global pour pouvoir le nettoyer proprement (Évite les fuites RAM)
let goldCupTimerInterval = null;

// 1️⃣ CHARGEMENT DE LA CONFIGURATION ET DE L'ÉTAT DU JOUEUR
async function fetchGoldCupConfig() {
    try {
        const response = await fetch("https://onrender.com");
        
        if (!response.ok) throw new Error(`Erreur serveur : Status ${response.status}`);
        
        const data = await response.json();

        if (data && data.success && data.enabled) {
            GOLD_CUP_DATA = data;
            
            // Charge la valeur du Cashprize total
            loadGoldCupRewards();
            
            // 🔒 VÉRIFICATION COMMENCEMENT SÉCURISÉE (Optimisée Firestore)
            await checkPlayerRegistrationStatus();
            
            // Lance l'actualisation en direct de manière performante
            startFrontTimerLoop();
        } else {
            setTimerText("Tournoi indisponible");
        }
    } catch (error) {
        console.error("❌ Impossible de joindre l'API Gold Cup :", error);
        setTimerText("Erreur de connexion");
    }
}

// Helper pour modifier le texte proprement
function setTimerText(text) {
    const timerElement = document.getElementById("goldCupTimer");
    if (timerElement) timerElement.innerText = text;
}

// 2️⃣ 💾 SÉCURITÉ PERSISTANCE : DIVISION PAR 100+ DES LECTURES FIRESTORE
async function checkPlayerRegistrationStatus() {
    const joinButton = document.getElementById("goldCupJoinBtn");
    if (!joinButton || !GOLD_CUP_DATA) return;

    // Attendre que l'utilisateur Firebase soit connecté
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) return;

        const cacheKey = `goldCup_reg_${GOLD_CUP_DATA.id}_${user.uid}`;

        // 🟢 ÉTAPE A : Vérification en mémoire vive (RAM) -> Le plus rapide (0ms)
        if (IS_PLAYER_REGISTERED_RAM === true) {
            joinButton.dataset.alreadyJoined = "true";
            renderFrontTimer();
            return;
        }

        // 🟢 ÉTAPE B : Vérification dans le SessionStorage (Survie au rafraîchissement F5) -> (0 lecture Firestore)
        if (sessionStorage.getItem(cacheKey) === "true") {
            IS_PLAYER_REGISTERED_RAM = true; // Synchro RAM
            joinButton.dataset.alreadyJoined = "true";
            renderFrontTimer();
            return;
        }

        // 🔴 ÉTAPE C : Pire des cas (Premier chargement de la session) -> 1 unique lecture Firestore
        try {
            const playerDoc = await db
                .collection("tournaments")
                .doc(GOLD_CUP_DATA.id)
                .collection("players")
                .doc(user.uid)
                .get();

            if (playerDoc.exists) {
                // Mise en cache immédiate pour TOUT le reste de la session de navigation
                sessionStorage.setItem(cacheKey, "true");
                IS_PLAYER_REGISTERED_RAM = true; // Sauvegarde RAM
                
                joinButton.dataset.alreadyJoined = "true";
                renderFrontTimer();
            }
        } catch (error) {
            console.error("❌ Erreur de lecture Firestore :", error);
        }
    });
}

// 3️⃣ GESTION DE LA BOUCLE DU TIMER (Optimisation CPU/RAM)
function startFrontTimerLoop() {
    // On nettoie l'ancien intervalle s'il existait déjà pour éviter les fuites de mémoire (RAM)
    if (goldCupTimerInterval) clearInterval(goldCupTimerInterval);
    
    // Premier affichage immédiat
    renderFrontTimer();
    
    // Boucle toutes le secondes
    goldCupTimerInterval = setInterval(renderFrontTimer, 1000);
}

// 4️⃣ MISE À JOUR VISUELLE DU TIMER ET DU BOUTON
function renderFrontTimer() {
    if (!GOLD_CUP_DATA) return;

    const timer = document.getElementById("goldCupTimer");
    const statusElement = document.getElementById("goldCupStatus");
    const joinButton = document.getElementById("goldCupJoinBtn");

    if (!timer || !statusElement || !joinButton) return;

    const now = new Date();
    const startDate = new Date(GOLD_CUP_DATA.startDate);
    const endDate = new Date(GOLD_CUP_DATA.endDate);
    
    // Lecture optimisée depuis la RAM ou le dataset
    const isAlreadyJoined = IS_PLAYER_REGISTERED_RAM === true || joinButton.dataset.alreadyJoined === "true";

    // ==============================================
    // FILTRAGE : SI LE JOUEUR EST DÉJÀ INSCRIT
    // ==============================================
    if (isAlreadyJoined) {
        joinButton.disabled = false;
        joinButton.innerText = "VOIR LE CLASSEMENT";
        joinButton.onclick = showGoldCupClassement; // Pas de fonction fléchée anonyme (Gain RAM)
        
        if (now < startDate) {
            timer.innerText = "Début dans : " + formatFrontTime(startDate - now);
            statusElement.innerText = "● INSCRIT";
            statusElement.className = "tournament-status gold-status status-upcoming";
        } else if (now >= startDate && now < endDate) {
            timer.innerText = "Fin dans : " + formatFrontTime(endDate - now);
            statusElement.innerText = "● LIVE";
            statusElement.className = "tournament-status gold-status status-live";
        } else {
            timer.innerText = "🏁 Tournoi terminé";
            statusElement.innerText = "● TERMINÉ";
            statusElement.className = "tournament-status gold-status status-finished";
            joinButton.disabled = true;
            joinButton.innerText = "TOURNOI TERMINÉ";
            if (goldCupTimerInterval) clearInterval(goldCupTimerInterval); // Stop la boucle inutilement active
        }
        return;
    }

    // ==============================================
    // FILTRAGE : SI LE JOUEUR N'EST PAS INSCRIT
    // ==============================================
    joinButton.onclick = joinGoldCup; // Pas de fonction fléchée anonyme (Gain RAM)

    if (now < startDate) {
        timer.innerText = "Début dans : " + formatFrontTime(startDate - now);
        statusElement.innerText = "● BIENTÔT";
        statusElement.className = "tournament-status gold-status status-upcoming";
        joinButton.disabled = true;
        joinButton.innerText = "INSCRIPTION INDISPONIBLE";
    } 
    else if (now >= startDate && now < endDate) {
        timer.innerText = "Fin dans : " + formatFrontTime(endDate - now);
        statusElement.innerText = "● LIVE";
        statusElement.className = "tournament-status gold-status status-live";
        joinButton.disabled = false;
        joinButton.innerText = "REJOINDRE LE TOURNOI";
    } 
    else {
        timer.innerText = "🏁 Tournoi terminé";
        statusElement.innerText = "● TERMINÉ";
        statusElement.className = "tournament-status gold-status status-finished";
        joinButton.disabled = true;
        joinButton.innerText = "TOURNOI TERMINÉ";
        if (goldCupTimerInterval) clearInterval(goldCupTimerInterval);
    }
}

// ======================================================
// 🏆 MODULE CLIENT GLOBAL : GOLD CUP (PARTIE 2 - INSCRIPTION & CLASSEMENT OPTIMISÉS)
// ======================================================

// Cache RAM pour éviter de reconstruire le classement si les données n'ont pas changé
let LAST_CLASSEMENT_DATA = null;
let LAST_CLASSEMENT_FETCH_TIME = 0;
const CLASSEMENT_CACHE_DURATION = 30000; // Cache de 30 secondes pour le classement (Évite le spam de clics)

// 4️⃣ SOUMISSION DE L'INSCRIPTION SÉCURISÉE AVEC EFFET CHARGEMENT
async function joinGoldCup() {
    const button = document.getElementById("goldCupJoinBtn");
    if (!GOLD_CUP_DATA) return;

    try {
        // ⏳ Effet visuel : Bloque immédiatement le bouton pour tuer le spam-click
        if (button) {
            button.disabled = true;
            button.innerText = "INSCRIPTION EN COURS...";
        }

        const currentUser = firebase.auth().currentUser;
        const uid = currentUser ? currentUser.uid : null;
        
        if (!uid) {
            alert("Tu dois être connecté.");
            if (button) {
                button.disabled = false;
                button.innerText = "REJOINDRE LE TOURNOI";
            }
            return;
        }

        // Requête à votre API
        const response = await fetch("https://cash-arena-api.onrender.com/api/gold-cup/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: uid })
        });

        const result = await response.json();

        if (result.success) {
            alert("🏆 Inscription à la Cash Cup validée !");
            
            // 🟢 SYNCHRONISATION DU CACHE IMMÉDIATE (Évite 1 lecture Firestore inutile)
            const cacheKey = `goldCup_reg_${GOLD_CUP_DATA.id}_${uid}`;
            sessionStorage.setItem(cacheKey, "true");
            IS_PLAYER_REGISTERED_RAM = true; // Variable RAM déclarée en Partie 1

            if (button) {
                button.dataset.alreadyJoined = "true";
                renderFrontTimer(); // Bascule instantanément sur "VOIR LE CLASSEMENT"
            }
        } else {
            alert(`⚠️ Inscription impossible : ${result.message}`);
            if (button) {
                button.disabled = false;
                button.innerText = "REJOINDRE LE TOURNOI";
            }
        }
    } catch (error) {
        console.error("❌ Erreur inscription :", error);
        alert("Une erreur de communication est survenue.");
        if (button) {
            button.disabled = false;
            button.innerText = "REJOINDRE LE TOURNOI";
        }
    }
}

// 5️⃣ AFFICHAGE DES RECOMPENSES (Optimisation RAM : Conversion explicite propre)
function loadGoldCupRewards() {
    const rewardElement = document.getElementById("goldCupReward");
    if (!rewardElement || !GOLD_CUP_DATA || !GOLD_CUP_DATA.rewards) return;
    
    let totalRewards = 0;
    const rewards = GOLD_CUP_DATA.rewards;
    for (let i = 0; i < rewards.length; i++) {
        totalRewards += Number(rewards[i] || 0);
    }
    rewardElement.innerText = `${totalRewards.toFixed(2)}€`;
}

// 6️⃣ FORMATAGE DU TEMPS (Optimisation RAM : Suppression du padStart répétitif s'il n'est pas requis)
function formatFrontTime(milliseconds) {
    if (milliseconds <= 0) return "00j 00h 00m 00s";
    
    const days = Math.floor(milliseconds / 86400000);
    const hours = Math.floor((milliseconds % 86400000) / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 600000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    
    return `${days}j ${hours < 10 ? '0' + hours : hours}h ${minutes < 10 ? '0' + minutes : minutes}m ${seconds < 10 ? '0' + seconds : seconds}s`;
}

// 7️⃣ INITIALISATION AUTOMATIQUE NETTOYÉE
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGoldCupModule);
} else {
    initGoldCupModule();
}

function initGoldCupModule() {
    fetchGoldCupConfig();
    // 🔴 SUPPRESSION du setInterval sauvage ici ! 
    // Il est désormais géré et nettoyé par startFrontTimerLoop() en Partie 1 pour éviter les fuites RAM.
}

// ======================================================
// 📊 CLASSEMENT EN DIRECT DE LA GOLD CUP
// ======================================================

function showGoldCupClassement() {
    if (typeof hideAllTournaments === "function") {
        hideAllTournaments();
    } else {
        const cards = document.querySelectorAll(".tournament-card");
        for (let i = 0; i < cards.length; i++) {
            cards[i].style.display = "none";
        }
    }

    const goldClassement = document.getElementById("goldCupClassement");
    if (goldClassement) goldClassement.style.display = "block";
    
    const dailyClassement = document.getElementById("dailyClassement");
    if (dailyClassement) dailyClassement.style.display = "none";
    
    const generalClassement = document.getElementById("classement");
    if (generalClassement) generalClassement.style.display = "none";

    loadGoldCupPlayers();
}

// 2️⃣ CHARGER ET TRIER LES JOUEURS (Gros gain financier sur Firestore via Cache temporel + Single string DOM injection)
async function loadGoldCupPlayers() {
    const table = document.getElementById("goldCupTable");
    if (!table) return;

    const now = Date.now();
    const tournamentId = GOLD_CUP_DATA ? GOLD_CUP_DATA.id : "cash1";

    let players = [];

    // 🟢 OPTIMISATION FIRESTORE : Si le classement a été téléchargé il y a moins de 30 secondes, on réutilise la RAM
    if (LAST_CLASSEMENT_DATA && (now - LAST_CLASSEMENT_FETCH_TIME < CLASSEMENT_CACHE_DURATION)) {
        players = LAST_CLASSEMENT_DATA;
    } else {
        try {
            const snapshot = await db
                .collection("tournaments")
                .doc(tournamentId)
                .collection("players")
                .get();

            if (snapshot.empty) {
                table.innerHTML = `<div class="esport-loading">Aucun participant inscrit pour le moment.</div>`;
                return;
            }

            snapshot.forEach(doc => {
                players.push({ id: doc.id, ...doc.data() });
            });

            // Tri décroissant par points
            players.sort((a, b) => (b.points || 0) - (a.points || 0));

            // Sauvegarde dans le cache RAM
            LAST_CLASSEMENT_DATA = players;
            LAST_CLASSEMENT_FETCH_TIME = now;

        } catch (error) {
            console.error("❌ Erreur classement Firestore :", error);
            table.innerHTML = `<div class="esport-loading" style="color:#e74c3c;">Erreur lors du chargement des données.</div>`;
            return;
        }
    }

    // 🟢 OPTIMISATION RAM & RENDU DOM : On accumule dans une seule chaîne de caractères 
    // au lieu de forcer le navigateur à recalculer les styles CSS à chaque ligne (table.innerHTML += ...)
    let htmlBuffer = "";
    const rewardsConfig = GOLD_CUP_DATA ? GOLD_CUP_DATA.rewards : [0.50, 0.30, 0.20, 0.20, 0.20, 0.20, 0.10, 0.10, 0.10, 0.10];

    for (let index = 0; index < players.length; index++) {
        const p = players[index];
        const position = index + 1;
        
        let rewardText = "-";
        if (rewardsConfig && rewardsConfig[index] !== undefined && rewardsConfig[index] > 0) {
            rewardText = `${Number(rewardsConfig[index]).toFixed(2)}€`;
        }

        const crownHtml = position === 1 ? `<span class="crown-winner">👑</span>` : "";

        htmlBuffer += `
            <div class="esport-row ${position === 1 ? 'rank-1' : ''}">
                <div class="reward-box-row">
                    <span class="reward-icon-coin"></span>
                    <span>${rewardText}</span>
                </div>
                <div class="rank-number-box">${position}</div>
                <div class="player-profile-cell">
                    <div class="player-avatar-mini">👤</div>
                    <div class="player-meta">
                        <span class="player-name">${p.pseudo || "Joueur"}</span>
                        <span class="player-league-tag">🔥 ${p.leagueRank || "Gold"}</span>
                    </div>
                </div>
                <div class="points-box-row">
                    <span class="points-value">${p.points || 0}</span>
                    ${crownHtml}
                </div>
            </div>
        `;
    }

    // Injection unique dans le DOM (Gain massif CPU / Fluidité d'affichage)
    table.innerHTML = htmlBuffer;
}
