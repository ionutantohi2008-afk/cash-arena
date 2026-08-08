// ======================================================
// CASH ARENA API
// Server.js
// ======================================================

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const cron = require("node-cron");

const app = express();

app.use(cors());
app.use(express.json());

// ======================================================
// FIREBASE
// ======================================================

const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

db.settings({
    ignoreUndefinedProperties: true
});

// ======================================================
// CONFIG
// ======================================================

const PORT = process.env.PORT || 3000;

const BRAWL_TOKEN =
    process.env.BRAWL_TOKEN;

// ======================================================
// LEAGUE
// ======================================================

const LEAGUE = [

{
    name:"Bronze",
    icon:"🥉",
    min:0,
    max:99
},

{
    name:"Silver",
    icon:"🥈",
    min:100,
    max:249
},

{
    name:"Gold",
    icon:"🥇",
    min:250,
    max:499
},

{
    name:"Platinum",
    icon:"💎",
    min:500,
    max:999
},

{
    name:"Diamond",
    icon:"🔷",
    min:1000,
    max:1999
},

{
    name:"Champion",
    icon:"👑",
    min:2000,
    max:3499
},

{
    name:"Legend",
    icon:"🔥",
    min:3500,
    max:999999999
}

];

// ======================================================
// RECOMPENSES TOP 10
// ======================================================

const rewards = [

30,
20,
15,
10,
8,
6,
5,
4,
3,
2

];


// ==========================================
// ID DU DAILY PRECEDENT
// ==========================================

