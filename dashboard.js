let isRegistered = false;
let isDailyRegistered = false;

// ======================================================
// 🎮 MULTI-JEU CASH ARENA
// ======================================================
// Brawl Stars reste compatible avec ton système actuel.
// Fortnite utilise son propre tournoi et ses propres LP.
// Le jeu sélectionné est géré par game-selector.js.

const CURRENT_GAME =
  typeof getSelectedGame === "function"
    ? getSelectedGame()
    : (localStorage.getItem("cashArenaSelectedGame") || "brawlstars");

const IS_FORTNITE = CURRENT_GAME === "fortnite";
const IS_BRAWL_STARS = !IS_FORTNITE;

const GAME_CONFIG = {
  brawlstars: {
    id: "brawlstars",
    name: "BRAWL STARS",
    tournamentId: "weekly7",
    rewardsEnabled: true,
    tournamentStart: new Date("2026-10-04T14:10:00"),
    tournamentDurationDays: 6
  },

  fortnite: {
    id: "fortnite",
    name: "FORTNITE",
    tournamentId: "fortnite-weekly1",
    rewardsEnabled: true,
    tournamentStart: new Date("2026-10-10T19:30:00"),
    tournamentDurationDays: 6
  }
};

const CURRENT_GAME_CONFIG =
  GAME_CONFIG[CURRENT_GAME] || GAME_CONFIG.brawlstars;

const TOURNAMENT_ID =
  CURRENT_GAME_CONFIG.tournamentId;

const TOURNAMENT_HAS_REWARDS =
  CURRENT_GAME_CONFIG.rewardsEnabled;

const tournamentStartDate =
  CURRENT_GAME_CONFIG.tournamentStart;

const tournamentDurationDays =
  CURRENT_GAME_CONFIG.tournamentDurationDays;

const tournamentEndDate = new Date(
  tournamentStartDate.getTime() +
  tournamentDurationDays * 24 * 60 * 60 * 1000
);

let CURRENT_GAME_USER_DATA = null;


// ======================================================
// 👤 PROFIL DU JOUEUR PAR JEU
// ======================================================

function getGameProfileRef(uid) {
  return db
    .collection("users")
    .doc(uid)
    .collection("games")
    .doc(CURRENT_GAME);
}


async function loadCurrentGameUserData(uid, baseUserData = {}) {

  // ----------------------------------------------------
  // BRAWL STARS
  // ----------------------------------------------------
  // On garde l'ancien système pour ne pas casser
  // les données Brawl Stars déjà présentes.
  if (IS_BRAWL_STARS) {

    if (
      baseUserData.leaguePoints === undefined ||
      baseUserData.leagueRank === undefined
    ) {

      await db
        .collection("users")
        .doc(uid)
        .set({
          leaguePoints:
            baseUserData.leaguePoints === undefined
              ? 0
              : baseUserData.leaguePoints,

          leagueRank:
            baseUserData.leagueRank || "Bronze"

        }, {
          merge: true
        });
    }

    return {
      ...baseUserData,

      leaguePoints:
        baseUserData.leaguePoints || 0,

      leagueRank:
        baseUserData.leagueRank || "Bronze"
    };
  }


  // ----------------------------------------------------
  // FORTNITE
  // ----------------------------------------------------

  const gameRef =
    getGameProfileRef(uid);

  const gameDoc =
    await gameRef.get();

  const gameData =
    gameDoc.data() || {};


  // Si le profil Fortnite n'existe pas encore
  if (!gameDoc.exists) {

    const defaults = {

      game: CURRENT_GAME,

      leaguePoints: 0,

      leagueRank: "Bronze",

      createdAt: new Date()

    };

    await gameRef.set(
      defaults,
      {
        merge: true
      }
    );

    return {
      ...baseUserData,
      ...defaults
    };
  }


  return {

    ...baseUserData,

    ...gameData,

    leaguePoints:
      gameData.leaguePoints || 0,

    leagueRank:
      gameData.leagueRank || "Bronze"

  };
}


// ======================================================
// 🎮 AFFICHAGE DU JEU ACTUEL
// ======================================================

function updateDashboardGameTexts() {

  const weeklyCard =
    document.querySelector(".weekly-card");

  if (weeklyCard) {

    const gameElement =
      weeklyCard.querySelector(".card-game");

    const logoElement =
      weeklyCard.querySelector(".game-logo");


    if (gameElement) {

      gameElement.innerText =
        CURRENT_GAME_CONFIG.name;
    }


    if (logoElement) {

      logoElement.innerText =
        IS_FORTNITE
          ? "🎯"
          : "⭐";

      logoElement.classList.toggle(
        "brawl-logo",
        IS_BRAWL_STARS
      );
    }
  }


  // La Daily Cup reste uniquement
  // disponible pour Brawl Stars.
  const dailyCard =
    document.querySelector(".daily-card");

  if (dailyCard) {

    dailyCard.style.display =
      IS_BRAWL_STARS
        ? "block"
        : "none";
  }
}


function updateGameRankingLabels() {

  document
    .querySelectorAll(".card-game")
    .forEach(element => {

      if (
        element.closest(".weekly-card")
      ) {

        element.innerText =
          CURRENT_GAME_CONFIG.name;
      }
    });
}


if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      updateDashboardGameTexts();

      updateGameRankingLabels();

    }
  );

} else {

  updateDashboardGameTexts();

  updateGameRankingLabels();
}


// ======================================================
// 📅 DAILY CUP
// ======================================================

function getDailyStartDate() {

  const now =
    new Date();

  const start =
    new Date(now);

  start.setHours(19);

  start.setMinutes(30);

  start.setSeconds(0);

  if (now > start) {

    start.setDate(
      start.getDate() + 1
    );
  }

  return start;
}


const dailyStartDate =
  getDailyStartDate();


const dailyEndDate =
  new Date(
    dailyStartDate.getTime() +
    24 * 60 * 60 * 1000
  );


let rewardsAlreadyTriggered =
  false;


// ======================================================
// 🔐 AUTHENTIFICATION
// ======================================================

