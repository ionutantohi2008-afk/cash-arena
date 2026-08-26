// ======================================================
// CASH ARENA API
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
const BRAWL_TOKEN = process.env.BRAWL_TOKEN;

// ======================================================
// ⚡ CACHES EN MÉMOIRE RAM (Évite les lectures Firestore)
// ======================================================
// Ces objets stockent l'ID, le tag et le dernier match vérifié
// Structure : { "userId": { tag: "#LPR2V9", lastMatchId: "12345" } }
const dailyPlayersCache = {};
const weeklyPlayersCache = {};

// ======================================================
// 🧠 CENTRALISATION CACHE RAM - GOLD CUP (Optimisé Render)
// ======================================================
const GOLD_CUP_CACHE = {
    initialized: false,
    rewardsGiven: false,
    syncing: false,
    
    lastCheck: 0,
    lastSync: 0,
    
    // Config Temps (5 minutes)
    checkInterval: 5 * 60 * 1000, 

    // Données en mémoire active
    matches: new Set(), // matchId déjà vérifiés / traités
    players: new Map(), // joueurs déjà chargés dans cette instance

    // ✅ NOUVEAU : Nettoie le cache pour éviter que la RAM de Render ne sature
    clearExpiredCache() {
        const maxMatchesInMemory = 1000;
        if (this.matches.size > maxMatchesInMemory) {
            console.log("🧹 [Backend] Nettoyage préventif de la mémoire des matches...");
            this.matches.clear(); // Réinitialise si la liste devient trop gigantesque
        }
        
        // Optionnel : Vous pouvez aussi vider les joueurs inactifs après X minutes
        const now = Date.now();
        if (now - this.lastCheck > 24 * 60 * 60 * 1000) { // Toutes les 24h
            this.players.clear();
            console.log("🧹 [Backend] Flush quotidien de la mémoire des joueurs terminé.");
        }
    }
};

// À AJOUTER TOUT EN HAUT DU FICHIER SERVER.JS
const goldCupMemory = {
    syncing: false,
    matches: new Set() // Un Set est idéal pour stocker et chercher des matchId uniques
};

// ======================================================
// LEAGUE
// ======================================================

const LEAGUE = [
    { name: "Bronze", icon: "🥉", min: 0, max: 99 },
    { name: "Silver", icon: "🥈", min: 100, max: 249 },
    { name: "Gold", icon: "🥇", min: 250, max: 499 },
    { name: "Platinum", icon: "💎", min: 500, max: 999 },
    { name: "Diamond", icon: "🔷", min: 1000, max: 1999 },
    { name: "Champion", icon: "👑", min: 2000, max: 3499 },
    { name: "Legend", icon: "🔥", min: 3500, max: 999999999 }
];

// ==========================================
// OUTILS ET FONCTIONS COGNITIVES
// ==========================================

function getRank(lp) {
    const rank = LEAGUE.find(l => lp >= l.min && lp <= l.max);
    return rank ? rank.name : "Bronze";
}

function getPreviousDailyTournamentId() {
    const now = new Date();
    // Moins 24 heures de manière mathématique absolue
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const formatter = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });

    const parts = formatter.formatToParts(yesterday);
    const year = parts.find(p => p.type === "year").value;
    const month = parts.find(p => p.type === "month").value;
    const day = parts.find(p => p.type === "day").value;

    return `brawl-daily-${year}-${month}-${day}`;
}

// ======================================================
// RECOMPENSES TOP 10 WEEKLY
// ======================================================

const rewards = [

500,
400,
300,
200,
200,
150,
150,
150,
150,
150

];

// ==========================================
// RECOMPENSES DAILY CUP
// ==========================================
app.post("/api/daily/give-rewards", async (req, res) => {
    try {
        const dailyId = getPreviousDailyTournamentId();
        console.log("🏆 Distribution récompenses Daily :", dailyId);

        const tournamentRef = db.collection("tournaments").doc(dailyId);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({
                error: true,
                message: "Daily terminé introuvable"
            });
        }

        const tournament = tournamentDoc.data();

        if (tournament.rewardsGiven === true) {
            return res.status(400).json({
                error: true,
                message: "Les récompenses de ce Daily ont déjà été distribuées"
            });
        }

        const rewardsList = [
            40, // 1er
            30,  // 2e
            25,  // 3e
            20,  // 4e
            20,  // 5e
            10,  // 6e
            10,  // 7e
            10,  // 8e
            10,  // 9e
            10   // 10e
        ];

        const snapshot = await tournamentRef
            .collection("players")
            .orderBy("points", "desc")
            .limit(rewardsList.length)
            .get();

        if (snapshot.empty) {
            await tournamentRef.update({
                rewardsGiven: true,
                rewardsGivenAt: admin.firestore.FieldValue.serverTimestamp(),
                rewardsCount: 0
            });

            return res.json({
                success: true,
                tournamentId: dailyId,
                rewardedPlayers: 0,
                message: "Aucun joueur à récompenser"
            });
        }

        const batch = db.batch();
        let rewardedPlayers = 0;

        for (let index = 0; index < snapshot.docs.length; index++) {
            const playerDoc = snapshot.docs[index];
            const player = playerDoc.data();
            const uid = player.uid || playerDoc.id;

            if (!uid) continue;

            const lp = rewardsList[index];
            const userRef = db.collection("users").doc(uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                console.log("⚠ Utilisateur introuvable :", uid);
                continue;
            }

            const user = userDoc.data();
            const currentLP = Number(user.leaguePoints || 0);
            const newLP = currentLP + lp;
            const newRank = getRank(newLP);

            batch.update(userRef, {
                leaguePoints: newLP,
                leagueRank: newRank,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const historyRef = userRef.collection("leagueHistory").doc();
            batch.set(historyRef, {
                tournamentId: dailyId,
                type: "daily",
                position: index + 1,
                lp: lp,
                previousLP: currentLP,
                newLP: newLP,
                previousRank: user.leagueRank || "Bronze",
                newRank: newRank,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            batch.update(playerDoc.ref, {
                rewardGiven: true,
                reward: lp,
                rewardPosition: index + 1
            });

            console.log(`🏆 N°${index + 1} : ${player.pseudo || uid} +${lp} LP`);
            rewardedPlayers++;
        }

        batch.update(tournamentRef, {
            rewardsGiven: true,
            rewardsGivenAt: admin.firestore.FieldValue.serverTimestamp(),
            rewardsCount: rewardedPlayers
        });

        await batch.commit();

        console.log("✅ Daily récompensé :", dailyId);
        return res.json({
            success: true,
            tournamentId: dailyId,
            rewardedPlayers: rewardedPlayers,
            message: "Récompenses Daily distribuées avec succès"
        });

    } catch (error) {
        console.error("❌ Erreur récompenses Daily :", error);
        return res.status(500).json({
            error: true,
            message: "Une erreur interne est survenue lors de la distribution"
        });
    }
});



// ======================================================
// RANK (Déjà intégré via l'objet LEAGUE de la Partie 1)
// ======================================================
function getRank(lp) {
    if (lp >= 3500) return "Legend";
    if (lp >= 2000) return "Champion";
    if (lp >= 1000) return "Diamond";
    if (lp >= 500) return "Platinum";
    if (lp >= 250) return "Gold";
    if (lp >= 100) return "Silver";
    return "Bronze";
}

// ======================================================
// PARSE DATE BRAWL
// ======================================================
function parseBrawlTime(time) {
    return new Date(
        `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}T${time.slice(9, 11)}:${time.slice(11, 13)}:${time.slice(13, 15)}Z`
    );
}

// ======================================================
// DAILY TOURNAMENT ID (Optimisé à 19h30 heure de Paris)
// ======================================================
function getDailyTournamentId() {
    const now = new Date();

    // On convertit l'instant T dans le fuseau horaire de Paris
    const formatter = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === "year").value, 10);
    const month = parseInt(parts.find(p => p.type === "month").value, 10) - 1; // Les mois vont de 0 à 11 en JS
    const day = parseInt(parts.find(p => p.type === "day").value, 10);
    const hour = parseInt(parts.find(p => p.type === "hour").value, 10);
    const minute = parseInt(parts.find(p => p.type === "minute").value, 10);

    // On crée l'objet date ciblé sur l'heure locale de Paris calculée
    const parisDate = new Date(year, month, day, hour, minute);

    // Si on est avant 19h30, le tournoi Daily en cours appartient à la date d'hier
    if (hour < 19 || (hour === 19 && minute < 30)) {
        parisDate.setDate(parisDate.getDate() - 1);
    }

    const targetYear = parisDate.getFullYear();
    const targetMonth = String(parisDate.getMonth() + 1).padStart(2, "0");
    const targetDay = String(parisDate.getDate()).padStart(2, "0");

    return `brawl-daily-${targetYear}-${targetMonth}-${targetDay}`;
}

// ======================================================
// Weekly Tournament ID
// ======================================================
const TOURNAMENT_ID = "weekly3";

// ======================================================
// 🏆 GOLD CUP - CONFIGURATION SERVEUR
// ======================================================
const GOLD_CUP = {
    enabled: true,
    id: "cash1",
    name: "CASH CUP",
    startDate: "2026-09-01T20:00:00", // Format : YYYY-MM-DDTHH:mm:ss
    durationDays: 14,
    minimumRank: "Gold",
    
    // Récompenses réelles en € (0.50€ pour le #1, etc.)
    rewards: [
        0.50, // #1
        0.30, // #2
        0.20, // #3
        0.20, // #4
        0.20, // #5
        0.20, // #6
        0.10, // #7
        0.10, // #8
        0.10, // #9
        0.10  // #10
    ]
};

// ======================================================
// 📊 ORDRE DES RANGS
// ======================================================
const GOLD_CUP_RANK_ORDER = {
    Bronze: 0,
    Silver: 1,
    Gold: 2,
    Platinum: 3,
    Diamond: 4,
    Champion: 5,
    Legend: 6
};

// ======================================================
// 🔒 VÉRIFIER SI UN JOUEUR PEUT PARTICIPER (Sécurisé)
// ======================================================
function canJoinGoldCup(user) {
    if (!user) {
        return false;
    }

    // Récupération sécurisée du rang. 
    // Si leagueRank est absent, on calcule à partir des points de ligue de manière native :
    let rank = user.leagueRank;
    
    if (!rank && typeof user.leaguePoints !== "undefined") {
        const lp = Number(user.leaguePoints);
        if (lp >= 250) rank = "Gold";
        else if (lp >= 100) rank = "Silver";
        else rank = "Bronze";
    }

    // Fallback alternatif au cas où la fonction globale getRank existe quand même
    if (!rank && typeof getRank === "function") {
        rank = getRank(user.leaguePoints || 0);
    }

    const playerRank = GOLD_CUP_RANK_ORDER[rank];
    const minimumRank = GOLD_CUP_RANK_ORDER[GOLD_CUP.minimumRank];

    if (playerRank === undefined) {
        console.warn(`[Backend] Rang inconnu ou invalide pour l'utilisateur : ${rank}`);
        return false;
    }

    return playerRank >= minimumRank;
}

// ======================================================
// 📅 DATE DE FIN DE LA GOLD CUP
// ======================================================
function getGoldCupEndDate() {
    const start = new Date(GOLD_CUP.startDate);
    
    // Fallback de sécurité si la date configurée est invalide
    if (isNaN(start.getTime())) {
        console.error("[Backend] Erreur : La date startDate de la GOLD_CUP est invalide !");
        return new Date();
    }

    return new Date(start.getTime() + GOLD_CUP.durationDays * 24 * 60 * 60 * 1000);
}

// ======================================================
// 🔄 STATUT DE LA GOLD CUP (Synchronisé avec le Front-end)
// ======================================================
function getGoldCupStatus() {
    const now = new Date();
    const start = new Date(GOLD_CUP.startDate);
    const end = getGoldCupEndDate();

    if (now < start) {
        return "upcoming";
    }

    // ✅ CORRECTION CRITIQUE : Retourne "live" au lieu d' "active" 
    // pour correspondre exactement aux conditions du fichier front-end !
    if (now >= start && now < end) {
        return "live";
    }

    return "finished";
}

// ======================================================
// 🏆 GOLD CUP - API INFORMATIONS
// ======================================================
// ======================================================
// 🏆 GOLD CUP - API INFORMATIONS (Version Corrigée)
// ======================================================
app.get("/api/gold-cup", async (req, res) => {
    try {
        if (!GOLD_CUP.enabled) {
            return res.json({
                success: true,
                enabled: false
            });
        }

        const start = new Date(GOLD_CUP.startDate);
        const end = getGoldCupEndDate();
        const status = getGoldCupStatus(); // Retournera "upcoming", "live", ou "finished"

        return res.json({
            success: true,
            enabled: true,
            id: GOLD_CUP.id,
            name: GOLD_CUP.name,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            durationDays: GOLD_CUP.durationDays,
            minimumRank: GOLD_CUP.minimumRank,
            rewards: GOLD_CUP.rewards,
            status // Synchronisé à 100% avec le front-end
        });

    } catch (error) {
        console.error("❌ Erreur API Gold Cup :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des données de la Gold Cup"
        });
    }
});

