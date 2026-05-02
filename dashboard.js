auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location = "index.html";
    return;
  }

  document.getElementById("userEmail").innerText = user.email;

  const doc = await db.collection("users").doc(user.uid).get();

  if (doc.exists) {
    document.getElementById("balance").innerText =
      "💰 Solde : " + (doc.data().balance || 0) + "€";
  }
});

function logout() {
  auth.signOut().then(() => window.location = "index.html");
}

// Date de début du tournoi
const tournamentStartDate = new Date("2026-05-04T19:30:00");

// Durée du tournoi en jours
const tournamentDurationDays = 2;

// Date de fin automatique
const tournamentEndDate = new Date(
  tournamentStartDate.getTime() + tournamentDurationDays * 24 * 60 * 60 * 1000
);

let rewardsAlreadyTriggered = false;

function updateTimer() {
  const now = new Date();
  const diff = tournamentStartDate - now;

  const timer = document.getElementById("timer");
  const joinBtn = document.getElementById("joinBtn");

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
  const now = new Date();
  const diff = tournamentEndDate - now;

  const endTimer = document.getElementById("endTimer");

  if (!endTimer) return;

  if (diff <= 0) {
    endTimer.innerText = "🏁 Le tournoi est terminé.";

    autoGiveRewards();
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  endTimer.innerText =
    `🏁 Fin du tournoi dans ${days}j ${hours}h ${minutes}m ${seconds}s`;
}

setInterval(updateEndTimer, 1000);
updateEndTimer();

async function joinTournament(tournamentId) {
  const now = new Date();

  if (now < tournamentStartDate) {
    alert("Les inscriptions ouvriront le 4 mai à 19h30.");
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
    alert("Déjà inscrit !");
    showClassement();
    return;
  }

await ref.set({
  uid: user.uid,
  email: user.email,
  pseudo: userData.pseudo || userData.brawlName || user.email,
  brawlTag: userData.brawlTag || null,
  brawlName: userData.brawlName || null,
  brawlTrophies: userData.brawlTrophies || 0,
  points: 0,
  joinedAt: new Date()
});

  alert("Inscription réussie !");
  showClassement();
}

function showClassement() {
  document.querySelector(".tournament-card").style.display = "none";
  document.getElementById("classement").style.display = "block";
  loadBrawlPlayers();
}

async function loadBrawlPlayers() {
  const table = document.getElementById("brawlTable");

  const snapshot = await db.collection("tournaments")
    .doc("brawl")
    .collection("players")
    .get();

  let players = [];

  snapshot.forEach(doc => {
    players.push({
      id: doc.id,
      ...doc.data()
    });
  });

  for (const player of players) {
    const newPoints = await calculatePlayerPoints(player);

    player.points = newPoints;

    await db.collection("tournaments")
      .doc("brawl")
      .collection("players")
      .doc(player.id)
      .update({
        points: newPoints,
        pointsUpdatedAt: new Date()
      });
  }

  players.sort((a, b) => (b.points || 0) - (a.points || 0));

  table.innerHTML = "";

  players.forEach((p, index) => {
    let reward = "0€";

    if (index === 0) reward = "1.00€";
    else if (index === 1) reward = "0.50€";
    else if (index === 2) reward = "0.25€";
    else if (index === 3) reward = "0.25€";

    table.innerHTML += `
      <tr>
        <td>${reward}</td>
        <td>${index + 1}</td>
        <td>${p.pseudo || p.brawlName || p.email}</td>
        <td>${p.points || 0}</td>
      </tr>
    `;
  });
}

async function finishTournament() {
  try {
    const res = await fetch("https://cash-arena-api.onrender.com/api/tournaments/brawl/give-rewards", {
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
  if (rewardsAlreadyTriggered) return;

  rewardsAlreadyTriggered = true;

  try {
    const res = await fetch("https://cash-arena-api.onrender.com/api/tournaments/brawl/give-rewards", {
      method: "POST"
    });

    const data = await res.json();

    const status = document.getElementById("rewardStatus");

    if (!res.ok || data.error) {
      status.innerText = data.message || "Erreur récompenses";
      return;
    }

    status.innerText = "✅ Récompenses distribuées automatiquement !";
    loadBrawlPlayers();

  } catch (e) {
    console.error(e);
    document.getElementById("rewardStatus").innerText =
      "Erreur serveur récompenses.";
  }
}

async function calculatePlayerPoints(player) {
  if (!player.brawlTag) return 0;

  const res = await fetch(
    `https://cash-arena-api.onrender.com/api/brawl/player/${encodeURIComponent(player.brawlTag)}/battlelog`
  );

  const data = await res.json();

  if (!res.ok || data.error || !data.items) {
    console.error("Erreur battlelog", data);
    return player.points || 0;
  }

  let points = 0;

  data.items.forEach(item => {
    const battleTime = parseBrawlTime(item.battleTime);

    if (battleTime < tournamentStartDate) {
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
  // Format Brawl Stars : 20260504T193000.000Z
  const year = battleTime.slice(0, 4);
  const month = battleTime.slice(4, 6);
  const day = battleTime.slice(6, 8);
  const hour = battleTime.slice(9, 11);
  const minute = battleTime.slice(11, 13);
  const second = battleTime.slice(13, 15);

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

async function autoSyncBattlelogs() {
  try {
    await fetch("https://cash-arena-api.onrender.com/api/tournaments/brawl/sync-battlelogs", {
      method: "POST"
    });
  } catch (e) {
    console.log("sync failed");
  }
}