auth.onAuthStateChanged(
  async user => {

    if (!user) {

      window.location =
        "index.html";

      return;
    }


    const userEmail =
      document.getElementById(
        "userEmail"
      );

    if (userEmail) {

      userEmail.innerText =
        user.email;
    }


    // --------------------------------------------------
    // PROFIL GLOBAL
    // --------------------------------------------------

    const userDoc =
      await db
        .collection("users")
        .doc(user.uid)
        .get();


    const baseUserData =
      userDoc.data() || {};


    // --------------------------------------------------
    // PROFIL DU JEU SÉLECTIONNÉ
    // --------------------------------------------------

    const userData =
      await loadCurrentGameUserData(
        user.uid,
        baseUserData
      );


    CURRENT_GAME_USER_DATA =
      userData;


    // --------------------------------------------------
    // SOLDE
    // --------------------------------------------------

    const balanceElement =
      document.getElementById(
        "balance"
      );

    if (balanceElement) {

      balanceElement.innerText =
        "💰 Solde : " +
        (userData.balance || 0) +
        "€";
    }


    updateDashboardGameTexts();


    // --------------------------------------------------
    // INSCRIPTION AU TOURNOI
    // --------------------------------------------------

    const playerDoc =
      await db
        .collection("tournaments")
        .doc(TOURNAMENT_ID)
        .collection("players")
        .doc(user.uid)
        .get();


    isRegistered =
      playerDoc.exists;


    updateJoinButton();

    updateTimer();

    updateEndTimer();


    // --------------------------------------------------
    // DAILY CUP
    // --------------------------------------------------

    if (IS_BRAWL_STARS) {

      const dailyPlayerDoc =
        await db
          .collection("tournaments")
          .doc(
            getDailyTournamentId()
          )
          .collection("players")
          .doc(user.uid)
          .get();


      isDailyRegistered =
        dailyPlayerDoc.exists;

    } else {

      isDailyRegistered =
        false;
    }


    updateDailyButton();

    updateDailyTimer();

  }
);


// ======================================================
// ⏱️ TIMER DU TOURNOI
// ======================================================

function updateTimer() {

  const now =
    new Date();

  const diff =
    tournamentStartDate -
    now;


  const timer =
    document.getElementById(
      "timer"
    );


  const joinBtn =
    document.getElementById(
      "joinBtn"
    );


  const endTimer =
    document.getElementById(
      "endTimer"
    );


  if (
    !timer ||
    !joinBtn
  ) {

    return;
  }


  if (endTimer) {

    endTimer.style.display =
      isRegistered
        ? "block"
        : "none";
  }


  if (isRegistered) {

    timer.innerText =
      "✅ Tu es déjà inscrit au tournoi.";

    updateJoinButton();

    return;
  }


  if (diff <= 0) {

    timer.innerText =
      "✅ Le tournoi a commencé ! Les inscriptions sont ouvertes.";

    joinBtn.disabled =
      false;

    joinBtn.style.opacity =
      "1";

    joinBtn.style.cursor =
      "pointer";

    return;
  }


  const days =
    Math.floor(
      diff /
      (1000 * 60 * 60 * 24)
    );


  const hours =
    Math.floor(
      (diff /
        (1000 * 60 * 60)) %
      24
    );


  const minutes =
    Math.floor(
      (diff /
        (1000 * 60)) %
      60
    );


  const seconds =
    Math.floor(
      (diff / 1000) %
      60
    );


  timer.innerText =
    `⏳ Début du tournoi dans ${days}j ${hours}h ${minutes}m ${seconds}s`;


  joinBtn.disabled =
    true;

  joinBtn.style.opacity =
    "0.6";

  joinBtn.style.cursor =
    "not-allowed";
}


setInterval(
  updateTimer,
  1000
);

updateTimer();


// ======================================================
// 🏁 TIMER DE FIN
// ======================================================

function updateEndTimer() {

  const endTimer =
    document.getElementById(
      "endTimer"
    );


  if (!endTimer) {

    return;
  }


  const classement =
    document.getElementById(
      "classement"
    );


  if (
    !classement ||
    classement.style.display !== "block"
  ) {

    endTimer.style.display =
      "none";

    return;
  }


  endTimer.style.display =
    "block";


  const now =
    new Date();


  const diff =
    tournamentEndDate -
    now;


  if (diff <= 0) {

    endTimer.innerText =
      "🏁 Le tournoi est terminé.";

    return;
  }


  const days =
    Math.floor(
      diff /
      (1000 * 60 * 60 * 24)
    );


  const hours =
    Math.floor(
      (diff /
        (1000 * 60 * 60)) %
      24
    );


  const minutes =
    Math.floor(
      (diff /
        (1000 * 60)) %
      60
    );


  const seconds =
    Math.floor(
      (diff / 1000) %
      60
    );


  endTimer.innerText =
    `🏁 Fin du tournoi dans ${days}j ${hours}h ${minutes}m ${seconds}s`;
}


setInterval(
  updateEndTimer,
  1000
);

updateEndTimer();

// ======================================================
// ⚡ TIMER DAILY CUP
// ======================================================

function updateDailyTimer() {

  const timer =
    document.getElementById(
      "dailyTimer"
    );

  if (!timer) {
    return;
  }


  // Fortnite n'utilise pas la Daily Cup
  if (IS_FORTNITE) {

    timer.innerText =
      "🎯 Daily Cup disponible uniquement sur Brawl Stars";

    return;
  }


  const now =
    new Date();


  const nextReset =
    new Date();


  nextReset.setHours(19);

  nextReset.setMinutes(30);

  nextReset.setSeconds(0);

  nextReset.setMilliseconds(0);


  if (now >= nextReset) {

    nextReset.setDate(
      nextReset.getDate() + 1
    );
  }


  const diff =
    nextReset - now;


  const hours =
    Math.floor(
      diff /
      (1000 * 60 * 60)
    );


  const minutes =
    Math.floor(
      (diff /
        (1000 * 60)) %
      60
    );


  const seconds =
    Math.floor(
      (diff / 1000) %
      60
    );


  timer.innerText =
    `⚡ Daily Cup en cours • Fin dans ${hours}h ${minutes}m ${seconds}s`;
}


setInterval(
  updateDailyTimer,
  1000
);

updateDailyTimer();


// ======================================================
// 🏆 REJOINDRE LE TOURNOI PRINCIPAL
// ======================================================

