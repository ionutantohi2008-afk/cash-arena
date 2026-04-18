auth.onAuthStateChanged(async user => {
  if(!user){
    window.location = "index.html";
    return;
  }

  document.getElementById("userEmail").innerText = user.email;

  const doc = await db.collection("users").doc(user.uid).get();

  document.getElementById("balance").innerText =
    "💰 Solde : " + doc.data().balance + "€";
});

function logout(){
  auth.signOut().then(() => window.location = "index.html");
}

// TOURNOIS
const tournaments = [
  {id:"brawl", name:"Brawl Stars Test", prize:0},
];

const container = document.getElementById("classement");

if (!container) {
  console.error("❌ #classement introuvable dans le HTML");
}

tournaments.forEach(t => {
  container.innerHTML += `
    <div class="card">
      <h3>${t.name}</h3>
      <p>${t.prize}€</p>
      <button onclick="joinTournament('${t.id}', '${t.name}')">
        Rejoindre
      </button>
    </div>
  `;
});

async function joinTournament(id, name){
  const user = auth.currentUser;

  if(!user){
    alert("Connecte-toi !");
    return;
  }

  const ref = db.collection("tournaments")
    .doc(id)
    .collection("players")
    .doc(user.uid);

  const doc = await ref.get();

  if(doc.exists){
    alert("Déjà inscrit !");
    return;
  }

  await ref.set({
    email: user.email,
    joinedAt: new Date()
  });

  alert("Inscrit à " + name);

  document.querySelector(".tournament-card").style.display = "none";
  document.getElementById("classement").style.display = "block";

  loadBrawlPlayers();
}

function showClassement(){
  document.querySelector(".tournament-card").style.display = "none";
  document.getElementById("classement").style.display = "block";
  loadBrawlPlayers();
}

async function loadBrawlPlayers(){
  const table = document.getElementById("brawlTable");

  const snapshot = await db
    .collection("tournaments")
    .doc("brawl")
    .collection("players")
    .get();

  table.innerHTML = "";

  let pos = 1;

  snapshot.forEach(doc => {
    table.innerHTML += `
      <tr>
        <td>${pos++}</td>
        <td>${doc.data().email}</td>
        <td>0</td>
      </tr>
    `;
  });
}

