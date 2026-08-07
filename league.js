console.log("League chargé");

let currentUser = null;

const RANKS = [

{
name:"Bronze",
icon:"🥉",
min:0,
max:100
},

{
name:"Silver",
icon:"🥈",
min:100,
max:250
},

{
name:"Gold",
icon:"🥇",
min:250,
max:500
},

{
name:"Platinum",
icon:"💎",
min:500,
max:1000
},

{
name:"Diamond",
icon:"🔷",
min:1000,
max:2000
},

{
name:"Champion",
icon:"👑",
min:2000,
max:3500
},

{
name:"Legend",
icon:"🔥",
min:3500,
max:null
}

];

auth.onAuthStateChanged(async user=>{

if(!user){

window.location="index.html";
return;

}

currentUser=user;

const doc=await db
.collection("users")
.doc(user.uid)
.get();

const data=doc.data()||{};

const lp=data.leaguePoints||0;

const rank=getRankFromLP(lp);

document.getElementById("playerRank").innerText=
rank.icon+" "+rank.name;

document.getElementById("rankIcon").innerText=
rank.icon;

document.getElementById("playerLP").innerText=
lp+" LP";

updateProgress(lp);

highlightRoad(rank.name);

if(rank.name==="Legend"){

document.getElementById("legendCard").style.display="block";

loadLegend();

}
else{

document.getElementById("legendCard").style.display="none";

}

});

function getRankFromLP(lp){

for(const rank of RANKS){

if(rank.max===null){

return rank;

}

if(lp>=rank.min && lp<rank.max){

return rank;

}

}

return RANKS[0];

}

function updateProgress(lp){

const rank=getRankFromLP(lp);

const fill=
document.getElementById("progressFill");

const text=
document.getElementById("progressText");

const nextText=
document.getElementById("nextRank");

if(rank.max===null){

fill.style.width="100%";

text.innerText=
lp+" LP";

nextText.innerHTML=
"🔥 Tu as atteint le rang maximum !";

return;

}

const current=
lp-rank.min;

const total=
rank.max-rank.min;

const percent=
(current/total)*100;

fill.style.width=
percent+"%";

text.innerHTML=
lp+" / "+rank.max+" LP";

const nextRank=
RANKS[
RANKS.indexOf(rank)+1
];

nextText.innerHTML=
"Encore <b>"+(rank.max-lp)+" LP</b> avant <b>"+nextRank.name+"</b>";

}

function highlightRoad(rankName){

document
.querySelectorAll(".road-rank")
.forEach(rank=>{

rank.classList.remove("active");

});

const id=
"road"+rankName;

const card=
document.getElementById(id);

if(card){

card.classList.add("active");

}

}

// ======================================
// RANK UP
// ======================================

let previousRank = null;

async function checkRankUp() {

    if (!currentUser) return;

    const doc = await db
        .collection("users")
        .doc(currentUser.uid)
        .get();

    const data = doc.data() || {};

    const lp = data.leaguePoints || 0;

    const rank = getRankFromLP(lp);

    if (previousRank === null) {
        previousRank = rank.name;
        return;
    }

    if (previousRank !== rank.name) {

        showRankUp(rank);

        previousRank = rank.name;

    }

}

function showRankUp(rank) {

    const popup =
        document.getElementById("rankUpPopup");

    const icon =
        document.getElementById("rankUpIcon");

    const text =
        document.getElementById("rankUpText");

    icon.innerText =
        rank.icon;

    text.innerText =
        rank.name;

    popup.classList.add("show");

    setTimeout(() => {

        popup.classList.remove("show");

    }, 5000);

}

// Vérifie toutes les 3 secondes
setInterval(checkRankUp,3000);

// ======================================
// LEADERBOARD LEGEND
// ======================================

async function loadLegend() {

    const table =
        document.getElementById("legendTable");

    if (!table) return;

    const snapshot =
        await db
        .collection("users")
        .where("leagueRank","==","Legend")
        .get();

    let players = [];

    snapshot.forEach(doc => {

        players.push({

            id: doc.id,

            ...doc.data()

        });

    });

    players.sort((a,b)=>

        (b.leaguePoints || 0) -

        (a.leaguePoints || 0)

    );

    table.innerHTML = "";

    if(players.length===0){

        table.innerHTML=`

        <tr>

            <td colspan="3">

                Aucun joueur Legend.

            </td>

        </tr>

        `;

        return;

    }

    players.forEach((player,index)=>{

        let medal="";

        if(index===0) medal="🥇";
        else if(index===1) medal="🥈";
        else if(index===2) medal="🥉";
        else medal="#"+(index+1);

        table.innerHTML+=`

        <tr>

            <td>

                ${medal}

            </td>

            <td>

                ${player.pseudo || player.email}

            </td>

            <td>

                ⭐ ${player.leaguePoints || 0}

            </td>

        </tr>

        `;

    });

}

// Actualise automatiquement toutes les 10 secondes
setInterval(()=>{

    const legendCard=document.getElementById("legendCard");

    if(
        legendCard &&
        legendCard.style.display!=="none"
    ){

        loadLegend();

    }

},10000);

// ======================================
// RAFRAICHISSEMENT AUTOMATIQUE
// ======================================

async function refreshLeague(){

    if(!currentUser) return;

    const doc = await db
        .collection("users")
        .doc(currentUser.uid)
        .get();

    const data = doc.data() || {};

    const lp = data.leaguePoints || 0;

    const rank = getRankFromLP(lp);

    document.getElementById("playerRank").innerHTML =
        rank.icon + " " + rank.name;

    document.getElementById("rankIcon").innerHTML =
        rank.icon;

    document.getElementById("playerLP").innerHTML =
        lp + " LP";

    updateProgress(lp);

    highlightRoad(rank.name);

    if(rank.name==="Legend"){

        document.getElementById("legendCard").style.display="block";

        loadLegend();

    }else{

        document.getElementById("legendCard").style.display="none";

    }

}

// Mise à jour toutes les 5 secondes
setInterval(refreshLeague,5000);

// ======================================
// ANIMATION BARRE DE PROGRESSION
// ======================================

function animateProgress(percent){

    const fill =
        document.getElementById("progressFill");

    if(!fill) return;

    fill.style.width="0%";

    setTimeout(()=>{

        fill.style.width =
            percent+"%";

    },150);

}

// ======================================
// CHARGEMENT INITIAL
// ======================================

window.onload=()=>{

    refreshLeague();

};

// ======================================
// FIN DU FICHIER
// ======================================