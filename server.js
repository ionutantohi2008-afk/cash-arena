const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BRAWL_TOKEN = process.env.BRAWL_TOKEN;

// Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.get("/", (req, res) => {
  res.send("Serveur Cash Arena actif ✅");
});

app.get("/api/brawl/player/:tag", async (req, res) => {
  try {
    const rawTag = req.params.tag || "";
    const cleanTag = rawTag.replace("#", "").toUpperCase();
    const finalTag = "%23" + cleanTag;

    const response = await fetch(`https://api.brawlstars.com/v1/players/${finalTag}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${BRAWL_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: true,
        message: data.message || "Erreur API Brawl Stars",
        details: data
      });
    }

    res.json(data);
  } catch (e) {
    console.error("ERREUR BRAWL:", e);
    res.status(500).json({ error: true, message: "Erreur serveur" });
  }
});

// Donner les récompenses une seule fois
app.post("/api/tournaments/:tournamentId/give-rewards", async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const playersRef = tournamentRef.collection("players");

    await db.runTransaction(async transaction => {
      const tournamentDoc = await transaction.get(tournamentRef);

      if (tournamentDoc.exists && tournamentDoc.data().rewardsGiven === true) {
        throw new Error("REWARDS_ALREADY_GIVEN");
      }

      const playersSnap = await transaction.get(playersRef);

      const players = [];
      playersSnap.forEach(doc => {
        players.push({
          id: doc.id,
          ...doc.data()
        });
      });

      players.sort((a, b) => (b.points || 0) - (a.points || 0));

      const rewards = [1.00, 0.50, 0.25, 0.25];

      players.slice(0, 4).forEach((player, index) => {
        const reward = rewards[index];

        if (!player.uid) return;

        const userRef = db.collection("users").doc(player.uid);

      transaction.update(userRef, {
      balance: admin.firestore.FieldValue.increment(reward)
    });

      // Historique des gains
      const gainRef = db.collection("users")
      .doc(player.uid)
      .collection("rewards")
      .doc();

      transaction.set(gainRef, {
      amount: reward,
      tournamentId,
      pseudo: player.pseudo || player.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

        const playerRef = playersRef.doc(player.id);
        transaction.update(playerRef, {
          reward: reward,
          rewardGiven: true
        });
      });

      transaction.set(tournamentRef, {
        rewardsGiven: true,
        rewardsGivenAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    res.json({
      success: true,
      message: "Récompenses distribuées ✅"
    });

  } catch (e) {
    if (e.message === "REWARDS_ALREADY_GIVEN") {
      return res.status(400).json({
        error: true,
        message: "Les récompenses ont déjà été distribuées."
      });
    }

    console.error("ERREUR REWARDS:", e);
    res.status(500).json({
      error: true,
      message: "Erreur distribution récompenses"
    });
  }
});

app.get("/api/brawl/player/:tag/battlelog", async (req, res) => {
  try {
    const rawTag = req.params.tag || "";
    const cleanTag = rawTag.replace("#", "").toUpperCase();
    const finalTag = "%23" + cleanTag;

    const response = await fetch(`https://api.brawlstars.com/v1/players/${finalTag}/battlelog`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${BRAWL_TOKEN}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: true,
        message: data.message || "Erreur Battlelog",
        details: data
      });
    }

    res.json(data);
  } catch (e) {
    console.error("ERREUR BATTLELOG:", e);
    res.status(500).json({
      error: true,
      message: "Erreur serveur battlelog"
    });
  }
});

