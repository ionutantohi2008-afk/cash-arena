auth.onAuthStateChanged(async user => {
  if(!user){
    window.location = "index.html";
    return;
  }

  document.getElementById("userEmail").innerText = user.email;

  const doc = await db.collection("users").doc(user.uid).get();
  document.getElementById("balance").innerHTML =
    "💰 Solde : " + doc.data().balance + "€";
});

// LOGOUT
function logout(){
  auth.signOut().then(() => window.location = "index.html");
}

// TOURNOIS
const tournaments = [
  {id:"brawl", name:"Brawl Stars Test", prize:0},
];

const container = document.getElementById("tournaments");

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

function joinTournament(id, name){
  const user = auth.currentUser;

  if(!user){
    alert("Connecte-toi !");
    return;
  }

  db.collection("tournaments")
    .doc(id)
    .collection("players")
    .doc(user.uid)
    .set({
      email: user.email,
      joinedAt: new Date()
    })
    .then(() => {
      alert("Inscrit au tournoi " + name + " !");
    })
    .catch(e => alert(e.message));
}

async function loadBrawlPlayers(){
  const list = document.getElementById("brawlPlayers");

  const snapshot = await db
    .collection("tournaments")
    .doc("brawl")
    .collection("players")
    .get();

  list.innerHTML = "";

  snapshot.forEach(doc => {
    const li = document.createElement("li");
    li.textContent = doc.data().email;
    list.appendChild(li);
  });
}

// Date du tournoi : lundi 4 mai à 20h (modifiable)
const startTime = new Date("May 4, 2026 20:00:00").getTime();

function updateTimer(){
  const now = new Date().getTime();
  const distance = startTime - now;

  if(distance <= 0){
    document.getElementById("timer").innerText = "Le tournoi a commencé !";
    return;
  }

  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  document.getElementById("timer").innerText =
    "Début dans : " + minutes + "m " + seconds + "s";
}

// update chaque seconde
setInterval(updateTimer, 1000);