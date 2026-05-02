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
    players.push(doc.data());
  });

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