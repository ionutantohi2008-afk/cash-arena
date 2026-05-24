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
