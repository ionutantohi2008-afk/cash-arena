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

  console.log("loadLeague lancé");

  const table = document.getElementById("leagueTable");

  const snapshot = await db.collection("users").get();

  let players = [];

  snapshot.forEach(doc => {
    players.push({
      id: doc.id,
      ...doc.data()
    });
  });

  // Trier par LP
  players.sort((a, b) =>
    (b.leaguePoints || 0) - (a.leaguePoints || 0)
  );

  // Groupes par rank
  const ranks = {
    Bronze: [],
    Silver: [],
    Gold: [],
    Platinum: [],
    Diamond: [],
    Champion: [],
    Legend: []
  };

  players.forEach(player => {

    const rank = player.leagueRank || "Bronze";

    if (!ranks[rank]) {
      ranks.Bronze.push(player);
      return;
    }

    ranks[rank].push(player);
  });

  table.innerHTML = "";

  // Création des sections
  for (const rankName in ranks) {

    const rankPlayers = ranks[rankName];

    if (rankPlayers.length === 0) continue;

    table.innerHTML += `
      <tr class="league-rank-separator">
        <td colspan="5">
          ${getRankEmoji(rankName)} ${rankName.toUpperCase()} LEAGUE
        </td>
      </tr>
    `;

    rankPlayers.forEach((p, index) => {

      let promotion = "➖";

      if (index <= 2) promotion = "🔺";

      if (index >= rankPlayers.length - 3) {
        promotion = "🔻";
      }

      table.innerHTML += `
        <tr>
          <td>${promotion}</td>

          <td>#${index + 1}</td>

          <td>
            ${p.pseudo || p.email}

            ${p.isContentCreator
              ? "<span class='creator-badge'>Content Creator</span>"
              : ""}
          </td>

          <td>${p.leagueRank || "Bronze"}</td>

          <td>${p.leaguePoints || 0} LP</td>
        </tr>
      `;
    });
  }
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
