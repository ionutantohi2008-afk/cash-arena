const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const BRAWL_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiIsImtpZCI6IjI4YTMxOGY3LTAwMDAtYTFlYi03ZmExLTJjNzQzM2M2Y2NhNSJ9.eyJpc3MiOiJzdXBlcmNlbGwiLCJhdWQiOiJzdXBlcmNlbGw6Z2FtZWFwaSIsImp0aSI6ImUxZDg4OGRjLWZmZWMtNGY3OC1iNTlhLTRhMGJkMGJkYzE5MiIsImlhdCI6MTc3NjcxMDEyNywic3ViIjoiZGV2ZWxvcGVyL2E3Y2Y3NTE4LTBiNGYtYmFkMi0xYzE4LWQ1MmI3OWExOGZmOSIsInNjb3BlcyI6WyJicmF3bHN0YXJzIl0sImxpbWl0cyI6W3sidGllciI6ImRldmVsb3Blci9zaWx2ZXIiLCJ0eXBlIjoidGhyb3R0bGluZyJ9LHsiY2lkcnMiOlsiMTUxLjYxLjIwMS4yMjciXSwidHlwZSI6ImNsaWVudCJ9XX0.6YryYvxDs0FP5pneymumu30SFZBtsxQ5pkVJLGmpA-1Ec9XkfUhifQCzExFsYUmJMeooaQiiScdppTlu6FjMxQ";

app.get("/", (req, res) => {
  res.send("Serveur actif");
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

    console.log("STATUS:", response.status);
    console.log("REPONSE API:", data);

    if (!response.ok) {
      return res.status(response.status).json({
        error: true,
        message: data.message || "Erreur API Brawl Stars",
        details: data
      });
    }

    res.json(data);
  } catch (e) {
    console.error("ERREUR SERVEUR:", e);
    res.status(500).json({
      error: true,
      message: "Erreur serveur"
    });
  }
});

app.listen(3000, () => {
  console.log("Serveur démarré sur http://localhost:3000");
});