function getPreviousDailyTournamentId() {

    const now = new Date();

    const resetHour = 19;
    const resetMinute = 30;

    // Avant 19h30, le Daily précédent
    // est celui d'avant-hier par rapport au prochain reset.
    if (
        now.getHours() < resetHour ||
        (
            now.getHours() === resetHour &&
            now.getMinutes() < resetMinute
        )
    ) {
        now.setDate(now.getDate() - 1);
    }

    // On recule encore d'une journée
    // pour récupérer le Daily terminé.
    now.setDate(now.getDate() - 1);

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

// ==========================================
// RECOMPENSES DAILY CUP
// ==========================================

app.post("/api/daily/give-rewards", async (req, res) => {

    try {

        // ==========================================
        // DAILY QUI VIENT DE SE TERMINER
        // ==========================================

        const dailyId =
            getPreviousDailyTournamentId();

        console.log(
            "🏆 Distribution récompenses Daily :",
            dailyId
        );


        // ==========================================
        // TOURNOI
        // ==========================================

        const tournamentRef =
            db
                .collection("tournaments")
                .doc(dailyId);

        const tournamentDoc =
            await tournamentRef.get();


        if (!tournamentDoc.exists) {

            return res.status(404).json({

                error: true,

                message:
                    "Daily terminé introuvable"

            });

        }


        const tournament =
            tournamentDoc.data();


        // ==========================================
        // PROTECTION DOUBLE RECOMPENSE
        // ==========================================

        if (tournament.rewardsGiven === true) {

            return res.status(400).json({

                error: true,

                message:
                    "Les récompenses de ce Daily ont déjà été distribuées"

            });

        }


        // ==========================================
        // RECOMPENSES TOP 10
        // ==========================================

        const rewards = [

            10, // 1er
            7,  // 2e
            5,  // 3e
            3,  // 4e
            3,  // 5e
            1,  // 6e
            1,  // 7e
            1,  // 8e
            1,  // 9e
            1   // 10e

        ];


        // ==========================================
        // CLASSEMENT
        // ==========================================

        const snapshot =
            await tournamentRef
                .collection("players")
                .orderBy("points", "desc")
                .get();


        if (snapshot.empty) {

            // On marque quand même le Daily
            // comme traité pour éviter de
            // recommencer indéfiniment.

            await tournamentRef.update({

                rewardsGiven: true,

                rewardsGivenAt:
                    admin.firestore.FieldValue
                        .serverTimestamp(),

                rewardsCount: 0

            });

            return res.json({

                success: true,

                tournamentId: dailyId,

                rewardedPlayers: 0,

                message:
                    "Aucun joueur à récompenser"

            });

        }


        const batch =
            db.batch();


        let rewardedPlayers = 0;


        // ==========================================
        // TOP 10
        // ==========================================

        for (
            let index = 0;
            index < snapshot.docs.length &&
            index < rewards.length;
            index++
        ) {

            const playerDoc =
                snapshot.docs[index];

            const player =
                playerDoc.data();


            const uid =
                player.uid ||
                playerDoc.id;


            if (!uid) {

                continue;

            }


            const lp =
                rewards[index];


            // ==========================================
            // UTILISATEUR
            // ==========================================

            const userRef =
                db
                    .collection("users")
                    .doc(uid);

            const userDoc =
                await userRef.get();


            if (!userDoc.exists) {

                console.log(
                    "⚠ Utilisateur introuvable :",
                    uid
                );

                continue;

            }


            const user =
                userDoc.data();


            // ==========================================
            // LP
            // ==========================================

            const currentLP =
                Number(
                    user.leaguePoints || 0
                );

            const newLP =
                currentLP + lp;


            // ==========================================
            // RANK
            // ==========================================

            const newRank =
                getRank(newLP);


            // ==========================================
            // USER
            // ==========================================

            batch.update(
                userRef,
                {

                    leaguePoints:
                        newLP,

                    leagueRank:
                        newRank,

                    updatedAt:
                        admin.firestore.FieldValue
                            .serverTimestamp()

                }
            );


            // ==========================================
            // HISTORIQUE
            // ==========================================

            const historyRef =
                userRef
                    .collection("leagueHistory")
                    .doc();


            batch.set(
                historyRef,
                {

                    tournamentId:
                        dailyId,

                    type:
                        "daily",

                    position:
                        index + 1,

                    lp:
                        lp,

                    previousLP:
                        currentLP,

                    newLP:
                        newLP,

                    previousRank:
                        user.leagueRank ||
                        "Bronze",

                    newRank:
                        newRank,

                    createdAt:
                        admin.firestore.FieldValue
                            .serverTimestamp()

                }
            );


            // ==========================================
            // JOUEUR RECOMPENSE
            // ==========================================

            batch.update(
                playerDoc.ref,
                {

                    rewardGiven:
                        true,

                    reward:
                        lp,

                    rewardPosition:
                        index + 1

                }
            );


            console.log(
                "🏆",
                index + 1,
                player.pseudo || uid,
                "+",
                lp,
                "LP"
            );


            rewardedPlayers++;

        }


        // ==========================================
        // DAILY TRAITE
        // ==========================================

        batch.update(
            tournamentRef,
            {

                rewardsGiven:
                    true,

                rewardsGivenAt:
                    admin.firestore.FieldValue
                        .serverTimestamp(),

                rewardsCount:
                    rewardedPlayers

            }
        );


        // ==========================================
        // ENREGISTREMENT
        // ==========================================

        await batch.commit();


        console.log(
            "✅ Daily récompensé :",
            dailyId
        );

        console.log(
            "👥 Joueurs récompensés :",
            rewardedPlayers
        );


        res.json({

            success: true,

            tournamentId:
                dailyId,

            rewardedPlayers:
                rewardedPlayers,

            message:
                "Récompenses Daily distribuées avec succès"

        });

    }

    catch (error) {

        console.error(
            "❌ Erreur récompenses Daily :",
            error
        );


        res.status(500).json({

            error: true,

            message:
                "Erreur serveur récompenses Daily"

        });

    }

});

// ======================================================
// RANK
// ======================================================

function getRank(lp){

    if(lp>=3500)
        return "Legend";

    if(lp>=2000)
        return "Champion";

    if(lp>=1000)
        return "Diamond";

    if(lp>=500)
        return "Platinum";

    if(lp>=250)
        return "Gold";

    if(lp>=100)
        return "Silver";

    return "Bronze";

}

// ======================================================
// PARSE DATE BRAWL
// ======================================================

function parseBrawlTime(time){

    return new Date(

`${time.slice(0,4)}-${time.slice(4,6)}-${time.slice(6,8)}T${time.slice(9,11)}:${time.slice(11,13)}:${time.slice(13,15)}Z`

    );

}

// ======================================================
// DAILY TOURNAMENT
// ======================================================

function getDailyTournamentId(){

    const now = new Date(
        new Date().toLocaleString(
            "en-US",
            {
                timeZone:"Europe/Paris"
            }
        )
    );

    if(

        now.getHours()<19 ||

        (

            now.getHours()===19 &&

            now.getMinutes()<30

        )

    ){

        now.setDate(
            now.getDate()-1
        );

    }

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth()+1)
        .padStart(2,"0");

    const day =
        String(now.getDate())
        .padStart(2,"0");

    return `brawl-daily-${year}-${month}-${day}`;

}