// ======================================================
// 🏆 GOLD CUP - API INSCRIPTION (Corrigée)
// ======================================================
app.post("/api/gold-cup/join", async (req, res) => {
    try {
        const uid = req.body.uid;
        if (!uid) {
            return res.status(400).json({
                success: false,
                message: "UID utilisateur manquant"
            });
        }

        if (!GOLD_CUP.enabled) {
            return res.status(400).json({
                success: false,
                message: "La Gold Cup est désactivée"
            });
        }

        const status = getGoldCupStatus();

        // ------------------------------------------
        // AUTORISER LA PRÉ-INSCRIPTION (upcoming) OU EN DIRECT (live)
        // ------------------------------------------
        if (status === "finished") {
            return res.status(400).json({
                success: false,
                message: "La Gold Cup est terminée"
            });
        }

        // ------------------------------------------
        // RÉCUPÉRATION UTILISATEUR
        // ------------------------------------------
        const userRef = db.collection("users").doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        const user = userDoc.data();

        // ------------------------------------------
        // VÉRIFICATION DU RANG
        // ------------------------------------------
        if (!canJoinGoldCup(user)) {
            return res.status(403).json({
                success: false,
                message: `Rang ${GOLD_CUP.minimumRank} requis pour participer`
            });
        }

        // ------------------------------------------
        // DOUBLE INSCRIPTION ?
        // ------------------------------------------
        const playerRef = db
            .collection("tournaments")
            .doc(GOLD_CUP.id)
            .collection("players")
            .doc(uid);

        const playerDoc = await playerRef.get();

        if (playerDoc.exists) {
            return res.json({
                success: true,
                alreadyJoined: true,
                message: "Tu participes déjà à la Gold Cup"
            });
        }

        // Sécurité pour le serveur timestamp selon l'initialisation de votre SDK Firebase
        const serverTimestamp = (typeof admin !== "undefined" && admin.firestore) 
            ? admin.firestore.FieldValue.serverTimestamp() 
            : firebase.firestore.FieldValue.serverTimestamp();

        // Sécurité pour le calcul alternatif du rang textuel si getRank n'est pas déclaré globalement
        let calculatedRank = user.leagueRank;
        if (!calculatedRank && typeof getRank === "function") {
            calculatedRank = getRank(user.leaguePoints || 0);
        } else if (!calculatedRank) {
            calculatedRank = Number(user.leaguePoints || 0) >= 250 ? "Gold" : "Bronze";
        }

        // ------------------------------------------
        // ENREGISTREMENT DANS FIRESTORE
        // ------------------------------------------
        await playerRef.set({
            uid,
            email: user.email || null,
            pseudo: user.pseudo || user.brawlName || user.email || "Joueur",
            brawlTag: user.brawlTag || null,
            brawlName: user.brawlName || null,
            brawlTrophies: user.brawlTrophies || 0,
            leagueRank: calculatedRank,
            leaguePoints: Number(user.leaguePoints || 0),
            isContentCreator: user.isContentCreator || false,
            points: 0,
            rewardGiven: false,
            reward: 0,
            joinedAt: serverTimestamp
        });

        console.log(`🏆 [GOLD CUP] ${user.pseudo || uid} a rejoint la Gold Cup`);

        return res.json({
            success: true,
            message: "Inscription à la Gold Cup réussie !"
        });

    } catch (error) {
        console.error("❌ Erreur inscription Gold Cup :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de l'inscription"
        });
    }
});

