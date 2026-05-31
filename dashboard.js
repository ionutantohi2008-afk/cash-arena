let isRegistered = false;
let isDailyRegistered = false;

const TOURNAMENT_ID = "brawl-5";
const TOURNAMENT_HAS_REWARDS = true;

const tournamentStartDate = new Date("2026-06-01T19:30:00");
const tournamentDurationDays = 5;

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

      if (index === 0) reward = "30 LP";
      else if (index === 1) reward = "20 LP";
      else if (index === 2) reward = "10 LP";
      else if (index === 3) reward = "8 LP";
      else if (index === 4) reward = "7 LP";
      else if (index === 5) reward = "6 LP";
      else if (index === 6) reward = "5 LP";
      else if (index === 7) reward = "5 LP";
      else if (index === 8) reward = "4 LP";
      else if (index === 9) reward = "4 LP";

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

async function calculatePlayerPoints(player) {
  if (!player.brawlTag) return player.points || 0;

  const res = await fetch(
    `https://cash-arena-api.onrender.com/api/brawl/player/${encodeURIComponent(player.brawlTag)}/battlelog`
  );

  const data = await res.json();

  if (!res.ok || data.error || !data.items) {
    console.error("Erreur battlelog", data);
    return player.points || 0;
  }

  const joinedAt = player.joinedAt?.toDate
    ? player.joinedAt.toDate()
    : tournamentStartDate;

  let points = 0;

  data.items.forEach(item => {
    const battleTime = parseBrawlTime(item.battleTime);

    if (battleTime < joinedAt) {
      return;
    }

    const result = item.battle?.result;

    if (result === "victory") {
      points += 3;
    } else if (result === "defeat") {
      points += 1;
    }
  });

  return points;
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
      return `<span class="rank-badge rank-bronze">🥉 Bronze</span>`;

    case "Silver":
      return `<span class="rank-badge rank-silver">🥈 Silver</span>`;

    case "Gold":
      return `<span class="rank-badge rank-gold">🥇 Gold</span>`;

    case "Platinum":
      return `<span class="rank-badge rank-platinum">💎 Platinum</span>`;

    case "Diamond":
      return `<span class="rank-badge rank-diamond">🔷 Diamond</span>`;

    case "Champion":
      return `<span class="rank-badge rank-champion">👑 Champion</span>`;

    case "Legend":
      return `<span class="rank-badge rank-legend">🔥 Legend</span>`;

    default:
      return `<span class="rank-badge rank-bronze">🥉 Bronze</span>`;
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

    if (index === 0) reward = "10 LP";
    else if (index === 1) reward = "7 LP";
    else if (index === 2) reward = "5 LP";
    else if (index <= 4) reward = "3 LP";
    else if (index <= 9) reward = "1 LP";

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

function showRankUp(oldRank, newRank) {

  const popup =
    document.getElementById(
      "rankUpPopup"
    );

  const text =
    document.getElementById(
      "rankUpText"
    );

  if (!popup || !text) return;

  text.innerText =
    `${oldRank} → ${newRank}`;

  popup.classList.add("show");

  setTimeout(() => {

    popup.classList.remove("show");

  }, 5000);
}

const oldRank =
  userData.leagueRank;

const newRank =
  calculateRank(lp);

if (newRank !== oldRank) {

  showRankUp(
    oldRank,
    newRank
  );
}



const savedLanguage = localStorage.getItem("language") || "fr";
applyLanguage(savedLanguage);