// ======================================================
// Weekly Tournament ID
// ======================================================

const TOURNAMENT_ID = "weekly1";

// ======================================================
// API ONLINE
// ======================================================

app.get("/",(req,res)=>{

    res.send("Cash Arena API ONLINE ✅");

});

// ==========================================
// PLAYER
// ==========================================

app.get("/api/brawl/player/:tag", async (req, res) => {

    try {

        const cleanTag = req.params.tag
            .replace("#", "")
            .toUpperCase();

        const response = await fetch(
            `https://api.brawlstars.com/v1/players/%23${cleanTag}`,
            {
                headers: {
                    Authorization: `Bearer ${BRAWL_TOKEN}`,
                    Accept: "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (err) {

        console.error("Erreur Player :", err);

        res.status(500).json({
            error: true,
            message: "Erreur API Player"
        });

    }

});

// ==========================================
// BATTLELOG
// ==========================================

app.get("/api/brawl/player/:tag/battlelog", async (req, res) => {

    try {

        const cleanTag = req.params.tag
            .replace("#", "")
            .toUpperCase();

        const response = await fetch(
            `https://api.brawlstars.com/v1/players/%23${cleanTag}/battlelog`,
            {
                headers: {
                    Authorization: `Bearer ${BRAWL_TOKEN}`,
                    Accept: "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (err) {

        console.error("Erreur Battlelog :", err);

        res.status(500).json({
            error: true,
            message: "Erreur API Battlelog"
        });

    }

});

// ======================================================
// SYNC BATTLELOGS
// ======================================================

async function syncTournamentBattlelogs(tournamentId) {

    console.log("🔥 SYNC :", tournamentId);

    const tournamentRef = db
        .collection("tournaments")
        .doc(tournamentId);

    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {

        console.log("❌ Tournoi introuvable :", tournamentId);

        return;

    }

    const tournament = tournamentDoc.data();

    const startDate =
        tournament.startDate?.toDate
            ? tournament.startDate.toDate()
            : new Date();

    const playersSnap = await tournamentRef
        .collection("players")
        .get();

    console.log(
        "👥 Joueurs trouvés :",
        playersSnap.size
    );

    for (const playerDoc of playersSnap.docs) {

        const player = playerDoc.data();

        if (!player.uid || !player.brawlTag) {
            continue;
        }

        try {

            const cleanTag = player.brawlTag
                .replace("#", "")
                .toUpperCase();

            const response = await fetch(

                `https://api.brawlstars.com/v1/players/%23${cleanTag}/battlelog`,

                {
                    headers: {
                        Authorization: `Bearer ${BRAWL_TOKEN}`
                    }
                }

            );

            const data = await response.json();

            if (!data.items) {
                continue;
            }

            let pointsToAdd = 0;

            const batch = db.batch();
                        for (const item of data.items) {

                const battle =
                    item.battle || {};

                const battleDate =
                    parseBrawlTime(
                        item.battleTime
                    );

                const joinedAt =
                    player.joinedAt?.toDate
                        ? player.joinedAt.toDate()
                        : startDate;

                // Ignore les matchs avant l'inscription
                if (battleDate < joinedAt) {
                    continue;
                }

                const matchId =
                    `${player.uid}_${item.battleTime}_${battle.mode || "mode"}_${battle.type || "type"}`;

                const countedRef =
                    playerDoc.ref
                        .collection("countedMatches")
                        .doc(matchId);

                const countedDoc =
                    await countedRef.get();

                // Match déjà compté
                if (countedDoc.exists) {
                    continue;
                }

                let points = 0;

                let result = null;

                let rank = null;

                // 3v3
                if (
                    battle.result === "victory"
                ) {

                    points = 3;
                    result = "victory";

                }

                else if (
                    battle.result === "defeat"
                ) {

                    points = 1;
                    result = "defeat";

                }

                // Survivant Solo / Duo
                else if (
                    battle.rank !== undefined &&
                    battle.rank !== null
                ) {

                    rank = battle.rank;

                    if (rank <= 4) {

                        points = 3;

                    } else {

                        points = 1;

                    }

                    // IMPORTANT :
                    // évite le bug Firestore
                    result = `rank_${rank}`;

                }

                // Tous les autres modes sont ignorés
                else {

                    continue;

                }

                pointsToAdd += points;

                batch.set(

                    countedRef,

                    {

                        battleTime:
                            item.battleTime,

                        mode:
                            battle.mode || null,

                        type:
                            battle.type || null,

                        result,

                        rank,

                        points,

                        countedAt:
                            admin.firestore.FieldValue.serverTimestamp()

                    }

                );

            }

            if (pointsToAdd > 0) {

                batch.update(

                    playerDoc.ref,

                    {

                        points:

                        admin.firestore.FieldValue.increment(
                            pointsToAdd
                        ),

                        updatedAt:

                        admin.firestore.FieldValue.serverTimestamp()

                    }

                );

                await batch.commit();

                console.log(

                    "✅",

                    player.pseudo,

                    "+",

                    pointsToAdd,

                    "points"

                );

            }

        }

        catch (err) {

            console.error(

                "❌ Erreur joueur",

                player.pseudo,

                err

            );

        }

    }

    console.log(

        "🏁 Sync terminée :",

        tournamentId

    );

}

// ======================================================
// DISTRIBUTION DES RECOMPENSES LEAGUE
// ======================================================

app.post(
    "/api/tournaments/:tournamentId/give-rewards",
    async (req, res) => {

        try {

            const tournamentId =
                req.params.tournamentId;

            const tournamentRef =
                db.collection("tournaments")
                .doc(tournamentId);

            const tournamentDoc =
                await tournamentRef.get();

            if (!tournamentDoc.exists) {

                return res.status(404).json({
                    success: false,
                    message: "Tournoi introuvable"
                });

            }

            if (
                tournamentDoc.data().rewardsGiven
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Récompenses déjà distribuées"
                });

            }

            const playersSnap =
                await tournamentRef
                .collection("players")
                .orderBy("points", "desc")
                .get();

            const batch = db.batch();

            let position = 0;

            for (const playerDoc of playersSnap.docs) {

                if (position >= rewards.length) {
                    break;
                }

                const player =
                    playerDoc.data();

                if (!player.uid) {

                    position++;
                    continue;

                }

                const lp =
                    rewards[position];

                const userRef =
                    db.collection("users")
                    .doc(player.uid);

                const userDoc =
                    await userRef.get();

                if (!userDoc.exists) {

                    position++;
                    continue;

                }

                const user =
                    userDoc.data();

                const newLP =
                    (user.leaguePoints || 0) + lp;

                batch.update(userRef, {

                    leaguePoints: newLP,

                    leagueRank:
                        getRank(newLP),

                    updatedAt:
                        admin.firestore.FieldValue.serverTimestamp()

                });

                batch.set(

                    userRef
                    .collection("leagueHistory")
                    .doc(),

                    {

                        tournamentId,

                        position:
                            position + 1,

                        lp,

                        oldLP:
                            user.leaguePoints || 0,

                        newLP,

                        createdAt:
                            admin.firestore.FieldValue.serverTimestamp()

                    }

                );

                batch.update(

                    playerDoc.ref,

                    {

                        rewardGiven: true,

                        reward: lp

                    }

                );

                console.log(

                    "🏆",

                    player.pseudo,

                    "+",

                    lp,

                    "LP"

                );

                position++;

            }

            batch.update(

                tournamentRef,

                {

                    rewardsGiven: true,

                    rewardsGivenAt:
                        admin.firestore.FieldValue.serverTimestamp()

                }

            );

            await batch.commit();

            res.json({

                success: true,

                message:
                    "Récompenses distribuées"

            });

        }

        catch (err) {

            console.error(err);

            res.status(500).json({

                success: false,

                message: err.message

            });

        }

    }

);

// ======================================================
// CRON AUTOMATIQUE
// ======================================================

cron.schedule("*/5 * * * *", async () => {

    console.log("");
    console.log("==========================================");
    console.log("🔄 CRON CASH ARENA");
    console.log("==========================================");


    try {

        // ==========================================
        // DATE / HEURE ACTUELLE
        // ==========================================

        const now = new Date();

        console.log(
            "🕐 Heure serveur :",
            now.toLocaleString("fr-FR", {
                timeZone: "Europe/Paris"
            })
        );


        // ==========================================
        // ID DU DAILY ACTUEL
        // ==========================================

        const currentDailyId =
            getDailyTournamentId();

        console.log(
            "📅 Daily actuel :",
            currentDailyId
        );


        // ==========================================
        // ID DU DAILY PRECEDENT
        // ==========================================

        const previousDailyId =
            getPreviousDailyTournamentId();

        console.log(
            "📅 Daily précédent :",
            previousDailyId
        );


        // ==========================================
        // 1️⃣ RECOMPENSES DU DAILY PRECEDENT
        // ==========================================

        const currentHour =
            Number(
                new Intl.DateTimeFormat("fr-FR", {
                    timeZone: "Europe/Paris",
                    hour: "2-digit",
                    hour12: false
                }).format(now)
            );

        const currentMinute =
            Number(
                new Intl.DateTimeFormat("fr-FR", {
                    timeZone: "Europe/Paris",
                    minute: "2-digit"
                }).format(now)
            );


        // On traite les récompenses à partir de 19h30.
        //
        // rewardsGiven dans Firestore empêche
        // un deuxième paiement.

        if (
            currentHour > 19 ||
            (
                currentHour === 19 &&
                currentMinute >= 30
            )
        ) {

            console.log(
                "🏆 Vérification récompenses Daily précédent..."
            );


            const previousTournamentRef =
                db
                    .collection("tournaments")
                    .doc(previousDailyId);


            const previousTournamentDoc =
                await previousTournamentRef.get();


            if (!previousTournamentDoc.exists) {

                console.log(
                    "⚠ Daily précédent introuvable :",
                    previousDailyId
                );

            }

            else {

                const previousTournament =
                    previousTournamentDoc.data();


                // ==========================================
                // DEJA RECOMPENSE ?
                // ==========================================

                if (
                    previousTournament.rewardsGiven === true
                ) {

                    console.log(
                        "✅ Daily précédent déjà récompensé :",
                        previousDailyId
                    );

                }

                else {

                    console.log(
                        "🏆 Distribution des récompenses :",
                        previousDailyId
                    );


                    // ==========================================
                    // APPEL DE LA ROUTE DE RECOMPENSES
                    // ==========================================

                    try {

                        const rewardResponse =
                            await fetch(
                                `http://127.0.0.1:${PORT}/api/daily/give-rewards`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    }
                                }
                            );


                        const rewardData =
                            await rewardResponse.json();


                        if (
                            !rewardResponse.ok ||
                            rewardData.error
                        ) {

                            console.error(
                                "❌ Erreur récompenses Daily :",
                                rewardData.message ||
                                rewardData
                            );

                        }

                        else {

                            console.log(
                                "✅ Récompenses Daily distribuées !",
                                rewardData
                            );

                        }

                    }

                    catch (rewardError) {

                        console.error(
                            "❌ Impossible de distribuer les récompenses :",
                            rewardError
                        );

                    }

                }

            }

        }


        // ==========================================
        // 2️⃣ BOTS DU NOUVEAU DAILY
        // ==========================================

        console.log(
            "🤖 Vérification des bots :",
            currentDailyId
        );


        try {

            await addBotsToDaily();

            console.log(
                "✅ Vérification bots terminée"
            );

        }

        catch (botError) {

            console.error(
                "❌ Erreur bots Daily :",
                botError
            );

        }


        // ==========================================
        // 3️⃣ SYNCHRONISATION WEEKLY
        // ==========================================

        console.log(
            "🔄 Sync Weekly :",
            TOURNAMENT_ID
        );


        try {

            await syncTournamentBattlelogs(
                TOURNAMENT_ID
            );

            console.log(
                "✅ Sync Weekly terminée"
            );

        }

        catch (weeklyError) {

            console.error(
                "❌ Erreur sync Weekly :",
                weeklyError
            );

        }


        // ==========================================
        // 4️⃣ SYNCHRONISATION DAILY
        // ==========================================

        console.log(
            "🔄 Sync Daily :",
            currentDailyId
        );


        try {

            await syncTournamentBattlelogs(
                currentDailyId
            );

            console.log(
                "✅ Sync Daily terminée"
            );

        }

        catch (dailyError) {

            console.error(
                "❌ Erreur sync Daily :",
                dailyError
            );

        }


        // ==========================================
        // FIN
        // ==========================================

        console.log("");
        console.log("==========================================");
        console.log("🏁 CRON TERMINÉ");
        console.log("==========================================");
        console.log("");

    }

    catch (error) {

        console.error(
            "❌ ERREUR GENERALE CRON :",
            error
        );

    }

});

// ======================================================
// MAJ DES RANGS
// ======================================================

async function refreshLeagueRanks(){

    console.log(
        "🏆 Vérification des rangs..."
    );

    const snapshot =
        await db
        .collection("users")
        .get();

    const batch =
        db.batch();

    let updated = 0;

    snapshot.forEach(doc=>{

        const user =
            doc.data();

        const lp =
            user.leaguePoints || 0;

        const rank =
            getRank(lp);

        if(user.leagueRank!==rank){

            batch.update(
                doc.ref,
                {
                    leagueRank:rank
                }
            );

            updated++;

        }

    });

    if(updated>0){

        await batch.commit();

    }

    console.log(
        "🏆 Rangs mis à jour :",
        updated
    );

}

// ======================================================
// Vérification toutes les heures
// ======================================================

cron.schedule("0 * * * *",async()=>{

    try{

        await refreshLeagueRanks();

    }

    catch(err){

        console.error(err);

    }

});

// ======================================================
// LEAGUE UTILS
// ======================================================

function getCurrentLeague(lp){

    for(const league of LEAGUE){

        if(
            lp>=league.min &&
            lp<=league.max
        ){
            return league;
        }

    }

    return LEAGUE[
        LEAGUE.length-1
    ];

}

function getNextLeague(lp){

    for(let i=0;i<LEAGUE.length;i++){

        const current=
            LEAGUE[i];

        if(
            lp>=current.min &&
            lp<=current.max
        ){

            if(
                i===LEAGUE.length-1
            ){
                return null;
            }

            return LEAGUE[i+1];

        }

    }

    return null;

}

function getProgress(lp){

    const league=
        getCurrentLeague(lp);

    if(
        league.name==="Legend"
    ){

        return{

            percent:100,

            current:lp,

            target:lp,

            remaining:0

        };

    }

    const current=
        lp-league.min;

    const total=
        league.max-league.min+1;

    const percent=
        Math.floor(
            (current/total)*100
        );

    return{

        percent,

        current:lp,

        target:league.max+1,

        remaining:
        (league.max+1)-lp

    };

}

// ======================================================
// API LEAGUE
// ======================================================

app.get(
"/api/league/:uid",

async(req,res)=>{

try{

const uid=
req.params.uid;

const doc=
await db
.collection("users")
.doc(uid)
.get();

if(!doc.exists){

return res.status(404).json({

error:true,

message:"Utilisateur introuvable"

});

}

const user=
doc.data();

const lp=
user.leaguePoints||0;

const league=
getCurrentLeague(lp);

const nextLeague=
getNextLeague(lp);

const progress=
getProgress(lp);

res.json({

success:true,

league,

nextLeague,

progress,

lp

});

}

catch(err){

console.error(err);

res.status(500).json({

error:true

});

}

});

// ======================================================
// LEADERBOARD LEGEND
// ======================================================

app.get("/api/league/legend", async (req, res) => {

    try {

        const snapshot =
            await db
            .collection("users")
            .where("leagueRank", "==", "Legend")
            .orderBy("leaguePoints", "desc")
            .limit(100)
            .get();

        const players = [];

        snapshot.forEach(doc => {

            const data = doc.data();

            players.push({

                uid: doc.id,

                pseudo:
                    data.pseudo ||
                    data.email ||
                    "Unknown",

                leaguePoints:
                    data.leaguePoints || 0,

                leagueRank:
                    data.leagueRank || "Legend",

                contentCreator:
                    data.isContentCreator || false

            });

        });

        res.json({

            success: true,

            total: players.length,

            players

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// ======================================================
// TOP PLAYER
// ======================================================

app.get("/api/league/top", async (req, res) => {

    try {

        const snapshot =
            await db
            .collection("users")
            .orderBy("leaguePoints", "desc")
            .limit(1)
            .get();

        if (snapshot.empty) {

            return res.json({

                success: true,

                player: null

            });

        }

        const doc =
            snapshot.docs[0];

        const data =
            doc.data();

        res.json({

            success: true,

            player: {

                uid: doc.id,

                pseudo:
                    data.pseudo ||
                    data.email,

                leaguePoints:
                    data.leaguePoints || 0,

                leagueRank:
                    data.leagueRank || "Bronze"

            }

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false

        });

    }

});

// ======================================================
// INFOS LEAGUE
// ======================================================

app.get("/api/league/ranks", (req, res) => {

    res.json({

        success: true,

        ranks: LEAGUE

    });

});

// ==========================================
// AJOUT AUTOMATIQUE DES BOTS AU DAILY
// ==========================================

async function addBotsToDaily() {

    try {

        // ==========================================
        // ID DU DAILY ACTUEL
        // ==========================================

        const dailyId =
            getDailyTournamentId();

        console.log(
            "🤖 Vérification des bots pour :",
            dailyId
        );


        // ==========================================
        // TOURNOI
        // ==========================================

        const tournamentRef =
            db
            .collection("tournaments")
            .doc(dailyId);

        const tournamentDoc =
            await tournamentRef.get();

        if (!tournamentDoc.exists) {

            console.log(
                "❌ Daily introuvable :",
                dailyId
            );

            return;

        }


        // ==========================================
        // RECUPERE TOUS LES BOTS
        // ==========================================

        const botsSnap =
            await db
            .collection("users")
            .where(
                "isBot",
                "==",
                true
            )
            .get();

        console.log(
            "🤖 Bots trouvés :",
            botsSnap.size
        );


        const batch =
            db.batch();

        let added = 0;


        // ==========================================
        // TRAITEMENT DES BOTS
        // ==========================================

        for (
            const botDoc of botsSnap.docs
        ) {

            const bot =
                botDoc.data();

            const botRef =
                botDoc.ref;


            // ==========================================
            // CHANCE DU BOT
            // ==========================================

            let chance =
                typeof bot.botJoinChance === "number"
                    ? bot.botJoinChance
                    : 100;


            // Sécurité : entre 0 et 100

            chance =
                Math.max(
                    0,
                    Math.min(
                        100,
                        chance
                    )
                );


            // ==========================================
            // VERIFICATION DE LA DECISION
            // ==========================================

            const previousTournament =
                bot.dailyJoinDecisionTournament;

            const previousDecision =
                bot.dailyJoinDecision;


            // ==========================================
            // LE BOT A DEJA UNE DECISION
            // POUR CE DAILY
            // ==========================================

            if (
                previousTournament === dailyId &&
                typeof previousDecision === "boolean"
            ) {

                console.log(
                    "🤖 Décision déjà prise :",
                    bot.pseudo || botDoc.id,
                    "=>",
                    previousDecision
                        ? "REJOINT"
                        : "NE REJOINT PAS"
                );

                continue;

            }


            // ==========================================
            // NOUVEAU DAILY
            // NOUVEAU TIRAGE
            // ==========================================

            const random =
                Math.random() * 100;

            const decision =
                random < chance;


            console.log(
                "🎲 Nouveau tirage :",
                bot.pseudo || botDoc.id,
                "| Chance :",
                chance + "%",
                "| Résultat :",
                decision
                    ? "REJOINT"
                    : "NE REJOINT PAS"
            );


            // ==========================================
            // SAUVEGARDE LA DECISION
            // ==========================================

            batch.update(
                botRef,
                {

                    dailyJoinDecision:
                        decision,

                    dailyJoinDecisionTournament:
                        dailyId

                }
            );


            // ==========================================
            // LE BOT NE REJOINT PAS
            // ==========================================

            if (!decision) {

                continue;

            }


            // ==========================================
            // REFERENCE DU JOUEUR
            // ==========================================

            const playerRef =
                tournamentRef
                .collection("players")
                .doc(botDoc.id);


            // ==========================================
            // VERIFICATION SI DEJA PRESENT
            // ==========================================

            const playerDoc =
                await playerRef.get();

            if (playerDoc.exists) {

                console.log(
                    "🤖 Bot déjà présent :",
                    bot.pseudo || botDoc.id
                );

                continue;

            }


            // ==========================================
            // AJOUT DU BOT AU DAILY
            // ==========================================

            batch.set(
                playerRef,
                {

                    uid:
                        botDoc.id,

                    pseudo:
                        bot.pseudo ||
                        `Bot ${botDoc.id.slice(0, 5)}`,

                    email:
                        bot.email || null,

                    brawlTag:
                        bot.brawlTag || null,

                    points:
                        0,

                    isBot:
                        true,

                    joinedAt:
                        admin.firestore.FieldValue
                        .serverTimestamp()

                }
            );


            added++;


            console.log(
                "✅ Bot ajouté au Daily :",
                bot.pseudo || botDoc.id
            );

        }


        // ==========================================
        // ENREGISTRE TOUTES LES MODIFICATIONS
        // ==========================================

        await batch.commit();


        console.log(
            "🤖 Bots ajoutés :",
            added
        );


    }

    catch (error) {

        console.error(
            "❌ Erreur addBotsToDaily :",
            error
        );

    }

}

// ======================================================
// DEMARRAGE SERVEUR
// ======================================================

app.listen(PORT, () => {

    console.log("");
    console.log("======================================");
    console.log("🚀 CASH ARENA API");
    console.log("======================================");
    console.log(`✅ Serveur lancé sur le port ${PORT}`);
    console.log(`🏆 Weekly : ${TOURNAMENT_ID}`);
    console.log(`📅 Daily : ${getDailyTournamentId()}`);
    console.log("🔥 Battlelogs : ACTIVÉS");
    console.log("🏅 League : ACTIVÉE");
    console.log("======================================");
    console.log("");

});

// ======================================================
// GESTION DES ERREURS
// ======================================================

process.on("uncaughtException", (err) => {

    console.error("");
    console.error("======================================");
    console.error("❌ UNCAUGHT EXCEPTION");
    console.error(err);
    console.error("======================================");
    console.error("");

});

process.on("unhandledRejection", (reason) => {

    console.error("");
    console.error("======================================");
    console.error("❌ UNHANDLED REJECTION");
    console.error(reason);
    console.error("======================================");
    console.error("");

});

// ======================================================
// ARRÊT PROPRE
// ======================================================

process.on("SIGINT", () => {

    console.log("");

    console.log("🛑 Arrêt du serveur...");

    process.exit(0);

});

process.on("SIGTERM", () => {

    console.log("");

    console.log("🛑 Serveur arrêté.");

    process.exit(0);

});