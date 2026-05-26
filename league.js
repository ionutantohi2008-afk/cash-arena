console.log("league.js chargé");
const promotionDate = getNextSunday1930();

auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location = "index.html";
    return;
  }

  const userDoc = await db.collection("users").doc(user.uid).get();
  const userData = userDoc.data() || {};

  document.getElementById("playerRank").innerText =
    "🏆 Rank : " + (userData.leagueRank || "Bronze");

  document.getElementById("playerLP").innerText =
    "⭐ " + (userData.leaguePoints || 0) + " LP";

  loadLeague();
});

async function loadLeague() {

  const table =
    document.getElementById("leagueTable");

  const user =
    auth.currentUser;

  if (!user || !table) return;

  // Joueur actuel
  const currentUserDoc = await db
    .collection("users")
    .doc(user.uid)
    .get();

  const currentUserData =
    currentUserDoc.data() || {};

  const currentRank =
    currentUserData.leagueRank || "Bronze";

  // Affiche le rank en haut
  document.getElementById("playerRank")
    .innerHTML =
      `🏆 Rank : ${currentRank}`;

  // Récupère tous les users
  const snapshot = await db
    .collection("users")
    .get();

  let players = [];

  snapshot.forEach(doc => {

    const data = doc.data();

    // IMPORTANT :
    // garde seulement le même rank
    if (
      (data.leagueRank || "Bronze")
      === currentRank
    ) {

      players.push({
        id: doc.id,
        ...data
      });
    }
  });

  // Tri LP
  players.sort(
    (a, b) =>
      (b.leaguePoints || 0)
      - (a.leaguePoints || 0)
  );

  table.innerHTML = "";

  players.forEach((p, index) => {

    let promotion = "—";

    if (index < 5) {
      promotion = "⬆ Promotion";
    }

    table.innerHTML += `

      <tr>

        <td>${promotion}</td>

        <td>

          ${p.pseudo || p.email}

          ${p.isContentCreator
            ? "<span class='creator-badge'>Content Creator</span>"
            : ""
          }

        </td>

        <td>${p.leaguePoints || 0}</td>

      </tr>
    `;
  });
}

function getRankEmoji(rank) {

  switch(rank) {

    case "Bronze":
      return "🥉";

    case "Silver":
      return "🥈";

    case "Gold":
      return "🥇";

    case "Platinum":
      return "💎";

    case "Diamond":
      return "🔷";

    case "Champion":
      return "👑";

    case "Legend":
      return "🔥";

    default:
      return "🏆";
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

function getNextSunday1930() {

  const now = new Date();

  const nextSunday = new Date(now);

  nextSunday.setDate(
    now.getDate() + ((7 - now.getDay()) % 7)
  );

  nextSunday.setHours(19);
  nextSunday.setMinutes(30);
  nextSunday.setSeconds(0);

  // Si on est déjà dimanche après 19h30
  if (now > nextSunday) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }

  return nextSunday;
}

function updateLeagueTimer() {

  const timer = document.getElementById("leaguePromotionTimer");

  if (!timer) return;

  const now = new Date();

  const diff = promotionDate - now;

  if (diff <= 0) {

    timer.innerText =
      "🔥 Promotions en cours...";

    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const hours = Math.floor(
    (diff / (1000 * 60 * 60)) % 24
  );

  const minutes = Math.floor(
    (diff / (1000 * 60)) % 60
  );

  const seconds = Math.floor(
    (diff / 1000) % 60
  );

  timer.innerText =
    `🏆 Promotions League dans ${days}j ${hours}h ${minutes}m ${seconds}s`;
}

setInterval(updateLeagueTimer, 1000);

updateLeagueTimer();
