// LOGIN
function login(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(() => window.location = "profile.html")
    .catch(e => alert(e.message));
}

// REGISTER
function register(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  auth.createUserWithEmailAndPassword(email, password)
    .then(user => {
      return db.collection("users").doc(user.user.uid).set({
        email: email,
        balance: 0
      });
    })
    .then(() => window.location = "profile.html")
    .catch(e => alert(e.message));
    
}function join(){
  alert("Inscription au tournoi confirmée !");
}
function goLogin(){
  window.location = "login.html";
}

function goRegister(){
  window.location = "register.html";
}