// ======================================================
// 💰 GOLD CUP - RÉCOMPENSES OPTIMISÉES (Complété et synchronisé)
// ======================================================
async function giveGoldCupRewards() {
    try {
        if (!GOLD_CUP.enabled) {
            return;
        }

        // ==========================================
        // 🧠 SYNCHRO CACHE CENTRALISÉ (GOLD_CUP_CACHE)
        // Aucune lecture Firestore si déjà fini
        // ==========================================
        if (GOLD_CUP_CACHE.rewardsGiven) {
            console.log("🧠 Gold Cup déjà terminée (cache RAM).");
            return;
        }

        const now = Date.now();

        // ==========================================
        // ⏱️ ÉVITE LES LECTURES SIMULTANÉES OU TROP RAPIDES
        // ==========================================
        if (
            GOLD_CUP_CACHE.initialized &&
            now - GOLD_CUP_CACHE.lastCheck < GOLD_CUP_CACHE.checkInterval
        ) {
            console.log("🧠 Gold Cup déjà vérifiée récemment.");
            return;
        }

        GOLD_CUP_CACHE.lastCheck = now;
        GOLD_CUP_CACHE.initialized = true;

        // ==========================================
        // VÉRIFIE LE STATUT SANS FIRESTORE
        // ==========================================
        const status = getGoldCupStatus();

        if (status !== "finished") {
            console.log("🏆 Gold Cup toujours en cours.");
            return;
        }

        // Évite que deux processus lancent la distribution en même temps (Render multi-instances)
        if (GOLD_CUP_CACHE.syncing) {
            console.log("⏳ Distribution déjà en cours d'exécution...");
            return;
        }
        GOLD_CUP_CACHE.syncing = true;

        // ==========================================
        // UNE SEULE LECTURE DU DOCUMENT TOURNOI
        // ==========================================
        const tournamentRef = db.collection("tournaments").doc(GOLD_CUP.id);
        const tournamentDoc = await tournamentRef.get();

        // Tournoi introuvable
        if (!tournamentDoc.exists) {
            console.log("❌ Gold Cup introuvable dans Firestore.");
            GOLD_CUP_CACHE.syncing = false;
            return;
        }

        const tournament = tournamentDoc.data();

        // Déjà distribué dans la base de données
        if (tournament.rewardsGiven === true) {
            GOLD_CUP_CACHE.rewardsGiven = true;
            GOLD_CUP_CACHE.syncing = false;
            console.log("🧠 Récompenses Gold Cup déjà données dans Firestore (Mise à jour cache).");
            return;
        }

        // ==========================================
        // LECTURE DES GAGNANTS UNIQUEMENT (TOP 10)
        // ==========================================
        const playersSnap = await tournamentRef
            .collection("players")
            .orderBy("points", "desc")
            .limit(GOLD_CUP.rewards.length)
            .get();

        // Aucun joueur inscrit au tournoi
        if (playersSnap.empty) {
            await tournamentRef.update({
                rewardsGiven: true,
                rewardsGivenAt: admin.firestore.FieldValue.serverTimestamp(),
                rewardsCount: 0
            });

            GOLD_CUP_CACHE.rewardsGiven = true;
            GOLD_CUP_CACHE.syncing = false;
            console.log("🏆 Gold Cup terminée sans aucun joueur qualifié.");
            return;
        }

        // ==========================================
        // PRÉPARATION DU BATCH (Écritures groupées)
        // ==========================================
        const batch = db.batch();
        let rewardedPlayers = 0;

        // Configuration du serveur timestamp selon votre architecture
        const serverTimestamp = (typeof admin !== "undefined" && admin.firestore) 
            ? admin.firestore.FieldValue.serverTimestamp() 
            : firebase.firestore.FieldValue.serverTimestamp();

        const incrementField = (typeof admin !== "undefined" && admin.firestore)
            ? admin.firestore.FieldValue.increment
            : firebase.firestore.FieldValue.increment;

        // ==========================================
        // DISTRIBUTION PAR LOTS
        // ==========================================
        for (let index = 0; index < playersSnap.docs.length; index++) {
            const playerDoc = playersSnap.docs[index];
            const player = playerDoc.data();

            const reward = Number(GOLD_CUP.rewards[index] || 0);

            // Pas de récompense configurée pour ce rang
            if (reward <= 0) {
                continue;
            }

            // Sécurité anti-doublon par joueur
            if (player.rewardGiven === true) {
                console.log("⚠️ Déjà récompensé :", player.pseudo || playerDoc.id);
                continue;
            }

            const uid = player.uid || playerDoc.id;
            if (!uid) continue;

            const userRef = db.collection("users").doc(uid);

            // 1. AJOUT DIRECT AU SOLDE DE L'UTILISATEUR (0 lecture)
            batch.set(userRef, {
                balance: incrementField(reward),
                updatedAt: serverTimestamp
            }, { merge: true });

            // 2. MARQUE LE DOCUMENT DU JOUEUR DANS LE TOURNOI
            batch.update(playerDoc.ref, {
                rewardGiven: true,
                reward: reward,
                rewardPosition: index + 1,
                rewardGivenAt: serverTimestamp
            });

            // 3. ENREGISTREMENT DANS L'HISTORIQUE DE L'UTILISATEUR
            const historyRef = userRef.collection("tournamentRewards").doc();
            batch.set(historyRef, {
                tournamentId: GOLD_CUP.id,
                tournamentName: GOLD_CUP.name,
                type: "gold-cup",
                position: index + 1,
                amount: reward,
                currency: "EUR",
                points: player.points || 0,
                createdAt: serverTimestamp
            });

            rewardedPlayers++;
            console.log(`💰 Gold Cup #${index + 1} : ${player.pseudo || uid} +${reward}€`);
        }

        // ==========================================
        // 🏁 FERMETURE DU TOURNOI DANS LE MÊME BATCH
        // ==========================================
        batch.update(tournamentRef, {
            rewardsGiven: true,
            rewardsGivenAt: serverTimestamp,
            rewardsCount: rewardedPlayers
        });

        // Validation finale des écritures Firestore
        await batch.commit();

        // Verrouillage de sécurité en cache RAM
        GOLD_CUP_CACHE.rewardsGiven = true;
        GOLD_CUP_CACHE.syncing = false;
        GOLD_CUP_CACHE.clearExpiredCache(); // Appel du nettoyeur automatique de RAM

        console.log(`✅ [SUCCESS] Distribution terminée. ${rewardedPlayers} joueurs récompensés.`);

    } catch (error) {
        // En cas de crash, on libère le verrou pour permettre une nouvelle tentative
        if (typeof GOLD_CUP_CACHE !== "undefined") {
            GOLD_CUP_CACHE.syncing = false;
        }
        console.error("❌ Erreur critique lors de la distribution Gold Cup :", error);
    }
}

// ======================================================
// 🏆 GOLD CUP - SCRIPT DE SYNCHRONISATION GLOBAL CORRIGÉ
// ======================================================

