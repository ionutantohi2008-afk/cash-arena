const translations = {

  fr: {
    navHome: "Accueil",
    navTournaments: "Tournois",
    navLeague: "League",

    heroBadge: "⚡ Plateforme de tournois compétitifs",

    heroSub:
      "Participez à des tournois compétitifs, grimpez dans le classement et remportez de l'argent réel grâce à vos performances.",

    btnTournaments:
      "🏆 Voir les tournois",

    btnLeague:
      "League →"
  },

  en: {
    navHome: "Home",
    navTournaments: "Tournaments",
    navLeague: "League",

    heroBadge:
      "⚡ Competitive tournament platform",

    heroSub:
      "Participate in competitive tournaments, climb the leaderboard and win real money through your performances.",

    btnTournaments:
      "🏆 View tournaments",

    btnLeague:
      "League →"
  },

  es: {
    navHome: "Inicio",
    navTournaments: "Torneos",
    navLeague: "Liga",

    heroBadge:
      "⚡ Plataforma de torneos competitivos",

    heroSub:
      "Participa en torneos competitivos, escala en la clasificación y gana dinero real gracias a tu rendimiento.",

    btnTournaments:
      "🏆 Ver torneos",

    btnLeague:
      "Liga →"
  }
};

function applyLanguage(lang) {

  const t = translations[lang];

  if (!t) return;

  document.getElementById("navHome").textContent =
    t.navHome;

  document.getElementById("navTournaments").textContent =
    t.navTournaments;

  document.getElementById("navLeague").textContent =
    t.navLeague;

  document.getElementById("heroBadge").textContent =
    t.heroBadge;

  document.getElementById("heroSub").textContent =
    t.heroSub;

  document.getElementById("btnTournaments").textContent =
    t.btnTournaments;

  document.getElementById("btnLeague").textContent =
    t.btnLeague;
 
  document.getElementById("howTitle").textContent = t.howTitle;
document.getElementById("howSubtitle").textContent = t.howSubtitle;

document.getElementById("step1Title").textContent = t.step1Title;
document.getElementById("step1Desc").textContent = t.step1Desc;

document.getElementById("step2Title").textContent = t.step2Title;
document.getElementById("step2Desc").textContent = t.step2Desc;

document.getElementById("step3Title").textContent = t.step3Title;
document.getElementById("step3Desc").textContent = t.step3Desc;

document.getElementById("step4Title").textContent = t.step4Title;
document.getElementById("step4Desc").textContent = t.step4Desc;

document.getElementById("featuresTitle").innerHTML =
  t.featuresTitle;

document.getElementById("featuresSubtitle").textContent =
  t.featuresSubtitle;

document.getElementById("feature1Title").textContent =
  t.feature1Title;
document.getElementById("feature1Desc").textContent =
  t.feature1Desc;

document.getElementById("feature2Title").textContent =
  t.feature2Title;
document.getElementById("feature2Desc").textContent =
  t.feature2Desc;

document.getElementById("feature3Title").textContent =
  t.feature3Title;
document.getElementById("feature3Desc").textContent =
  t.feature3Desc;

document.getElementById("feature4Title").textContent =
  t.feature4Title;
document.getElementById("feature4Desc").textContent =
  t.feature4Desc;

document.getElementById("feature5Title").textContent =
  t.feature5Title;
document.getElementById("feature5Desc").textContent =
  t.feature5Desc;

document.getElementById("feature6Title").textContent =
  t.feature6Title;
document.getElementById("feature6Desc").textContent =
  t.feature6Desc;

document.getElementById("gamesBadge").textContent =
  t.gamesBadge;

document.getElementById("gamesTitle").textContent =
  t.gamesTitle;

document.getElementById("gamesSubtitle").innerHTML =
  t.gamesSubtitle;

document.getElementById("availableNow").textContent =
  t.availableNow;

document.getElementById("comingSoon").textContent =
  t.comingSoon;

document.getElementById("brawlStatus").textContent =
  t.available;

document.getElementById("rocketStatus").textContent =
  t.soon;

document.getElementById("fortniteStatus").textContent =
  t.soon;

document.getElementById("lolStatus").textContent =
  t.soon;

document.getElementById("valorantStatus").textContent =
  t.soon;

document.getElementById("codStatus").textContent =
  t.soon;
}