app.get("/api/tournaments/:tournamentId/sync-battlelogs", async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({
        error: true,
        message: "Tournoi introuvable"
      });
    }

    const tournamentData = tournamentDoc.data();

    const startDate = tournamentData.startDate?.toDate
      ? tournamentData.startDate.toDate()
      : new Date("2026-05-04T19:30:00");

    const playersSnap = await tournamentRef.collection("players").get();

    let updatedPlayers = 0;
    let countedMatches = 0;

    for (const playerDoc of playersSnap.docs) {
      const player = playerDoc.data();

      if (!player.brawlTag || !player.uid) continue;

      const cleanTag = player.brawlTag.replace("#", "").toUpperCase();
      const finalTag = "%23" + cleanTag;

      const response = await fetch(`https://api.brawlstars.com/v1/players/${finalTag}/battlelog`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${BRAWL_TOKEN}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.items) {
        console.log("Erreur battlelog:", player.brawlTag, data);
        continue;
      }

      let pointsToAdd = 0;
      let newMatches = [];

      for (const item of data.items) {
        const battleDate = parseBrawlTime(item.battleTime);

        let playerJoinedAt = player.joinedAt?.toDate
         ? player.joinedAt.toDate()
         : startDate;

        if (battleDate < playerJoinedAt) continue;

        const matchId = `${item.battleTime}_${item.event?.id || "event"}_${item.battle?.mode || "mode"}`;

        const countedRef = playerDoc.ref.collection("countedMatches").doc(matchId);
        const countedDoc = await countedRef.get();

        if (countedDoc.exists) continue;

        const result = item.battle?.result;

        let points = 0;

        if (result === "victory") points = 3;
        else if (result === "defeat") points = 1;
        else continue;

        pointsToAdd += points;

        newMatches.push({
          ref: countedRef,
          data: {
            matchId,
            battleTime: item.battleTime,
            result,
            points,
            countedAt: admin.firestore.FieldValue.serverTimestamp()
          }
        });
      }

      if (newMatches.length > 0) {
        const batch = db.batch();

        newMatches.forEach(match => {
          batch.set(match.ref, match.data);
        });

        batch.update(playerDoc.ref, {
          points: admin.firestore.FieldValue.increment(pointsToAdd),
          pointsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        updatedPlayers++;
        countedMatches += newMatches.length;
      }
    }

    res.json({
      success: true,
      updatedPlayers,
      countedMatches
    });

  } catch (e) {
    console.error("ERREUR SYNC BATTLELOGS:", e);
    res.status(500).json({
      error: true,
      message: "Erreur sync battlelogs"
    });
  }
});

function parseBrawlTime(battleTime) {
  const year = battleTime.slice(0, 4);
  const month = battleTime.slice(4, 6);
  const day = battleTime.slice(6, 8);
  const hour = battleTime.slice(9, 11);
  const minute = battleTime.slice(11, 13);
  const second = battleTime.slice(13, 15);

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

app.get("/api/tournaments/:tournamentId/update-bots", async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const playersRef = db.collection("tournaments")
      .doc(tournamentId)
      .collection("players");

    const snapshot = await playersRef
      .where("isBot", "==", true)
      .get();

    const batch = db.batch();

    snapshot.forEach(doc => {
      const randomPoints = Math.floor(Math.random() * 13) + 3; // 3 à 15

      batch.update(doc.ref, {
        points: admin.firestore.FieldValue.increment(randomPoints),
        pointsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    res.json({
      success: true,
      botsUpdated: snapshot.size
    });

  } catch (e) {
    console.error("ERREUR BOTS:", e);
    res.status(500).json({
      error: true,
      message: "Erreur update bots"
    });
  }
});


app.get("/api/create-bots", async (req, res) => {
  try {

    const bots = [
      "ShadowZ",
      "Lxstyy",
      "HugoFN",
      "Kryzo",
      "NovaX",
      "Enzey",
      "Skyll",
      "RazeK",
      "Vortex",
    ];

    const batch = db.batch();

    bots.forEach((name, index) => {

      const ref = db.collection("tournaments")
        .doc("brawl-2")
        .collection("players")
        .doc(`bot_${index + 1}`);

      batch.set(ref, {
        uid: `bot_${index + 1}`,

        pseudo: name,

        points: Math.floor(Math.random() * 120),

        brawlName: name,

        brawlTrophies:
          Math.floor(Math.random() * 45000) + 5000,

        isBot: true,

        joinedAt:
          admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    res.json({
      success: true,
      message: "Bots créés ✅"
    });

  } catch (e) {

    console.error(e);

    res.status(500).json({
      error: true
    });
  }
});
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});