async function syncGoldCupBattlelogs() {
    if (goldCupMemory.syncing) {
        console.log("🧠 Gold Cup : sync déjà en cours.");
        return;
    }

    goldCupMemory.syncing = true;

    try {
        if (!GOLD_CUP.enabled) {
            console.log("🏆 Gold Cup désactivée.");
            goldCupMemory.syncing = false; 
            return;
        }

        const now = new Date();
        const safeDateString = GOLD_CUP.startDate.replace(/-/g, "/");
        const startDate = new Date(safeDateString);
        const validStartDate = isNaN(startDate.getTime()) ? new Date(GOLD_CUP.startDate) : startDate;

        const endDate = new Date(
            validStartDate.getTime() +
            GOLD_CUP.durationDays * 24 * 60 * 60 * 1000
        );

        if (now < validStartDate) {
            console.log("🏆 Gold Cup : pas encore commencée.");
            goldCupMemory.syncing = false; 
            return;
        }

        if (now >= endDate) {
            console.log("🏁 Gold Cup : tournoi terminé.");
            goldCupMemory.syncing = false; 
            return;
        }

        console.log("🔥 GOLD CUP SYNC :", GOLD_CUP.id);

        const tournamentRef = db.collection("tournaments").doc(GOLD_CUP.id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            console.log("❌ Gold Cup introuvable :", GOLD_CUP.id);
            goldCupMemory.syncing = false; 
            return;
        }

        const playersSnap = await tournamentRef.collection("players").get();
        console.log("👥 Joueurs Gold Cup :", playersSnap.size);

        const safeStartDate = typeof validStartDate !== "undefined" ? validStartDate : new Date(GOLD_CUP.startDate.replace(/-/g, "/"));
        const safeEndDate = typeof endDate !== "undefined" ? endDate : new Date(safeStartDate.getTime() + GOLD_CUP.durationDays * 24 * 60 * 60 * 1000);

        // ==================================================
        // TRAITEMENT JOUEUR
        // ==================================================
        for (const playerDoc of playersSnap.docs) {
            const player = playerDoc.data();

            if (!player.brawlTag || !player.uid) {
                continue;
            }

            try { // Début du bloc try pour le joueur (Ligne critique)
                const uid = player.uid;
                const cleanTag = player.brawlTag.replace("#", "").toUpperCase();

                // ==================================================
                // BATTLELOG BRAWL STARS
                // ==================================================
                let response;
                try {
                    response = await fetch(
                        `https://api.brawlstars.com/v1/players/%23${cleanTag}/battlelog`,
                        {
                            headers: {
                                Authorization: `Bearer ${BRAWL_TOKEN}`
                            }
                        }
                    );
                } catch (networkError) {
                    console.error(`❌ Erreur réseau API Brawl Stars pour ${player.pseudo || uid}:`, networkError);
                    continue;
                }

                if (!response.ok) {
                    console.log(`⚠️ Battlelog inaccessible : ${player.pseudo || uid} (Statut ${response.status})`);
                    continue;
                }

                const data = await response.json();

                if (!data.items || !data.items.length) {
                    continue;
                }

                const joinedAt = player.joinedAt?.toDate ? player.joinedAt.toDate() : safeStartDate;
                const possibleMatches = [];

                for (const item of data.items) {
                    if (!item.battleTime) {
                        continue;
                    }

                    let battleDate;
                    if (typeof parseBrawlTime === "function") {
                        battleDate = parseBrawlTime(item.battleTime);
                    } else {
                        const t = item.battleTime;
                        battleDate = new Date(`${t.substring(0,4)}-${t.substring(4,6)}-${t.substring(6,8)}T${t.substring(9,11)}:${t.substring(11,13)}:${t.substring(13,15)}Z`);
                    }

                    if (battleDate < joinedAt || battleDate < safeStartDate || battleDate >= safeEndDate) {
                        continue;
                    }

                    const battle = item.battle || {};
                    const matchId = `${uid}_${item.battleTime}_${battle.mode || "mode"}_${battle.type || "type"}`;

                    if (goldCupMemory.matches.has(matchId)) {
                        continue;
                    }

                    possibleMatches.push({
                        item,
                        matchId,
                        battle: battle
                    });
                } 

                if (possibleMatches.length === 0) {
                    continue;
                }

                // ==================================================
                // 🔥 LECTURE HISTORIQUE FIRESTORE
                // ==================================================
                const countedMatchesRef = playerDoc.ref.collection("countedMatches");
                const existingSnap = await countedMatchesRef.get();
                const existingMatches = new Set();

                existingSnap.forEach(doc => {
                    existingMatches.add(doc.id);
                    goldCupMemory.matches.add(doc.id);
                }); 

                const batch = db.batch();
                let pointsToAdd = 0;
                let matchesAdded = 0;

                // ==================================================
                // TRAITEMENT ET COMPTABILISATION DES POINTS
                // ==================================================
                for (const match of possibleMatches) {
                    const item = match.item;
                    const matchId = match.matchId;

                    if (existingMatches.has(matchId)) {
                        goldCupMemory.matches.add(matchId);
                        continue;
                    }

                    const battle = match.battle || {};
                    let points = 0; 
                    let result = battle.result || null;
                    let rank = battle.rank ?? null;

                    // 🎮 CALCUL DES POINTS DE BASE
                    if (result === "victory") {
                        points = 3;
                    } else if (result === "defeat") {
                        points = 1;
                    } else if (rank !== null) {
                        points = (rank <= 4) ? 3 : 1;
                        result = `rank_${rank}`;
                    } else {
                        console.log("⚠️ Gold Cup game ignorée :", battle);
                        continue; 
                    }

                    // 🎮 MULTIPLICATEUR BRAWLER
                    const brawler = battle.brawler || null;
                    const brawlerName = brawler?.name || null;
                    const brawlerTrophies = Number(brawler?.trophies) || 0;

                    let multiplier = 1;
                    if (brawlerTrophies >= 1000) {
                        multiplier = 2;
                    } else if (brawlerTrophies >= 500) {
                        multiplier = 1.5;
                    }

                    // 💥 APPLICATION DU MULTIPLICATEUR
                    const basePoints = points;
                    points = basePoints * multiplier;

                    // 📝 LOG
                    console.log(
                        `🎮 GOLD CUP | ${player.pseudo || uid} | ${brawlerName || "Brawler inconnu"} | ` +
                        `${brawlerTrophies} trophées | x${multiplier} | ${basePoints} → ${points} points`
                    );

                    // Préparation de la sauvegarde Firestore
                    const matchRef = countedMatchesRef.doc(matchId);
                    batch.set(matchRef, {
                        battleTime: item.battleTime,
                        points: points,
                        basePoints: basePoints,
                        multiplier: multiplier,
                        brawler: brawlerName,
                        result: result,
                        countedAt: admin.firestore.FieldValue.serverTimestamp() // Ajustez selon votre require firebase-admin
                    });

                    pointsToAdd += points;
                    matchesAdded++;
                }

                // Si des matchs ont été comptabilisés, on valide le batch et on met à jour le profil du joueur
                if (matchesAdded > 0) {
                    await batch.commit();
                    await playerDoc.ref.update({
                        goldCupPoints: admin.firestore.FieldValue.increment(pointsToAdd),
                        totalMatches: admin.firestore.FieldValue.increment(matchesAdded)
                    });
                    console.log(`💾 Points sauvegardés pour ${player.pseudo || uid} : +${pointsToAdd} points (${matchesAdded} matchs)`);
                }

            } catch (playerError) { // Fin du bloc try principal du joueur
                console.error(`❌ Erreur lors du traitement du joueur ${player.pseudo || player.uid}:`, playerError);
            }
        }

    } catch (globalError) {
        console.error("❌ Erreur générale lors de la synchronisation Gold Cup :", globalError);
    } finally {
        goldCupMemory.syncing = false;
        console.log("🏁 SYNC GOLD CUP TERMINÉE");
    }
}

// ======================================================
// API ONLINE
// ======================================================
app.get("/", (req, res) => {
    res.send("Cash Arena API ONLINE ✅");
});


// ==========================================
// UTILS : NETTOYAGE DU TAG BRAWL STARS
// ==========================================
function cleanBrawlTag(tag) {
    return tag.replace("#", "").toUpperCase();
}

// ======================================================
// 🎮 MULTIPLICATEUR BRAWLER
// ======================================================

// Cache RAM des trophées des brawlers
// Évite de refaire une requête API à chaque game
const brawlerTrophiesCache = new Map();


// Récupère les trophées actuels de tous les brawlers
// d'un joueur et les garde en RAM pendant 5 minutes
async function getBrawlerTrophies(brawlTag) {

    const cleanTag =
        cleanBrawlTag(brawlTag);

    const cached =
        brawlerTrophiesCache.get(cleanTag);

    // Cache valable 5 minutes
    if (
        cached &&
        Date.now() - cached.timestamp < 5 * 60 * 1000
    ) {
        return cached.brawlers;
    }


    try {

        const response =
            await fetch(
                `https://api.brawlstars.com/v1/players/%23${cleanTag}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${BRAWL_TOKEN}`,

                        Accept:
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            console.error(
                "❌ Impossible de récupérer le profil Brawl Stars :",
                cleanTag
            );

            return {};

        }


        const data =
            await response.json();


        const brawlers = {};


        if (
            Array.isArray(data.brawlers)
        ) {

            for (
                const brawler of data.brawlers
            ) {

                if (
                    brawler.name
                ) {

                    brawlers[
                        brawler.name.toLowerCase()
                    ] =
                        Number(
                            brawler.trophies
                        ) || 0;

                }

            }

        }


        // Sauvegarde RAM
        brawlerTrophiesCache.set(
            cleanTag,
            {
                timestamp: Date.now(),
                brawlers
            }
        );


        return brawlers;

    }
    catch (error) {

        console.error(
            "❌ Erreur récupération trophées brawlers :",
            error
        );

        return {};

    }

}


// ======================================================
// 🎯 CALCUL DU MULTIPLICATEUR
// ======================================================

function getBrawlerPointMultiplier(
    trophies
) {

    const t =
        Number(trophies) || 0;


    // 1000+ trophées
    if (
        t >= 1000
    ) {

        return 2;

    }


    // 500 à 999 trophées
    if (
        t >= 500
    ) {

        return 1.5;

    }


    // Moins de 500
    return 1;

}

