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
  {name:"Fortnite Elite", prize:500},
  {name:"Warzone Pro", prize:300},
];

const container = document.getElementById("tournaments");

tournaments.forEach(t => {
  container.innerHTML += `
    <div class="card">
      <h3>${t.name}</h3>
      <p>${t.prize}€</p>
      <button onclick="join('${t.name}', ${t.prize})">Join</button>
    </div>
  `;
});

function join(name, prize){
  alert("Inscrit à " + name);
}