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

  const snapshot = await db.collection("users")
    .orderBy("leaguePoints", "desc")
    .limit(100)
    .get();

  table.innerHTML = "";

  let players = [];

  snapshot.forEach(doc => {
    players.push(doc.data());
  });

  players.forEach((p, index) => {

    let promotion = "➖";

    if (index <= 2) {
      promotion = "🔺";
    }

    if (index >= players.length - 3) {
      promotion = "🔻";
    }

    table.innerHTML += `
      <tr>
        <td>${promotion}</td>

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