// ==========================================
// PLAYER PROFIL
// ==========================================
app.get("/api/brawl/player/:tag", async (req, res) => {
    try {
        const cleanTag = cleanBrawlTag(req.params.tag);

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

        return res.json(data);

    } catch (err) {
        console.error("❌ Erreur Player API :", err);
        return res.status(500).json({
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
        const cleanTag = cleanBrawlTag(req.params.tag);

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

        return res.json(data);

    } catch (err) {
        console.error("❌ Erreur Battlelog API :", err);
        return res.status(500).json({
            error: true,
            message: "Erreur API Battlelog"
        });
    }
});

// ======================================================
// SYNC BATTLELOGS OPTIMISÉ (ZÉRO LECTURE DE VÉRIFICATION)
// ======================================================

async function syncTournamentBattlelogs(tournamentId, isWeekly = false) {
console.log(`🔥 SYNC [${isWeekly ? 'WEEKLY' : 'DAILY'}] :`, tournamentId);

// 1. Choix du cache approprié
const cache = isWeekly ? weeklyPlayersCache : dailyPlayersCache;

// 2. Remplissage et mise à jour dynamique du cache depuis Firestore (Inclus les vrais joueurs)
console.log(`📥 Mise à jour du cache [${isWeekly ? 'WEEKLY' : 'DAILY'}] depuis Firestore...`);
try {
    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const playersSnap = await tournamentRef.collection("players").get();
    
    // On s'assure que le témoin d'initialisation des bots reste actif
    cache["__initialized__"] = true; 

    playersSnap.forEach(doc => {
        const data = doc.data();
        if (data.uid && data.brawlTag) {
            // Si le joueur n'est pas encore dans le cache RAM, on l'ajoute sans écraser le lastMatchTime des autres
            if (!cache[data.uid]) {
                cache[data.uid] = {
                    uid: data.uid,
                    brawlTag: data.brawlTag,
                    pseudo: data.pseudo || "Inconnu",
                    joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(),
                    lastMatchTime: data.lastMatchTime || null, 
                    refPath: doc.ref.path 
                };
                console.log(`✨ [RAM SYSTEM] Nouveau joueur humain détecté et ajouté au cache : ${data.pseudo || data.uid}`);
            }
        }
    });
} catch (cacheError) {
    console.error(`❌ Erreur lors de la mise à jour du cache Firestore :`, cacheError);
}

// 3. Boucle sur les joueurs du cache en RAM
for (const userId in cache) {
const player = cache[userId];
const playerDocRef = db.doc(player.refPath);
try {
    const cleanTag = player.brawlTag.replace("#", "").toUpperCase();
    const response = await fetch(
        `https://api.brawlstars.com/v1/players/%23${cleanTag}/battlelog`,
        { headers: { Authorization: `Bearer ${BRAWL_TOKEN}` } }
    );

    const data = await response.json();
    if (!data.items || data.items.length === 0) continue;
    
    // ======================================================
    // 🎮 TROPHÉES DES BRAWLERS DU JOUEUR
    // ======================================================

const brawlerTrophies = await getBrawlerTrophies(player.brawlTag);

let pointsToAdd = 0;
const batch = db.batch();
let newLastMatchTime = player.lastMatchTime;

// Inversion pour traiter du plus ancien au plus récent
const sortedItems = [...data.items].reverse(); 

for (const item of sortedItems) {
    const battle = item.battle || {};
    const battleDate = parseBrawlTime(item.battleTime);

    // Étape A : Ignore les matchs antérieurs à l'inscription au tournoi
    if (battleDate < player.joinedAt) continue;

    // Étape B : Vérification stricte du match par rapport au cache SPECIFIQUE de ce tournoi
    if (player.lastMatchTime && item.battleTime <= player.lastMatchTime) {
        continue;
    }

    let points = 0;
    let result = null;
    let rank = null;

    if (battle.result === "victory") {
        points = 3;
        result = "victory";
    } else if (battle.result === "defeat") {
        points = 1;
        result = "defeat";
    } else if (battle.rank !== undefined && battle.rank !== null) {
        rank = battle.rank;
        points = rank <= 4 ? 3 : 1;
        result = `rank_${rank}`;
    } else {
        continue;
    }

    // ======================================================
    // 🎮 EXTRACTION DU BRAWLER (CORRECTIF MULTIPLICATEUR) ✅
    // ======================================================
    let brawlerObj = null;
    const myTag = player.brawlTag.toUpperCase().replace("#", "");

    // 1. Cas des modes 3v3 (Recherche dans les équipes)
    if (battle.teams) {
        for (const team of battle.teams) {
            const me = team.find(p => p.tag.toUpperCase().replace("#", "") === myTag);
            if (me) {
                brawlerObj = me.brawler;
                break;
            }
        }
    } 
    // 2. Cas des modes Survivant (Recherche dans la liste des joueurs)
    else if (battle.players) {
        const me = battle.players.find(p => p.tag.toUpperCase().replace("#", "") === myTag);
        if (me) brawlerObj = me.brawler;
    }

    // Si l'API utilise l'ancienne structure ou une structure directe
    if (!brawlerObj) {
        brawlerObj = battle.brawler;
    }

    const brawlerName = brawlerObj?.name || null;
    let brawlerTrophyCount = 0;
    let multiplier = 1;

    if (brawlerName) {
        // Sécurité : Trouver la clé peu importe si votre fonction stocke en MAJUSCULE ou minuscule
        const trophiesList = brawlerTrophies || {};
        
        // On cherche d'abord en minuscules, sinon en MAJUSCULES (format API brut)
        brawlerTrophyCount = 
            Number(trophiesList[brawlerName.toLowerCase()]) || 
            Number(trophiesList[brawlerName.toUpperCase()]) || 
            0;

        multiplier = getBrawlerPointMultiplier(brawlerTrophyCount);
    }

    // ======================================================
    // 💥 APPLICATION DU MULTIPLICATEUR
    // ======================================================
    const basePoints = points;
    points = basePoints * multiplier;

    console.log(
        `🎮 ${player.pseudo} | ` +
        `${brawlerName || "Brawler inconnu"} | ` +
        `${brawlerTrophyCount} trophées | ` +
        `x${multiplier} | ` +
        `${basePoints} → ${points} points`
    );

    pointsToAdd += points;
    newLastMatchTime = item.battleTime; 

    // L'identifiant unique du match inclut le type de tournoi pour éviter les collisions d'historique
    const suffix = isWeekly ? "weekly" : "daily";
    const matchId = `${player.uid}_${item.battleTime}_${suffix}`;
    const countedRef = playerDocRef.collection("countedMatches").doc(matchId);
    
    batch.set(countedRef, {
        battleTime: item.battleTime,
        mode: battle.mode || null,
        type: battle.type || null,
        result,
        rank,
        points,
        brawler: brawlerName, // Optionnel : pour le suivi dans votre BDD
        multiplier: multiplier,
        countedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}


    // 4. Application des points si de nouveaux matchs valides existent
    if (pointsToAdd > 0) {
        // Mise à jour de la mémoire RAM locale du tournoi concerné
        player.lastMatchTime = newLastMatchTime;

        // Mise à jour du document Firestore (qui est propre au tournoi grâce à refPath)
        batch.update(playerDocRef, {
            points: admin.firestore.FieldValue.increment(pointsToAdd),
            lastMatchTime: newLastMatchTime, 
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log(`✅ [${isWeekly ? 'WEEKLY' : 'DAILY'}] ${player.pseudo} : +${pointsToAdd} points`);
    }

} catch (err) {
    console.error(`❌ Erreur joueur ${player.pseudo} dans [${isWeekly ? 'WEEKLY' : 'DAILY'}] :`, err);
}

}
console.log(`🏁 Sync terminée avec succès pour : ${tournamentId}`);


}

// ======================================================
// DISTRIBUTION DES RECOMPENSES LEAGUE OPTIMISÉE
// ======================================================
app.post("/api/tournaments/:tournamentId/give-rewards", async (req, res) => {
    try {
        const tournamentId = req.params.tournamentId;
        const tournamentRef = db.collection("tournaments").doc(tournamentId);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Tournoi introuvable"
            });
        }

        if (tournamentDoc.data().rewardsGiven) {
            return res.status(400).json({
                success: false,
                message: "Récompenses déjà distribuées"
            });
        }

        // ⚡ OPTIMISATION 1 : Limiter la récupération au nombre strict de récompenses disponibles (Top 10)
        const playersSnap = await tournamentRef
            .collection("players")
            .orderBy("points", "desc")
            .limit(rewards.length)
            .get();

        if (playersSnap.empty) {
            return res.status(400).json({
                success: false,
                message: "Aucun joueur dans ce tournoi"
            });
        }

        // Préparation des listes pour récupérer les utilisateurs en groupe
        const playersData = [];
        const userRefs = [];

        playersSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.uid) {
                playersData.push({ docRef: doc.ref, data });
                userRefs.push(db.collection("users").doc(data.uid));
            }
        });

        // ⚡ OPTIMISATION 2 : Récupérer TOUS les profils utilisateurs en 1 seule requête groupée au lieu d'une boucle
        const userDocs = userRefs.length > 0 ? await db.getAll(...userRefs) : [];
        const userDocsMap = new Map(userDocs.map(doc => [doc.id, doc]));

        const batch = db.batch();
        let position = 0;

        for (const playerItem of playersData) {
            if (position >= rewards.length) break;

            const player = playerItem.data;
            const userDoc = userDocsMap.get(player.uid);

            if (!userDoc || !userDoc.exists) {
                position++;
                continue;
            }

            const lp = rewards[position];
            const user = userDoc.data();
            const currentLP = user.leaguePoints || 0;
            const newLP = currentLP + lp;
            const newRank = getRank(newLP);

            // Mise à jour de l'utilisateur
            batch.update(userDoc.ref, {
                leaguePoints: newLP,
                leagueRank: newRank,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Ajout à l'historique de ligue
            const historyRef = userDoc.ref.collection("leagueHistory").doc();
            batch.set(historyRef, {
                tournamentId,
                position: position + 1,
                lp,
                oldLP: currentLP,
                newLP,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Validation de la récompense sur le joueur du tournoi
            batch.update(playerItem.docRef, {
                rewardGiven: true,
                reward: lp
            });

            console.log(`🏆 [League] N°${position + 1} : ${player.pseudo || player.uid} +${lp} LP`);
            position++;
        }

        // Clôture du tournoi
        batch.update(tournamentRef, {
            rewardsGiven: true,
            rewardsGivenAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        return res.json({
            success: true,
            message: "Récompenses distribuées avec succès"
        });

    } catch (err) {
        console.error("❌ Erreur distribution récompenses League :", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ======================================================
// CRON AUTOMATIQUE OPTIMISÉ (Toutes les 5 minutes)
// ======================================================

cron.schedule("*/5 * * * *", async () => {
    console.log("");
    console.log("==========================================");
    console.log("🔄 CRON CASH ARENA");
    console.log("==========================================");

    try {
        // ==========================================
        // DATE / HEURE ACTUELLE (Fuseau Europe/Paris)
        // ==========================================
        const now = new Date();

        const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
            timeZone: "Europe/Paris",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });

        const formattedParts = timeFormatter.formatToParts(now);
        const currentHour = Number(formattedParts.find(p => p.type === "hour").value);
        const currentMinute = Number(formattedParts.find(p => p.type === "minute").value);

        console.log(`🕐 Heure Paris : ${currentHour}h${String(currentMinute).padStart(2, "0")}`);

        // ID des tournois
        const currentDailyId = getDailyTournamentId();
        const previousDailyId = getPreviousDailyTournamentId();

        console.log("📅 Daily actuel :", currentDailyId);
        console.log("📅 Daily précédent :", previousDailyId);

        // ==========================================
        // 1️⃣ RECOMPENSES DU DAILY PRECEDENT
        // ==========================================
        // On traite les récompenses uniquement à partir de 19h30 à Paris.
        if (currentHour > 19 || (currentHour === 19 && currentMinute >= 30)) {
            console.log("🏆 Vérification récompenses Daily précédent...");

            const previousTournamentRef = db.collection("tournaments").doc(previousDailyId);
            const previousTournamentDoc = await previousTournamentRef.get();

            if (!previousTournamentDoc.exists) {
                console.log("⚠ Daily précédent introuvable dans Firestore :", previousDailyId);
            } else {
                const previousTournament = previousTournamentDoc.data();

                if (previousTournament.rewardsGiven === true) {
                    console.log("✅ Daily précédent déjà récompensé :", previousDailyId);
                } else {
                    console.log("🏆 Distribution des récompenses en cours :", previousDailyId);

                    try {
                        const rewardResponse = await fetch(
                            `http://127.0.0.1:${PORT}/api/daily/give-rewards`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" }
                            }
                        );

                        const rewardData = await rewardResponse.json();

                        if (!rewardResponse.ok || rewardData.error) {
                            console.error("❌ Erreur récompenses Daily :", rewardData.message || rewardData);
                        } else {
                            console.log("✅ Récompenses Daily distribuées !", rewardData);
                        }
                    } catch (rewardError) {
                        console.error("❌ Impossible de joindre l'API de distribution :", rewardError);
                    }
                }
            }
        }

        // ==========================================
        // 2️⃣ BOTS DU NOUVEAU DAILY ET WEEKLY
        // ==========================================
        console.log("🤖 Vérification des bots :", currentDailyId);
        try {
            await addBotsToDaily();
            console.log("✅ Vérification bots Daily terminée");
        } catch (botError) {
            console.error("❌ Erreur bots Daily :", botError);
        }

        console.log("🤖 Vérification des bots Weekly :", TOURNAMENT_ID);
        try {
            await addBotsToWeekly();
            console.log("✅ Vérification bots Weekly terminée");
        } catch (weeklyBotError) {
            console.error("❌ Erreur bots Weekly :", weeklyBotError);
        }

        // ==========================================
        // 3️⃣ SYNCHRONISATION WEEKLY (Utilise le cache RAM Weekly)
        // ==========================================
        console.log("🔄 Sync Weekly :", TOURNAMENT_ID);
        try {
            // Le second argument à true indique qu'on utilise 'weeklyPlayersCache'
            await syncTournamentBattlelogs(TOURNAMENT_ID, true);
            console.log("✅ Sync Weekly terminée");
        } catch (weeklyError) {
            console.error("❌ Erreur sync Weekly :", weeklyError);
        }

        // ==========================================
        // 4️⃣ SYNCHRONISATION DAILY (Utilise le cache RAM Daily)
        // ==========================================
        console.log("🔄 Sync Daily :", currentDailyId);
        try {
            // Par défaut ou mis à false, utilise 'dailyPlayersCache'
            await syncTournamentBattlelogs(currentDailyId, false);
            console.log("✅ Sync Daily terminée");
        } catch (dailyError) {
            console.error("❌ Erreur sync Daily :", dailyError);
        }

        // ==========================================
        // 🏆 1. GOLD CUP - SYNCHRONISATION DES LOGS (Sécurisé)
        // ==========================================
        console.log("🔥 Lancement de la synchronisation des combats Gold Cup...");
        try {
            await syncGoldCupBattlelogs();
            console.log("✅ Synchronisation Gold Cup terminée.");
        } catch (syncError) {
            console.error("❌ Erreur lors de la synchronisation Gold Cup :", syncError);
        }
        
        // ==========================================
        // 💰 2. GOLD CUP - DISTRIBUTION DES RÉCOMPENSES
        // ==========================================
        console.log("🏆 Vérification de la clôture et des récompenses Gold Cup...");
        try {
            await giveGoldCupRewards();
            console.log("✅ Vérification des récompenses Gold Cup terminée.");
        } catch (goldCupError) {
            console.error("❌ Erreur lors de la distribution Gold Cup :", goldCupError);
        }


        // ==========================================
        // FIN
        // ==========================================
        console.log("");
        console.log("==========================================");
        console.log("🏁 CRON TERMINÉ");
        console.log("==========================================");
        console.log("");

    } catch (error) {
        console.error("❌ ERREUR GENERALE CRON :", error);
    }
});


// ======================================================
// MAJ DES RANGS OPTIMISÉE (Sécurité uniquement)
// ======================================================

async function refreshLeagueRanks() {
    console.log("🏆 Vérification de sécurité des rangs (Profils modifiés uniquement)...");

    // On calcule l'heure qu'il était il y a 1h05
    const oneHourAgo = new Date(Date.now() - 65 * 60 * 1000);

    // ⚡ OPTIMISATION : Au lieu de lire TOUS les utilisateurs, 
    // on ne lit QUE ceux qui ont bougé récemment (grâce à updatedAt)
    const snapshot = await db
        .collection("users")
        .where("updatedAt", ">=", oneHourAgo)
        .get();

    if (snapshot.empty) {
        console.log("🏆 Aucun profil récemment modifié. 0 lecture inutile.");
        return;
    }

    const batch = db.batch();
    let updated = 0;
    let operationCount = 0;

    snapshot.forEach(doc => {
        const user = doc.data();
        const lp = user.leaguePoints || 0;
        const rank = getRank(lp);

        if (user.leagueRank !== rank) {
            batch.update(doc.ref, {
                leagueRank: rank,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            updated++;
            operationCount++;

            // Sécurité pour la limite des 500 opérations par batch de Firestore
            if (operationCount >= 400) {
                console.log("⚠️ Limite de batch presque atteinte, arrêt préventif pour cette heure.");
            }
        }
    });

    if (updated > 0) {
        await batch.commit();
    }

    console.log("🏆 Rangs corrigés avec succès :", updated);
}

// ======================================================
// Vérification toutes les heures
// ======================================================
cron.schedule("0 * * * *", async () => {
    try {
        await refreshLeagueRanks();
    } catch (err) {
        console.error("❌ Erreur lors du CRON de vérification des rangs :", err);
    }
});

// ======================================================
// LEAGUE UTILS (Optimisés et Sécurisés)
// ======================================================

function getCurrentLeague(lp) {
    // ⚡ Utilisation de .find() pour un code plus court et lisible
    const league = LEAGUE.find(l => lp >= l.min && lp <= l.max);
    return league || LEAGUE[LEAGUE.length - 1];
}

function getNextLeague(lp) {
    const currentIndex = LEAGUE.findIndex(l => lp >= l.min && lp <= l.max);
    
    // Si la ligue n'est pas trouvée ou si le joueur est déjà "Legend" (dernier palier)
    if (currentIndex === -1 || currentIndex === LEAGUE.length - 1) {
        return null;
    }
    
    return LEAGUE[currentIndex + 1];
}

function getProgress(lp) {
    const league = getCurrentLeague(lp);

    if (league.name === "Legend") {
        return {
            percent: 100,
            current: lp,
            target: lp,
            remaining: 0
        };
    }

    const currentInLeague = lp - league.min;
    const totalInLeague = league.max - league.min + 1;
    
    // Calcul sécurisé du pourcentage de progression
    const percent = totalInLeague > 0 
        ? Math.floor((currentInLeague / totalInLeague) * 100) 
        : 0;

    return {
        percent: Math.min(100, Math.max(0, percent)), // Sécurité pour rester entre 0 et 100%
        current: lp,
        target: league.max + 1,
        remaining: (league.max + 1) - lp
    };
}

// ======================================================
// API LEAGUE
// ======================================================

app.get("/api/league/:uid", async (req, res) => {
    try {
        const uid = req.params.uid;

        // 1 lecture légitime du profil utilisateur
        const doc = await db.collection("users").doc(uid).get();

        if (!doc.exists) {
            return res.status(404).json({
                error: true,
                message: "Utilisateur introuvable"
            });
        }

        const user = doc.data();
        const lp = user.leaguePoints || 0;

        // Calculs locaux en mémoire (RAM), coût Firestore = 0
        const league = getCurrentLeague(lp);
        const nextLeague = getNextLeague(lp);
        const progress = getProgress(lp);

        return res.json({
            success: true,
            league,
            nextLeague,
            progress,
            lp
        });

    } catch (err) {
        console.error("❌ Erreur API League :", err);
        return res.status(500).json({
            error: true,
            message: "Une erreur interne est survenue"
        });
    }
});

// ======================================================
// VARIABLES DE CACHE POUR LES CLASSEMENTS GENERAUX
// ======================================================
let cacheLegendLeaderboard = null;
let cacheLegendTimestamp = 0;

let cacheTopPlayer = null;
let cacheTopPlayerTimestamp = 0;

const CACHE_DURATION = 5 * 60 * 1000; // ⚡ 5 minutes en millisecondes

// ======================================================
// LEADERBOARD LEGEND OPTIMISÉ (CACHE MEMOIRE)
// ======================================================
app.get("/api/league/legend", async (req, res) => {
    try {
        const now = Date.now();

        // ⚡ Si le cache existe et a moins de 5 minutes, on le renvoie direct (0 lecture Firestore !)
        if (cacheLegendLeaderboard && (now - cacheLegendTimestamp < CACHE_DURATION)) {
            return res.json(cacheLegendLeaderboard);
        }

        // Sinon, on interroge Firestore (Une fois toutes les 5 minutes maximum)
        const snapshot = await db
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
                pseudo: data.pseudo || data.email || "Unknown",
                leaguePoints: data.leaguePoints || 0,
                leagueRank: data.leagueRank || "Legend",
                contentCreator: data.isContentCreator || false
            });
        });

        // On prépare la réponse
        const responseData = {
            success: true,
            total: players.length,
            players
        };

        // On sauvegarde dans notre Post-it mémoire (RAM)
        cacheLegendLeaderboard = responseData;
        cacheLegendTimestamp = now;

        return res.json(responseData);

    } catch (err) {
        console.error("❌ Erreur Leaderboard Legend :", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ======================================================
// TOP PLAYER OPTIMISÉ (CACHE MEMOIRE)
// ======================================================
app.get("/api/league/top", async (req, res) => {
    try {
        const now = Date.now();

        // ⚡ Utilisation du cache mémoire de 5 minutes
        if (cacheTopPlayer && (now - cacheTopPlayerTimestamp < CACHE_DURATION)) {
            return res.json(cacheTopPlayer);
        }

        const snapshot = await db
            .collection("users")
            .orderBy("leaguePoints", "desc")
            .limit(1)
            .get();

        if (snapshot.empty) {
            const emptyResponse = { success: true, player: null };
            cacheTopPlayer = emptyResponse;
            cacheTopPlayerTimestamp = now;
            return res.json(emptyResponse);
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        const responseData = {
            success: true,
            player: {
                uid: doc.id,
                pseudo: data.pseudo || data.email || "Unknown",
                leaguePoints: data.leaguePoints || 0,
                leagueRank: data.leagueRank || "Bronze"
            }
        };

        // Sauvegarde dans la RAM
        cacheTopPlayer = responseData;
        cacheTopPlayerTimestamp = now;

        return res.json(responseData);

    } catch (err) {
        console.error("❌ Erreur Top Player :", err);
        return res.status(500).json({
            success: false
        });
    }
});

// ======================================================
// INFOS LEAGUE
// ======================================================
app.get("/api/league/ranks", (req, res) => {
    return res.json({
        success: true,
        ranks: LEAGUE
    });
});

// ======================================================
// ⚡ CACHE GLOBAL POUR LES BOTS (RAM)
// ======================================================
let botsCache = null;

// ==========================================
// AJOUT AUTOMATIQUE DES BOTS AU DAILY 
// ==========================================
async function addBotsToDaily() {
try {
const dailyId = getDailyTournamentId();
console.log(`🤖 [RAM CHECK] Vérification des bots pour le Daily : ${dailyId}`);

const tournamentRef = db.collection("tournaments").doc(dailyId);

// 1. Chargement initial des profils de bots dans la RAM
if (!botsCache) {
    console.log("📥 Chargement initial des profils de bots dans la RAM...");
    const botsSnap = await db.collection("users").where("isBot", "==", true).get();
    botsCache = botsSnap.docs.map(doc => ({
        id: doc.id,
        ref: doc.ref,
        ...doc.data()
    }));
    console.log(`🤖 ${botsCache.length} profils de bots stockés en mémoire RAM.`);
}

if (botsCache.length === 0) return;

// CORRECTION A : Si le tournoi a changé, on nettoie les anciennes décisions de la veille en RAM
for (const bot of botsCache) {
    if (bot.dailyJoinDecisionTournament !== dailyId) {
        bot.dailyJoinDecision = null;
        bot.dailyJoinDecisionTournament = dailyId;
    }
}

// 2. Initialisation du cache des joueurs du tournoi s'il est vide
// CORRECTION B : On utilise une variable témoin ou on vérifie si le tournoi a changé pour éviter la boucle vide
if (Object.keys(dailyPlayersCache).length === 0) {
    console.log(`📥 Tentative de remplissage du cache pour le tournoi : ${dailyId}`);
    const activePlayersSnap = await tournamentRef.collection("players").get();
    
    // On initialise le cache pour qu'il existe (même s'il reste vide au début)
    dailyPlayersCache["__initialized__"] = true; 

    activePlayersSnap.forEach(doc => {
        const data = doc.data();
        if (data.uid && data.brawlTag) {
            dailyPlayersCache[data.uid] = {
                uid: data.uid,
                brawlTag: data.brawlTag,
                pseudo: data.pseudo || "Inconnu",
                joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(),
                lastMatchTime: data.lastMatchTime || null,
                refPath: doc.ref.path
            };
        }
    });
}

const batch = db.batch();
let added = 0;
let decisionsUpdates = 0;

const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);

// 3. Boucle sur nos bots en mémoire RAM
for (const bot of botsCache) {
    // Si le bot a déjà été validé à TRUE pour ce tournoi aujourd'hui, on ne fait rien
    if (bot.dailyJoinDecision === true) {
        continue;
    }

    // Si le bot a déjà tiré FALSE aujourd'hui, on passe (il a déjà joué sa chance pour ce daily)
    if (bot.dailyJoinDecision === false) {
        continue;
    }

    let chance = typeof bot.botJoinChance === "number" ? bot.botJoinChance : 100;
    chance = Math.max(0, Math.min(100, chance));

    // Nouveau tirage propre pour la journée
    const random = Math.random() * 100;
    const decision = random < chance;

    // On fige la décision en RAM
    bot.dailyJoinDecision = decision;

    // Sauvegarde de la décision dans Firestore (Écriture seule)
    batch.update(bot.ref, {
        dailyJoinDecision: decision,
        dailyJoinDecisionTournament: dailyId
    });
    decisionsUpdates++;

    // S'il perd le tirage, on s'arrête
    if (!decision) continue;

    // Si le bot est déjà marqué présent dans le cache, on évite le doublon
    if (dailyPlayersCache[bot.id]) {
        continue;
    }

    // Inscription du bot dans le tournoi Firestore
    const playerRef = tournamentRef.collection("players").doc(bot.id);
    const newBotPlayerData = {
        uid: bot.id,
        pseudo: bot.pseudo || `Bot ${bot.id.slice(0, 5)}`,
        email: bot.email || null,
        brawlTag: bot.brawlTag || null,
        points: 0,
        leagueRank: bot.leagueRank || "Bronze",
        leaguePoints: bot.leaguePoints || 0,
        isBot: true,
        isContentCreator: bot.isContentCreator || false,
        joinedAt: startOfToday
    };

    batch.set(playerRef, {
        ...newBotPlayerData,
        joinedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Ajout immédiat dans le cache RAM
    dailyPlayersCache[bot.id] = {
        uid: bot.id,
        brawlTag: bot.brawlTag,
        pseudo: newBotPlayerData.pseudo,
        joinedAt: startOfToday,
        lastMatchTime: null,
        refPath: playerRef.path
    };

    added++;
    console.log(`✅ Bot sélectionné et inscrit au Daily : ${bot.pseudo || bot.id}`);
}

if (added > 0 || decisionsUpdates > 0) {
    await batch.commit();
}

console.log(`🏁 Fin de la vérification : ${added} bots inscrits.`);

} catch (error) {
console.error("❌ Erreur addBotsToDaily :", error);
}

}

// ==========================================
// AJOUT AUTOMATIQUE DES BOTS AU WEEKLY (OPTIMISÉ)
// ==========================================
async function addBotsToWeekly() {
    try {
        const weeklyId = TOURNAMENT_ID;
        console.log(`🤖 [RAM CHECK] Vérification des bots pour le Weekly : ${weeklyId}`);

        const tournamentRef = db.collection("tournaments").doc(weeklyId);

        // 1. Chargement initial des profils de bots dans la RAM (Partagé ou dédié)
        if (!botsCache) {
            console.log("📥 Chargement initial des profils de bots dans la RAM...");
            const botsSnap = await db.collection("users").where("isBot", "==", true).get();
            botsCache = botsSnap.docs.map(doc => ({
                id: doc.id,
                ref: doc.ref,
                ...doc.data()
            }));
            console.log(`🤖 ${botsCache.length} profils de bots stockés en mémoire RAM.`);
        }

        if (botsCache.length === 0) return;

        // 2. Initialisation du cache des joueurs du tournoi Weekly s'il est vide
        if (Object.keys(weeklyPlayersCache).length === 0) {
            console.log("📥 Remplissage initial du cache [WEEKLY] depuis Firestore...");
            const activePlayersSnap = await tournamentRef.collection("players").get();
            activePlayersSnap.forEach(doc => {
                const data = doc.data();
                if (data.uid && data.brawlTag) {
                    weeklyPlayersCache[data.uid] = {
                        uid: data.uid,
                        brawlTag: data.brawlTag,
                        pseudo: data.pseudo || "Inconnu",
                        joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(),
                        lastMatchTime: data.lastMatchTime || null,
                        refPath: doc.ref.path
                    };
                }
            });
            console.log(`👥 Cache [WEEKLY] initialisé avec ${Object.keys(weeklyPlayersCache).length} joueurs.`);
        }

        const batch = db.batch();
        let added = 0;
        let decisionsUpdates = 0;

        // CORRECTION TEMPORELLE : Définir la date au début de la semaine en cours (Lundi à 00h00)
        const startOfWeek = new Date();
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Ajustement pour caler au Lundi
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        // 3. Boucle sur nos bots en mémoire RAM
        for (const bot of botsCache) {
            // CORRECTION ACCÈS : Si le bot a déjà été validé à TRUE pour ce Weekly, on passe
            if (bot.weeklyJoinDecisionTournament === weeklyId && bot.weeklyJoinDecision === true) {
                continue;
            }

            let chance = typeof bot.botJoinChance === "number" ? bot.botJoinChance : 100;
            chance = Math.max(0, Math.min(100, chance));

            // Nouveau tirage hebdomadaire
            const random = Math.random() * 100;
            const decision = random < chance;

            // Mise à jour de l'état de décision spécifique au Weekly dans la RAM
            bot.weeklyJoinDecision = decision;
            bot.weeklyJoinDecisionTournament = weeklyId;

            // Préparation de la sauvegarde de sécurité dans Firestore
            batch.update(bot.ref, {
                weeklyJoinDecision: decision,
                weeklyJoinDecisionTournament: weeklyId
            });
            decisionsUpdates++;

            // Si le tirage échoue, le bot retentera sa chance au prochain cycle
            if (!decision) continue;

            // Si le bot est déjà enregistré dans le tournoi Weekly, on évite le doublon
            if (weeklyPlayersCache[bot.id]) {
                continue;
            }

            // Ajout du bot dans le sous-recueil des joueurs du tournoi Weekly (Firestore)
            const playerRef = tournamentRef.collection("players").doc(bot.id);
            const newBotPlayerData = {
                uid: bot.id,
                pseudo: bot.pseudo || `Bot ${bot.id.slice(0, 5)}`,
                email: bot.email || null,
                brawlTag: bot.brawlTag || null,
                points: 0,
                leagueRank: bot.leagueRank || "Bronze",
                leaguePoints: bot.leaguePoints || 0,
                isBot: true,
                isContentCreator: bot.isContentCreator || false,
                joinedAt: startOfWeek // Date locale calée au début de la semaine pour le cache RAM
            };

            batch.set(playerRef, {
                ...newBotPlayerData,
                joinedAt: admin.firestore.FieldValue.serverTimestamp() // Timestamp serveur Firestore
            });

            // ⚡ ENREGISTREMENT RAM : Ajout immédiat au cache Weekly avec la date débloquée
            weeklyPlayersCache[bot.id] = {
                uid: bot.id,
                brawlTag: bot.brawlTag,
                pseudo: newBotPlayerData.pseudo,
                joinedAt: startOfWeek, // Permet d'accepter tous les matchs de la semaine en cours
                lastMatchTime: null,
                refPath: playerRef.path
            };

            added++;
            console.log(`✅ Bot qualifié et ajouté au Weekly : ${bot.pseudo || bot.id}`);
        }

        // Exécution globale des écritures s'il y a des modifications
        if (added > 0 || decisionsUpdates > 0) {
            await batch.commit();
        }
        
        console.log(`🏁 Fin de la vérification hebdomadaire : ${added} nouveaux bots inscrits.`);

    } catch (error) {
        console.error("❌ Erreur addBotsToWeekly :", error);
    }
}


// ======================================================
// DÉMARRAGE SERVEUR AVEC PRÉ-CHARGEMENT DU CACHE
// ======================================================

app.listen(PORT, async () => {
    console.log("");
    console.log("======================================");
    console.log("🚀 CASH ARENA API");
    console.log("======================================");
    console.log(`✅ Serveur lancé sur le port ${PORT}`);
    console.log(`🏆 Weekly : ${TOURNAMENT_ID}`);
    
    const initialDailyId = getDailyTournamentId();
    console.log(`📅 Daily : ${initialDailyId}`);
    console.log("🔥 Battlelogs : ACTIVÉS");
    console.log("🏅 League : ACTIVÉE");
    console.log("======================================");

    // ⚡ INITIALISATION DU CACHE AU DÉMARRAGE
    // Permet de consommer le strict minimum de lectures dès le premier cycle du CRON
    try {
        console.log("⚡ [RAM SYSTEM] Pré-remplissage des caches joueurs au démarrage...");
        
        // Remplissage du cache Daily
        const dailyPlayersSnap = await db.collection("tournaments").doc(initialDailyId).collection("players").get();
        dailyPlayersSnap.forEach(doc => {
            const data = doc.data();
            if (data.uid && data.brawlTag) {
                dailyPlayersCache[data.uid] = {
                    uid: data.uid,
                    brawlTag: data.brawlTag,
                    pseudo: data.pseudo || "Inconnu",
                    joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(),
                    lastMatchTime: data.lastMatchTime || null,
                    refPath: doc.ref.path
                };
            }
        });

        // Remplissage du cache Weekly
        const weeklyPlayersSnap = await db.collection("tournaments").doc(TOURNAMENT_ID).collection("players").get();
        weeklyPlayersSnap.forEach(doc => {
            const data = doc.data();
            if (data.uid && data.brawlTag) {
                weeklyPlayersCache[data.uid] = {
                    uid: data.uid,
                    brawlTag: data.brawlTag,
                    pseudo: data.pseudo || "Inconnu",
                    joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(),
                    lastMatchTime: data.lastMatchTime || null,
                    refPath: doc.ref.path
                };
            }
        });

        console.log(`✅ Caches initialisés : ${Object.keys(dailyPlayersCache).length} joueurs Daily | ${Object.keys(weeklyPlayersCache).length} joueurs Weekly chargé(s).`);
        console.log("======================================");
        console.log("");
    } catch (cacheError) {
        console.error("⚠️ Impossible de pré-remplir les caches au démarrage :", cacheError.message);
        console.log("======================================");
        console.log("");
    }
});

// ======================================================
// GESTION DES ERREURS CRITIQUES (Sécurisé)
// ======================================================

process.on("uncaughtException", (err) => {
    console.error("");
    console.error("======================================");
    console.error("❌ UNCAUGHT EXCEPTION (Le serveur a évité un crash)");
    console.error(err);
    console.error("======================================");
    console.error("");
});

process.on("unhandledRejection", (reason) => {
    console.error("");
    console.error("======================================");
    console.error("❌ UNHANDLED REJECTION (Promesse non interceptée)");
    console.error(reason);
    console.error("======================================");
    console.error("");
});

// ======================================================
// ARRÊT PROPRE
// ======================================================

process.on("SIGINT", () => {
    console.log("");
    console.log("🛑 Arrêt du serveur (SIGINT)...");
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("");
    console.log("🛑 Serveur arrêté proprement (SIGTERM).");
    process.exit(0);
});