async function joinTournament(
  tournamentId
) {

  const now =
    new Date();


  if (
    now <
    tournamentStartDate
  ) {

    alert(
      "Les inscriptions ne sont pas encore ouvertes."
    );

    return;
  }


  const user =
    auth.currentUser;


  if (!user) {

    alert(
      "Connecte-toi !"
    );

    return;
  }


  try {

    const userDoc =
      await db
        .collection("users")
        .doc(user.uid)
        .get();


    const baseUserData =
      userDoc.data() || {};


    const userData =
      await loadCurrentGameUserData(
        user.uid,
        baseUserData
      );


    const ref =
      db
        .collection("tournaments")
        .doc(tournamentId)
        .collection("players")
        .doc(user.uid);


    const playerDoc =
      await ref.get();


    // --------------------------------------------------
    // JOUEUR DÉJÀ INSCRIT
    // --------------------------------------------------

    if (playerDoc.exists) {

      isRegistered =
        true;


      updateJoinButton();

      updateTimer();

      updateEndTimer();

      showClassement();

      return;
    }


    // --------------------------------------------------
    // DONNÉES COMMUNES
    // --------------------------------------------------

    const playerData = {

      uid:
        user.uid,

      email:
        user.email,

      pseudo:
        userData.pseudo ||
        userData.brawlName ||
        userData.fortniteName ||
        user.email,

      isContentCreator:
        userData.isContentCreator ||
        false,

      leagueRank:
        userData.leagueRank ||
        "Bronze",

      leaguePoints:
        userData.leaguePoints ||
        0,

      points:
        0,

      joinedAt:
        new Date()

    };


    // --------------------------------------------------
    // BRAWL STARS
    // --------------------------------------------------

    if (IS_BRAWL_STARS) {

      playerData.brawlTag =
        userData.brawlTag ||
        null;


      playerData.brawlName =
        userData.brawlName ||
        null;


      playerData.brawlTrophies =
        userData.brawlTrophies ||
        0;
    }


    // --------------------------------------------------
    // FORTNITE
    // --------------------------------------------------

    if (IS_FORTNITE) {

      playerData.fortniteName =
        userData.fortniteName ||
        userData.pseudo ||
        null;


      playerData.kills =
        0;


      playerData.wins =
        0;


      playerData.matches =
        0;


      playerData.eliminations =
        0;
    }


    // --------------------------------------------------
    // CRÉATION DU JOUEUR
    // --------------------------------------------------

    await ref.set(
      playerData
    );


    alert(
      IS_FORTNITE
        ? "🎯 Inscription Fortnite réussie !"
        : "⭐ Inscription Brawl Stars réussie !"
    );


    isRegistered =
      true;


    updateJoinButton();

    updateTimer();

    updateEndTimer();

    showClassement();

  } catch (error) {

    console.error(
      "❌ Erreur inscription tournoi :",
      error
    );


    alert(
      "Une erreur est survenue lors de l'inscription."
    );
  }
}


// ======================================================
// 📊 AFFICHER LE CLASSEMENT
// ======================================================

function showClassement() {

  hideAllTournaments();


  const classement =
    document.getElementById(
      "classement"
    );


  const dailyClassement =
    document.getElementById(
      "dailyClassement"
    );


  const endTimer =
    document.getElementById(
      "endTimer"
    );


  if (classement) {

    classement.style.display =
      "block";
  }


  if (dailyClassement) {

    dailyClassement.style.display =
      "none";
  }


  if (endTimer) {

    endTimer.style.display =
      "block";
  }


  // --------------------------------------------------
  // CLASSEMENT SELON LE JEU
  // --------------------------------------------------

  if (IS_FORTNITE) {

    loadFortnitePlayers();

  } else {

    loadBrawlPlayers();
  }
}


// ======================================================
// ⭐ CLASSEMENT BRAWL STARS
// ======================================================

