console.log("League chargée");

const RANKS = [
  {
    name: "Bronze",
    icon: "🥉",
    min: 0,
    max: 100
  },
  {
    name: "Silver",
    icon: "🥈",
    min: 100,
    max: 250
  },
  {
    name: "Gold",
    icon: "🥇",
    min: 250,
    max: 500
  },
  {
    name: "Platinum",
    icon: "💎",
    min: 500,
    max: 1000
  },
  {
    name: "Diamond",
    icon: "🔷",
    min: 1000,
    max: 2000
  },
  {
    name: "Champion",
    icon: "👑",
    min: 2000,
    max: 3500
  },
  {
    name: "Legend",
    icon: "🔥",
    min: 3500,
    max: 999999999
  }
];

let currentUser = null;
let currentData = null;

auth.onAuthStateChanged(async(user)=>{

    if(!user){

        window.location="index.html";
        return;

    }

    currentUser=user;

    const doc=await db.collection("users")
    .doc(user.uid)
    .get();

    currentData=doc.data()||{};

    loadLeague();

});

function getCurrentRank(lp){

    for(const rank of RANKS){

        if(lp>=rank.min && lp<rank.max){

            return rank;

        }

    }

    return RANKS[RANKS.length-1];

}

function getNextRank(lp){

    for(const rank of RANKS){

        if(lp<rank.max){

            return rank;

        }

    }

    return null;

}

async function loadLeague(){

    const lp=currentData.leaguePoints||0;

    const rank=getCurrentRank(lp);

    document.getElementById("playerRank").innerHTML=
    rank.icon+" "+rank.name;

    document.getElementById("playerLP").innerHTML=
    lp+" LP";

    document.getElementById("rankIcon").innerHTML=
    rank.icon;

    updateProgress(lp);

    if(rank.name==="Legend"){

        document.getElementById("legendContainer").style.display="block";

        loadLegendLeaderboard();

    }

    else{

        document.getElementById("legendContainer").style.display="none";

    }

}

function updateProgress(lp){

    const rank=getCurrentRank(lp);

    const progress=document.getElementById("progressBar");

    const nextText=document.getElementById("nextRank");

    if(rank.name==="Legend"){

        progress.style.width="100%";

        nextText.innerHTML=
        "🏆 Tu as atteint le rang maximal.";

        return;

    }

    const currentMin=rank.min;

    const currentMax=rank.max;

    const percent=((lp-currentMin)/(currentMax-currentMin))*100;

    progress.style.width=percent+"%";

    const remaining=currentMax-lp;

    const nextRank=RANKS.find(r=>r.min===currentMax);

    nextText.innerHTML=
    `Encore <b>${remaining} LP</b> avant <b>${nextRank.icon} ${nextRank.name}</b>`;

}

async function checkRankUp(){

    const userRef=db.collection("users")
    .doc(currentUser.uid);

    const doc=await userRef.get();

    const data=doc.data()||{};

    const lp=data.leaguePoints||0;

    const oldRank=data.leagueRank||"Bronze";

    const newRank=getCurrentRank(lp).name;

    if(oldRank!==newRank){

        await userRef.update({

            leagueRank:newRank

        });

        showRankUp(oldRank,newRank);

    }

}

function showRankUp(oldRank,newRank){

    const popup=document.getElementById("rankUpPopup");

    const text=document.getElementById("rankUpText");

    if(!popup || !text) return;

    text.innerHTML=
    `${oldRank}<br>⬇<br>${newRank}`;

    popup.classList.add("show");

}

function closeRankUp(){

    document
    .getElementById("rankUpPopup")
    .classList
    .remove("show");

}

setInterval(checkRankUp,5000);

async function loadLegendLeaderboard() {

    const table = document.getElementById("leagueTable");

    if (!table) return;

    table.innerHTML =
        "<tr><td colspan='3'>Chargement...</td></tr>";

    const snapshot = await db
        .collection("users")
        .where("leagueRank", "==", "Legend")
        .get();

    let players = [];

    snapshot.forEach(doc => {

        players.push({
            id: doc.id,
            ...doc.data()
        });

    });

    players.sort((a, b) =>
        (b.leaguePoints || 0) -
        (a.leaguePoints || 0)
    );

    table.innerHTML = "";

    if (players.length === 0) {

        table.innerHTML =
            "<tr><td colspan='3'>Aucun joueur Legend.</td></tr>";

        return;
    }

    players.forEach((player, index) => {

        let medal = "";

        if (index === 0) medal = "🥇";
        else if (index === 1) medal = "🥈";
        else if (index === 2) medal = "🥉";
        else medal = "#" + (index + 1);

        table.innerHTML += `

        <tr>

            <td>${medal}</td>

            <td>

                🔥 ${player.pseudo || player.email}

                ${
                    player.isContentCreator
                    ? "<span class='creator-badge'>Content Creator</span>"
                    : ""
                }

            </td>

            <td>${player.leaguePoints || 0} LP</td>

        </tr>

        `;

    });

}

function getNextSunday2130() {

    const now = new Date();

    const next = new Date(now);

    next.setDate(
        now.getDate() + ((7 - now.getDay()) % 7)
    );

    next.setHours(21);
    next.setMinutes(30);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (next <= now) {
        next.setDate(next.getDate() + 7);
    }

    return next;

}

let promotionDate = getNextSunday2130();

function updateLeagueTimer() {

    const timer =
        document.getElementById("leaguePromotionTimer");

    if (!timer) return;

    const now = new Date();

    if (promotionDate <= now) {
        promotionDate = getNextSunday2130();
    }

    const diff = promotionDate - now;

    const days = Math.floor(diff / 86400000);

    const hours = Math.floor(
        (diff % 86400000) / 3600000
    );

    const minutes = Math.floor(
        (diff % 3600000) / 60000
    );

    const seconds = Math.floor(
        (diff % 60000) / 1000
    );

    timer.innerHTML =
        `🏆 Nouvelle saison dans ${days}j ${hours}h ${minutes}m ${seconds}s`;

}

setInterval(updateLeagueTimer, 1000);

updateLeagueTimer();

console.log("✅ League chargée");