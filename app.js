// USER
const user = { email: "player@casharena.com" };

document.getElementById("userEmail").innerText =
  "👤 " + user.email;

function logout(){
  alert("Déconnecté de Cash Arena !");
}

// TOURNOIS
const tournaments = [
  {
    name:"Fortnite Elite Cup",
    prize:500,
    img:"https://images.unsplash.com/photo-1605902711622-cfb43c44367f"
  },
  {
    name:"Warzone Kill Race",
    prize:300,
    img:"https://images.unsplash.com/photo-1511512578047-dfb367046420"
  },
  {
    name:"Rocket League Clash",
    prize:200,
    img:"https://images.unsplash.com/photo-1542751371-adc38448a05e"
  }
];

const container = document.getElementById("tournaments");

tournaments.forEach(t => {
  container.innerHTML += `
    <div class="card">
      <img src="${t.img}">
      <h3>${t.name}</h3>
      <p>💰 ${t.prize}€</p>
      <button onclick="join('${t.name}')">Rejoindre</button>
    </div>
  `;
});

function join(name){
  alert("🔥 Inscription réussie au tournoi : " + name);
}