async function loadBrawlPlayers() {

  console.log(
    "loadBrawlPlayers lancé"
  );


  const table =
    document.getElementById(
      "brawlTable"
    );


  if (!table) {
    return;
  }


  try {

    const snapshot =
      await db
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


    snapshot.forEach(
      doc => {

        players.push({

          id:
            doc.id,

          ...doc.data()

        });

      }
    );


    players.sort(
      (a, b) =>
        (b.points || 0) -
        (a.points || 0)
    );


    table.innerHTML =
      "";


    players.forEach(
      (p, index) => {

        let reward =
          "0 LP";


        if (index === 0)
          reward = "500 LP";

        else if (index === 1)
          reward = "400 LP";

        else if (index === 2)
          reward = "300 LP";

        else if (index === 3)
          reward = "200 LP";

        else if (index === 4)
          reward = "200 LP";

        else if (index <= 9)
          reward = "150 LP";

        else if (index <= 14)
          reward = "100 LP";

        else if (index <= 19)
          reward = "50 LP";


        const playerName =
          p.pseudo ||
          p.brawlName ||
          p.email ||
          "Joueur";


        table.innerHTML += `

          <tr>

            <td class="lp-reward">
              ${reward}
            </td>

            <td>
              ${index + 1}
            </td>

            <td class="${index === 0 ? "top-player" : ""}">

              ${playerName}

              ${getRankBadge(
                p.leagueRank ||
                "Bronze"
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
    );

  } catch (error) {

    console.error(
      "❌ Erreur classement Brawl Stars :",
      error
    );


    table.innerHTML = `

      <tr>

        <td colspan="4">
          Impossible de charger le classement.
        </td>

      </tr>

    `;
  }
}


// ======================================================
// 🎯 CLASSEMENT FORTNITE
// ======================================================

async function loadFortnitePlayers() {

  const table =
    document.getElementById(
      "brawlTable"
    );


  if (!table) {
    return;
  }


  try {

    const snapshot =
      await db
        .collection("tournaments")
        .doc(TOURNAMENT_ID)
        .collection("players")
        .get();


    let players = [];


    snapshot.forEach(
      doc => {

        players.push({

          id:
            doc.id,

          ...doc.data()

        });

      }
    );


    players.sort(
      (a, b) =>
        (b.points || 0) -
        (a.points || 0)
    );


    table.innerHTML =
      "";


    if (
      players.length === 0
    ) {

      table.innerHTML = `

        <tr>

          <td colspan="4">
            Aucun joueur Fortnite inscrit pour le moment.
          </td>

        </tr>

      `;

      return;
    }


    players.forEach(
      (p, index) => {

        let reward =
          "0 LP";


        if (index === 0)
          reward = "500 LP";

        else if (index === 1)
          reward = "400 LP";

        else if (index === 2)
          reward = "300 LP";

        else if (index === 3)
          reward = "200 LP";

        else if (index === 4)
          reward = "200 LP";

        else if (index <= 9)
          reward = "150 LP";

        else if (index <= 14)
          reward = "100 LP";

        else if (index <= 19)
          reward = "50 LP";


        const playerName =
          p.pseudo ||
          p.fortniteName ||
          p.email ||
          "Joueur";


        table.innerHTML += `

          <tr>

            <td class="lp-reward">
              ${reward}
            </td>

            <td>
              ${index + 1}
            </td>

            <td class="${index === 0 ? "top-player" : ""}">

              ${playerName}

              ${getRankBadge(
                p.leagueRank ||
                "Bronze"
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
    );

  } catch (error) {

    console.error(
      "❌ Erreur classement Fortnite :",
      error
    );


    table.innerHTML = `

      <tr>

        <td colspan="4">
          Impossible de charger le classement Fortnite.
        </td>

      </tr>

    `;
  }
}


// ======================================================
// 🎁 RÉCOMPENSES DU TOURNOI
// ======================================================

async function finishTournament() {

  if (
    !TOURNAMENT_HAS_REWARDS
  ) {

    return;
  }


  try {

    const res =
      await fetch(
        `https://cash-arena-api.onrender.com/api/tournaments/${TOURNAMENT_ID}/give-rewards`,
        {
          method: "POST"
        }
      );


    const data =
      await res.json();


    if (
      !res.ok ||
      data.error
    ) {

      alert(
        data.message ||
        "Erreur récompenses"
      );

      return;
    }


    alert(
      "Récompenses distribuées !"
    );


    if (IS_FORTNITE) {

      loadFortnitePlayers();

    } else {

      loadBrawlPlayers();
    }


  } catch (error) {

    console.error(
      error
    );


    alert(
      "Erreur serveur"
    );
  }
}


// ======================================================
// 🤖 RÉCOMPENSES AUTOMATIQUES
// ======================================================

async function autoGiveRewards() {

  if (
    !TOURNAMENT_HAS_REWARDS
  ) {

    return;
  }


  if (
    rewardsAlreadyTriggered
  ) {

    return;
  }


  rewardsAlreadyTriggered =
    true;


  try {

    const res =
      await fetch(
        `https://cash-arena-api.onrender.com/api/tournaments/${TOURNAMENT_ID}/give-rewards`,
        {
          method: "POST"
        }
      );


    const data =
      await res.json();


    const status =
      document.getElementById(
        "rewardStatus"
      );


    if (
      !res.ok ||
      data.error
    ) {

      if (status) {

        status.innerText =
          data.message ||
          "Erreur récompenses";
      }

      return;
    }


    if (status) {

      status.innerText =
        "✅ Récompenses distribuées automatiquement !";
    }


    if (IS_FORTNITE) {

      loadFortnitePlayers();

    } else {

      loadBrawlPlayers();
    }


  } catch (error) {

    console.error(
      error
    );


    const status =
      document.getElementById(
        "rewardStatus"
      );


    if (status) {

      status.innerText =
        "Erreur serveur récompenses.";
    }
  }
}


// ======================================================
// 🕒 CONVERSION DATE BRAWL STARS
// ======================================================

function parseBrawlTime(
  battleTime
) {

  if (
    !battleTime ||
    battleTime.length < 15
  ) {

    return null;
  }


  const year =
    battleTime.slice(
      0,
      4
    );


  const month =
    battleTime.slice(
      4,
      6
    );


  const day =
    battleTime.slice(
      6,
      8
    );


  const hour =
    battleTime.slice(
      9,
      11
    );


  const minute =
    battleTime.slice(
      11,
      13
    );


  const second =
    battleTime.slice(
      13,
      15
    );


  return new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  );
}

// ======================================================
// 🎮 BOUTON PRINCIPAL DU TOURNOI
// ======================================================

function updateJoinButton() {

  const joinBtn =
    document.getElementById(
      "joinBtn"
    );


  if (!joinBtn) {
    return;
  }


  // --------------------------------------------------
  // JOUEUR DÉJÀ INSCRIT
  // --------------------------------------------------

  if (isRegistered) {

    joinBtn.innerText =
      "CLASSEMENT";


    joinBtn.disabled =
      false;


    joinBtn.style.opacity =
      "1";


    joinBtn.style.cursor =
      "pointer";


    joinBtn.onclick =
      () => showClassement();


    return;
  }


  // --------------------------------------------------
  // JOUEUR NON INSCRIT
  // --------------------------------------------------

  joinBtn.innerText =
    "REJOINDRE LE TOURNOI";


  joinBtn.disabled =
    false;


  joinBtn.style.opacity =
    "1";


  joinBtn.style.cursor =
    "pointer";


  joinBtn.onclick =
    () => joinTournament(
      TOURNAMENT_ID
    );


  const endTimer =
    document.getElementById(
      "endTimer"
    );


  if (endTimer) {

    endTimer.style.display =
      "none";
  }
}


// ======================================================
// 🥉 BADGES DE LEAGUE
// ======================================================

function getRankBadge(
  rank
) {

  switch (rank) {

    case "Bronze":

      return `
        <span class="rank-badge rank-bronze">
          <img
            src="bronze.png"
            alt="Bronze"
          >
        </span>
      `;


    case "Silver":

      return `
        <span class="rank-badge rank-silver">
          <img
            src="silver.png"
            alt="Silver"
          >
        </span>
      `;


    case "Gold":

      return `
        <span class="rank-badge rank-gold">
          <img
            src="gold.png"
            alt="Gold"
          >
        </span>
      `;


    case "Platinum":

      return `
        <span class="rank-badge rank-platinum">
          <img
            src="platinum.png"
            alt="Platinum"
          >
        </span>
      `;


    case "Diamond":

      return `
        <span class="rank-badge rank-diamond">
          <img
            src="diamond.png"
            alt="Diamond"
          >
        </span>
      `;


    case "Champion":

      return `
        <span class="rank-badge rank-champion">
          <img
            src="champion.png"
            alt="Champion"
          >
        </span>
      `;


    case "Legend":

      return `
        <span class="rank-badge rank-legend">
          <img
            src="legend.png"
            alt="Legend"
          >
        </span>
      `;


    default:

      return `
        <span class="rank-badge rank-bronze">
          <img
            src="bronze.png"
            alt="Bronze"
          >
        </span>
      `;
  }
}


// ======================================================
// 📅 IDENTIFIANT DAILY CUP
// ======================================================

function getDailyTournamentId() {

  const now =
    new Date();


  const resetHour =
    19;


  const resetMinute =
    30;


  // Avant 19h30 :
  // on utilise le tournoi de la veille.

  if (
    now.getHours() <
      resetHour ||

    (
      now.getHours() ===
        resetHour &&

      now.getMinutes() <
        resetMinute
    )
  ) {

    now.setDate(
      now.getDate() - 1
    );
  }


  const year =
    now.getFullYear();


  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );


  return (
    `brawl-daily-${year}-${month}-${day}`
  );
}


// ======================================================
// ⚡ REJOINDRE LA DAILY CUP
// ======================================================

async function joinDailyTournament() {

  // Fortnite n'a pas de Daily Cup.

  if (IS_FORTNITE) {

    alert(
      "La Daily Cup est disponible uniquement sur Brawl Stars."
    );

    return;
  }


  const user =
    auth.currentUser;


  if (!user) {

    alert(
      "Connecte-toi !"
    );

    return;
  }


  try {

    const tournamentId =
      getDailyTournamentId();


    const userDoc =
      await db
        .collection("users")
        .doc(user.uid)
        .get();


    const userData =
      userDoc.data() || {};


    const ref =
      db
        .collection("tournaments")
        .doc(tournamentId)
        .collection("players")
        .doc(user.uid);


    const playerDoc =
      await ref.get();


    if (playerDoc.exists) {

      isDailyRegistered =
        true;


      updateDailyButton();

      showDailyClassement();

      return;
    }


    await ref.set({

      uid:
        user.uid,

      email:
        user.email,

      pseudo:
        userData.pseudo ||
        userData.brawlName ||
        user.email,

      isContentCreator:
        userData.isContentCreator ||
        false,

      leagueRank:
        userData.leagueRank ||
        "Bronze",

      leaguePoints:
        userData.leaguePoints ||
        0,

      brawlTag:
        userData.brawlTag ||
        null,

      brawlName:
        userData.brawlName ||
        null,

      brawlTrophies:
        userData.brawlTrophies ||
        0,

      points:
        0,

      joinedAt:
        new Date()

    });


    alert(
      "⚡ Inscription Daily réussie !"
    );


    isDailyRegistered =
      true;


    updateDailyButton();

    showDailyClassement();

  } catch (error) {

    console.error(
      "❌ Erreur inscription Daily :",
      error
    );


    alert(
      "Une erreur est survenue lors de l'inscription Daily."
    );
  }
}


// ======================================================
// 👁️ MASQUER TOUS LES TOURNOIS
// ======================================================

function hideAllTournaments() {

  const cards =
    document.querySelectorAll(
      ".tournament-card"
    );


  cards.forEach(
    card => {

      card.style.display =
        "none";

    }
  );
}


// ======================================================
// ⚡ AFFICHER LE CLASSEMENT DAILY
// ======================================================

function showDailyClassement() {

  // Fortnite ne possède pas cette section.

  if (IS_FORTNITE) {

    return;
  }


  hideAllTournaments();


  const dailyClassement =
    document.getElementById(
      "dailyClassement"
    );


  const classement =
    document.getElementById(
      "classement"
    );


  const endTimer =
    document.getElementById(
      "endTimer"
    );


  if (dailyClassement) {

    dailyClassement.style.display =
      "block";
  }


  if (classement) {

    classement.style.display =
      "none";
  }


  if (endTimer) {

    endTimer.style.display =
      "none";
  }


  loadDailyPlayers();
}


// ======================================================
// 📊 JOUEURS DAILY
// ======================================================

async function loadDailyPlayers() {

  if (IS_FORTNITE) {

    return;
  }


  const table =
    document.getElementById(
      "dailyTable"
    );


  if (!table) {

    return;
  }


  const tournamentId =
    getDailyTournamentId();


  try {

    const snapshot =
      await db
        .collection("tournaments")
        .doc(tournamentId)
        .collection("players")
        .get();


    let players = [];


    snapshot.forEach(
      doc => {

        players.push({

          id:
            doc.id,

          ...doc.data()

        });

      }
    );


    players.sort(
      (a, b) =>
        (b.points || 0) -
        (a.points || 0)
    );


    table.innerHTML =
      "";


    if (
      players.length === 0
    ) {

      table.innerHTML = `

        <tr>

          <td colspan="4">
            Aucun joueur inscrit pour le moment.
          </td>

        </tr>

      `;

      return;
    }


    players.forEach(
      (p, index) => {

        let reward =
          "";


        if (index === 0)
          reward = "150 LP";

        else if (index === 1)
          reward = "120 LP";

        else if (index === 2)
          reward = "100 LP";

        else if (index <= 4)
          reward = "80 LP";

        else if (index <= 9)
          reward = "50 LP";

        else if (index <= 14)
          reward = "30 LP";


        const playerName =
          p.pseudo ||
          p.brawlName ||
          p.email ||
          "Joueur";


        table.innerHTML += `

          <tr>

            <td>
              ${reward}
            </td>

            <td>
              ${index + 1}
            </td>

            <td class="${index === 0 ? "top-player" : ""}">

              ${playerName}

              ${getRankBadge(
                p.leagueRank ||
                "Bronze"
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
    );

  } catch (error) {

    console.error(
      "❌ Erreur classement Daily :",
      error
    );


    table.innerHTML = `

      <tr>

        <td colspan="4">
          Impossible de charger le classement Daily.
        </td>

      </tr>

    `;
  }
}


// ======================================================
// 🏠 RETOUR AUX TOURNOIS
// ======================================================

function showTournaments() {

  document
    .querySelectorAll(
      ".tournament-card"
    )
    .forEach(
      card => {

        card.style.display =
          "block";

      }
    );


  const classement =
    document.getElementById(
      "classement"
    );


  const dailyClassement =
    document.getElementById(
      "dailyClassement"
    );


  const goldClassement =
    document.getElementById(
      "goldCupClassement"
    );


  const endTimer =
    document.getElementById(
      "endTimer"
    );


  if (classement) {

    classement.style.display =
      "none";
  }


  if (dailyClassement) {

    dailyClassement.style.display =
      "none";
  }


  if (goldClassement) {

    goldClassement.style.display =
      "none";
  }


  if (endTimer) {

    endTimer.style.display =
      "none";
  }


  // Fortnite ne doit pas afficher
  // les éléments Daily Brawl Stars.

  if (IS_FORTNITE) {

    const dailyCard =
      document.querySelector(
        ".daily-card"
      );


    if (dailyCard) {

      dailyCard.style.display =
        "none";
    }
  }
}


// ======================================================
// 🔘 BOUTON DAILY
// ======================================================

function updateDailyButton() {

  const btn =
    document.getElementById(
      "dailyJoinBtn"
    );


  if (!btn) {

    return;
  }


  // Fortnite

  if (IS_FORTNITE) {

    btn.style.display =
      "none";

    return;
  }


  btn.style.display =
    "";


  if (isDailyRegistered) {

    btn.innerText =
      "CLASSEMENT";


    btn.disabled =
      false;


    btn.style.opacity =
      "1";


    btn.style.cursor =
      "pointer";


    btn.onclick =
      () => showDailyClassement();

  } else {

    btn.innerText =
      "REJOINDRE LE TOURNOI";


    btn.disabled =
      false;


    btn.style.opacity =
      "1";


    btn.style.cursor =
      "pointer";


    btn.onclick =
      () =>
        joinDailyTournament();
  }
}


// ======================================================
// 🔄 RETOUR AUTOMATIQUE AU BON JEU
// ======================================================

window.addEventListener(
  "storage",
  event => {

    if (
      event.key !==
      "cashArenaSelectedGame"
    ) {

      return;
    }


    const newGame =
      event.newValue ||
      "brawlstars";


    if (
      newGame !==
      CURRENT_GAME
    ) {

      window.location.reload();
    }
  }
);

// ======================================================
// 🏆 GOLD CUP
// ======================================================

let GOLD_CUP_DATA = {
  id: "gold-cup",
  startDate: null,
  endDate: null,
  rewards: []
};

let IS_PLAYER_REGISTERED_RAM =
  false;

let goldCupTimerInterval =
  null;

let goldCupPlayersCache = {
  data: null,
  timestamp: 0
};


// ======================================================
// 🌐 CONFIGURATION GOLD CUP
// ======================================================

async function fetchGoldCupConfig() {

  // La Gold Cup reste liée au système
  // Brawl Stars actuel.

  if (IS_FORTNITE) {

    const goldCupTimer =
      document.getElementById(
        "goldCupTimer"
      );

    const goldCupStatus =
      document.getElementById(
        "goldCupStatus"
      );

    const goldCupJoinBtn =
      document.getElementById(
        "goldCupJoinBtn"
      );

    if (goldCupTimer) {

      goldCupTimer.innerText =
        "🎯 Gold Cup disponible prochainement sur Fortnite.";
    }

    if (goldCupStatus) {

      goldCupStatus.innerText =
        "Gold Cup Fortnite : prochainement";
    }

    if (goldCupJoinBtn) {

      goldCupJoinBtn.style.display =
        "none";
    }

    return;
  }


  try {

    const response =
      await fetch(
        "https://cash-arena-api.onrender.com/api/gold-cup"
      );


    if (!response.ok) {

      throw new Error(
        "Erreur API Gold Cup"
      );
    }


    const data =
      await response.json();


    if (data) {

      GOLD_CUP_DATA = {
        ...GOLD_CUP_DATA,
        ...data
      };
    }


    startFrontTimerLoop();


  } catch (error) {

    console.error(
      "❌ Erreur récupération Gold Cup :",
      error
    );


    const timer =
      document.getElementById(
        "goldCupTimer"
      );


    if (timer) {

      timer.innerText =
        "Gold Cup indisponible.";
    }
  }
}


// ======================================================
// 👤 VÉRIFIER INSCRIPTION GOLD CUP
// ======================================================

async function checkPlayerRegistrationStatus() {

  const user =
    auth.currentUser;


  if (!user) {

    IS_PLAYER_REGISTERED_RAM =
      false;

    return false;
  }


  // --------------------------------------------------
  // MÉMOIRE RAM
  // --------------------------------------------------

  if (
    IS_PLAYER_REGISTERED_RAM
  ) {

    return true;
  }


  // --------------------------------------------------
  // SESSION STORAGE
  // --------------------------------------------------

  const sessionKey =
    `goldCupRegistered_${user.uid}`;


  const sessionValue =
    sessionStorage.getItem(
      sessionKey
    );


  if (
    sessionValue === "true"
  ) {

    IS_PLAYER_REGISTERED_RAM =
      true;

    return true;
  }


  // --------------------------------------------------
  // FIRESTORE
  // --------------------------------------------------

  try {

    const playerDoc =
      await db
        .collection("tournaments")
        .doc(
          GOLD_CUP_DATA.id
        )
        .collection("players")
        .doc(user.uid)
        .get();


    const registered =
      playerDoc.exists;


    IS_PLAYER_REGISTERED_RAM =
      registered;


    if (registered) {

      sessionStorage.setItem(
        sessionKey,
        "true"
      );
    }


    return registered;

  } catch (error) {

    console.error(
      "❌ Vérification Gold Cup :",
      error
    );


    return false;
  }
}


// ======================================================
// ⏱️ TIMER GOLD CUP
// ======================================================

function startFrontTimerLoop() {

  if (
    goldCupTimerInterval
  ) {

    clearInterval(
      goldCupTimerInterval
    );
  }


  renderFrontTimer();


  goldCupTimerInterval =
    setInterval(
      renderFrontTimer,
      1000
    );
}


function renderFrontTimer() {

  const timer =
    document.getElementById(
      "goldCupTimer"
    );


  if (!timer) {

    return;
  }


  if (IS_FORTNITE) {

    timer.innerText =
      "🎯 Gold Cup Fortnite prochainement";

    return;
  }


  const start =
    GOLD_CUP_DATA.startDate
      ? new Date(
          GOLD_CUP_DATA.startDate
        )
      : null;


  const end =
    GOLD_CUP_DATA.endDate
      ? new Date(
          GOLD_CUP_DATA.endDate
        )
      : null;


  if (!start || !end) {

    timer.innerText =
      "🏆 Gold Cup bientôt disponible";

    return;
  }


  const now =
    new Date();


  // --------------------------------------------------
  // AVANT LE DÉBUT
  // --------------------------------------------------

  if (now < start) {

    const diff =
      start - now;


    timer.innerText =
      "⏳ Début dans " +
      formatFrontTime(
        diff
      );

    return;
  }


  // --------------------------------------------------
  // TOURNOI EN COURS
  // --------------------------------------------------

  if (
    now >= start &&
    now < end
  ) {

    const diff =
      end - now;


    timer.innerText =
      "🏆 Gold Cup en cours • Fin dans " +
      formatFrontTime(
        diff
      );


    return;
  }


  // --------------------------------------------------
  // TERMINÉ
  // --------------------------------------------------

  timer.innerText =
    "🏁 Gold Cup terminée";
}


// ======================================================
// 🏆 REJOINDRE GOLD CUP
// ======================================================

async function joinGoldCup() {

  if (IS_FORTNITE) {

    alert(
      "La Gold Cup Fortnite sera disponible prochainement."
    );

    return;
  }


  const user =
    auth.currentUser;


  if (!user) {

    alert(
      "Connecte-toi !"
    );

    return;
  }


  try {

    const alreadyRegistered =
      await checkPlayerRegistrationStatus();


    if (alreadyRegistered) {

      showGoldCupClassement();

      return;
    }


    const response =
      await fetch(
        "https://cash-arena-api.onrender.com/api/gold-cup/join",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              uid:
                user.uid,

              email:
                user.email
            })
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      data.error
    ) {

      alert(
        data.message ||
        "Impossible de rejoindre la Gold Cup."
      );

      return;
    }


    IS_PLAYER_REGISTERED_RAM =
      true;


    sessionStorage.setItem(
      `goldCupRegistered_${user.uid}`,
      "true"
    );


    alert(
      "🏆 Inscription Gold Cup réussie !"
    );


    updateGoldCupJoinButton();

    showGoldCupClassement();


  } catch (error) {

    console.error(
      "❌ Erreur inscription Gold Cup :",
      error
    );


    alert(
      "Erreur serveur Gold Cup."
    );
  }
}


// ======================================================
// 🎁 RÉCOMPENSES GOLD CUP
// ======================================================

async function loadGoldCupRewards() {

  const rewardElement =
    document.getElementById(
      "goldCupReward"
    );


  if (!rewardElement) {

    return;
  }


  if (IS_FORTNITE) {

    rewardElement.innerText =
      "Gold Cup Fortnite prochainement";

    return;
  }


  try {

    let rewards =
      GOLD_CUP_DATA.rewards ||
      [];


    if (
      !Array.isArray(rewards)
    ) {

      rewards = [];
    }


    if (
      rewards.length === 0
    ) {

      rewardElement.innerText =
        "Récompenses bientôt annoncées.";

      return;
    }


    rewardElement.innerHTML =
      rewards
        .map(
          reward => {

            if (
              typeof reward ===
              "string"
            ) {

              return `
                <div>
                  ${reward}
                </div>
              `;
            }


            const position =
              reward.position ||
              reward.rank ||
              "";


            const value =
              reward.reward ||
              reward.amount ||
              reward.lp ||
              "0";


            return `
              <div>
                ${position} : ${value}
              </div>
            `;
          }
        )
        .join("");

  } catch (error) {

    console.error(
      "❌ Erreur récompenses Gold Cup :",
      error
    );


    rewardElement.innerText =
      "Impossible de charger les récompenses.";
  }
}


// ======================================================
// ⏱️ FORMATAGE TEMPS GOLD CUP
// ======================================================

function formatFrontTime(
  milliseconds
) {

  if (
    milliseconds <= 0
  ) {

    return "0s";
  }


  const totalSeconds =
    Math.floor(
      milliseconds / 1000
    );


  const days =
    Math.floor(
      totalSeconds /
      86400
    );


  const hours =
    Math.floor(
      (
        totalSeconds %
        86400
      ) / 3600
    );


  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) / 60
    );


  const seconds =
    totalSeconds %
    60;


  if (days > 0) {

    return (
      `${days}j ${hours}h ${minutes}m ${seconds}s`
    );
  }


  if (hours > 0) {

    return (
      `${hours}h ${minutes}m ${seconds}s`
    );
  }


  if (minutes > 0) {

    return (
      `${minutes}m ${seconds}s`
    );
  }


  return (
    `${seconds}s`
  );
}


// ======================================================
// 🔘 BOUTON GOLD CUP
// ======================================================

async function updateGoldCupJoinButton() {

  const button =
    document.getElementById(
      "goldCupJoinBtn"
    );


  if (!button) {

    return;
  }


  if (IS_FORTNITE) {

    button.style.display =
      "none";

    return;
  }


  button.style.display =
    "";


  const registered =
    await checkPlayerRegistrationStatus();


  if (registered) {

    button.innerText =
      "CLASSEMENT";


    button.disabled =
      false;


    button.style.opacity =
      "1";


    button.style.cursor =
      "pointer";


    button.onclick =
      () =>
        showGoldCupClassement();

  } else {

    button.innerText =
      "REJOINDRE LA GOLD CUP";


    button.disabled =
      false;


    button.style.opacity =
      "1";


    button.style.cursor =
      "pointer";


    button.onclick =
      () =>
        joinGoldCup();
  }
}


// ======================================================
// 🏆 INITIALISATION GOLD CUP
// ======================================================

async function initGoldCupModule() {

  if (IS_FORTNITE) {

    const button =
      document.getElementById(
        "goldCupJoinBtn"
      );


    if (button) {

      button.style.display =
        "none";
    }


    return;
  }


  await fetchGoldCupConfig();


  await checkPlayerRegistrationStatus();


  await updateGoldCupJoinButton();


  await loadGoldCupRewards();
}


// ======================================================
// 📊 AFFICHER CLASSEMENT GOLD CUP
// ======================================================

function showGoldCupClassement() {

  const goldCupClassement =
    document.getElementById(
      "goldCupClassement"
    );


  const classement =
    document.getElementById(
      "classement"
    );


  const dailyClassement =
    document.getElementById(
      "dailyClassement"
    );


  const endTimer =
    document.getElementById(
      "endTimer"
    );


  if (goldCupClassement) {

    goldCupClassement.style.display =
      "block";
  }


  if (classement) {

    classement.style.display =
      "none";
  }


  if (dailyClassement) {

    dailyClassement.style.display =
      "none";
  }


  if (endTimer) {

    endTimer.style.display =
      "none";
  }


  hideAllTournaments();


  loadGoldCupPlayers();
}


// ======================================================
// 👥 CHARGER JOUEURS GOLD CUP
// ======================================================

async function loadGoldCupPlayers() {

  const table =
    document.getElementById(
      "goldCupTable"
    );


  if (!table) {

    return;
  }


  if (IS_FORTNITE) {

    table.innerHTML = `
      <tr>
        <td colspan="4">
          🏆 Gold Cup Fortnite prochainement disponible.
        </td>
      </tr>
    `;

    return;
  }


  const now =
    Date.now();


  // Cache de 30 secondes
  // pour éviter trop de lectures Firestore.

  if (
    goldCupPlayersCache.data &&
    now -
      goldCupPlayersCache.timestamp <
      30000
  ) {

    renderGoldCupPlayers(
      goldCupPlayersCache.data
    );

    return;
  }


  try {

    const snapshot =
      await db
        .collection("tournaments")
        .doc(
          GOLD_CUP_DATA.id
        )
        .collection("players")
        .get();


    let players = [];


    snapshot.forEach(
      doc => {

        players.push({

          id:
            doc.id,

          ...doc.data()

        });

      }
    );


    players.sort(
      (a, b) =>
        (b.points || 0) -
        (a.points || 0)
    );


    goldCupPlayersCache = {

      data:
        players,

      timestamp:
        now
    };


    renderGoldCupPlayers(
      players
    );

  } catch (error) {

    console.error(
      "❌ Erreur classement Gold Cup :",
      error
    );


    table.innerHTML = `
      <tr>
        <td colspan="4">
          Impossible de charger le classement Gold Cup.
        </td>
      </tr>
    `;
  }
}


// ======================================================
// 🖥️ AFFICHER JOUEURS GOLD CUP
// ======================================================

function renderGoldCupPlayers(
  players
) {

  const table =
    document.getElementById(
      "goldCupTable"
    );


  if (!table) {

    return;
  }


  table.innerHTML =
    "";


  if (
    !players ||
    players.length === 0
  ) {

    table.innerHTML = `
      <tr>
        <td colspan="4">
          Aucun joueur inscrit pour le moment.
        </td>
      </tr>
    `;

    return;
  }


  players.forEach(
    (p, index) => {

      const playerName =
        p.pseudo ||
        p.brawlName ||
        p.email ||
        "Joueur";


      const points =
        p.points || 0;


      const reward =
        getGoldCupReward(
          index
        );


      table.innerHTML += `

        <tr class="esport-row">

          <td>

            <div class="reward-box-row">
              ${reward}
            </div>

          </td>


          <td>

            <div class="rank-number-box">
              ${index + 1}
            </div>

          </td>


          <td>

            <div class="player-profile-cell">

              <div class="player-avatar-mini">

                ${
                  index === 0
                    ? `<span class="crown-winner">👑</span>`
                    : ""
                }

              </div>


              <div class="player-meta">

                <div class="player-name">
                  ${playerName}
                </div>


                <div class="player-league-tag">

                  ${getRankBadge(
                    p.leagueRank ||
                    "Bronze"
                  )}

                </div>

              </div>

            </div>

          </td>


          <td>

            <div class="points-box-row">

              <span class="points-value">
                ${points}
              </span>

            </div>

          </td>

        </tr>

      `;
    }
  );
}


// ======================================================
// 🎁 RÉCOMPENSE PAR POSITION GOLD CUP
// ======================================================

function getGoldCupReward(
  index
) {

  const rewards =
    GOLD_CUP_DATA.rewards ||
    [];


  if (
    !Array.isArray(rewards)
  ) {

    return "0";
  }


  const position =
    index + 1;


  const reward =
    rewards.find(
      item => {

        if (
          typeof item ===
          "string"
        ) {

          return false;
        }


        return (
          Number(
            item.position ||
            item.rank
          ) === position
        );
      }
    );


  if (reward) {

    return (
      reward.reward ||
      reward.amount ||
      reward.lp ||
      "0"
    );
  }


  return "0";
}


// ======================================================
// 🚀 LANCEMENT GOLD CUP
// ======================================================

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      initGoldCupModule();

    }
  );

} else {

  initGoldCupModule();

}

// ======================================================
// 🔄 RAFRAÎCHISSEMENT DU DASHBOARD
// ======================================================

async function refreshCurrentDashboard() {

  try {

    // --------------------------------------------------
    // CLASSEMENT PRINCIPAL
    // --------------------------------------------------

    const classement =
      document.getElementById(
        "classement"
      );


    if (
      classement &&
      classement.style.display === "block"
    ) {

      if (IS_FORTNITE) {

        await loadFortnitePlayers();

      } else {

        await loadBrawlPlayers();

      }

      updateEndTimer();

    }


    // --------------------------------------------------
    // DAILY CUP
    // --------------------------------------------------

    const dailyClassement =
      document.getElementById(
        "dailyClassement"
      );


    if (
      dailyClassement &&
      dailyClassement.style.display === "block" &&
      IS_BRAWL_STARS
    ) {

      await loadDailyPlayers();

    }


    // --------------------------------------------------
    // GOLD CUP
    // --------------------------------------------------

    const goldCupClassement =
      document.getElementById(
        "goldCupClassement"
      );


    if (
      goldCupClassement &&
      goldCupClassement.style.display === "block"
    ) {

      goldCupPlayersCache = {
        data: null,
        timestamp: 0
      };


      await loadGoldCupPlayers();

    }

  } catch (error) {

    console.error(
      "❌ Erreur rafraîchissement dashboard :",
      error
    );
  }
}


// ======================================================
// 🔁 BOUTON / ÉVÉNEMENTS DU DASHBOARD
// ======================================================

function setupDashboardEvents() {

  const joinBtn =
    document.getElementById(
      "joinBtn"
    );


  if (joinBtn) {

    joinBtn.addEventListener(
      "click",
      event => {

        // Le onclick défini par
        // updateJoinButton() reste prioritaire.

        if (
          joinBtn.disabled
        ) {

          event.preventDefault();

        }

      }
    );

  }


  const dailyJoinBtn =
    document.getElementById(
      "dailyJoinBtn"
    );


  if (dailyJoinBtn) {

    dailyJoinBtn.addEventListener(
      "click",
      event => {

        if (
          dailyJoinBtn.disabled
        ) {

          event.preventDefault();

        }

      }
    );

  }


  const goldCupJoinBtn =
    document.getElementById(
      "goldCupJoinBtn"
    );


  if (goldCupJoinBtn) {

    goldCupJoinBtn.addEventListener(
      "click",
      event => {

        if (
          goldCupJoinBtn.disabled
        ) {

          event.preventDefault();

        }

      }
    );

  }
}


// ======================================================
// 🔃 RAFRAÎCHISSEMENT PÉRIODIQUE
// ======================================================

// On évite de rafraîchir trop souvent
// pour limiter les lectures Firestore.

setInterval(
  () => {

    refreshCurrentDashboard();

  },
  30000
);


// ======================================================
// ⏱️ VÉRIFICATION FIN DU TOURNOI
// ======================================================

setInterval(
  () => {

    const now =
      new Date();


    if (
      now >=
      tournamentEndDate
    ) {

      const status =
        document.getElementById(
          "rewardStatus"
        );


      // Les récompenses ne sont déclenchées
      // qu'une seule fois côté navigateur.

      if (
        status &&
        !rewardsAlreadyTriggered &&
        TOURNAMENT_HAS_REWARDS
      ) {

        autoGiveRewards();

      }

    }

  },
  10000
);


// ======================================================
// 🌐 VISIBILITÉ DE LA PAGE
// ======================================================

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      !document.hidden
    ) {

      updateTimer();

      updateEndTimer();

      updateDailyTimer();

      renderFrontTimer();

    }

  }
);


// ======================================================
// 🎮 CHANGEMENT DE JEU
// ======================================================

// game-selector.js sauvegarde le jeu dans
// localStorage puis recharge normalement la page.
//
// Cette sécurité permet également de détecter
// un changement effectué depuis un autre onglet.

window.addEventListener(
  "storage",
  event => {

    if (
      event.key !==
      "cashArenaSelectedGame"
    ) {

      return;
    }


    const selectedGame =
      event.newValue ||
      "brawlstars";


    if (
      selectedGame !==
      CURRENT_GAME
    ) {

      window.location.reload();

    }

  }
);


// ======================================================
// 🧹 NETTOYAGE GOLD CUP
// ======================================================

window.addEventListener(
  "beforeunload",
  () => {

    if (
      goldCupTimerInterval
    ) {

      clearInterval(
        goldCupTimerInterval
      );

      goldCupTimerInterval =
        null;

    }

  }
);


// ======================================================
// 🚀 INITIALISATION FINALE DU DASHBOARD
// ======================================================

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      setupDashboardEvents();

      updateDashboardGameTexts();

      updateGameRankingLabels();

      updateJoinButton();

      updateDailyButton();

      updateGoldCupJoinButton();

    }
  );

} else {

  setupDashboardEvents();

  updateDashboardGameTexts();

  updateGameRankingLabels();

  updateJoinButton();

  updateDailyButton();

  updateGoldCupJoinButton();

}


// ======================================================
// 📢 EXPOSITION DES FONCTIONS HTML
// ======================================================

// Important : tes boutons HTML peuvent utiliser
// onclick="joinTournament(...)"
// ou onclick="showClassement()".
//
// On garde donc les fonctions accessibles globalement.

window.joinTournament =
  joinTournament;

window.showClassement =
  showClassement;

window.joinDailyTournament =
  joinDailyTournament;

window.showDailyClassement =
  showDailyClassement;

window.showTournaments =
  showTournaments;

window.joinGoldCup =
  joinGoldCup;

window.showGoldCupClassement =
  showGoldCupClassement;

window.finishTournament =
  finishTournament;

window.autoGiveRewards =
  autoGiveRewards;


// ======================================================
// 🎯 LOG FINAL
// ======================================================

console.log(
  "========================================"
);

console.log(
  "🎮 CASH ARENA DASHBOARD"
);

console.log(
  "Jeu sélectionné :",
  CURRENT_GAME_CONFIG.name
);

console.log(
  "Tournoi principal :",
  TOURNAMENT_ID
);

console.log(
  "Mode Fortnite :",
  IS_FORTNITE
);

console.log(
  "Mode Brawl Stars :",
  IS_BRAWL_STARS
);

console.log(
  "========================================"
);