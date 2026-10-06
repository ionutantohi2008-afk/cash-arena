/* =========================================================
   CASH ARENA — GAME SELECTOR
   Gestion du jeu actuellement sélectionné
   ========================================================= */

const GAMES = {
    brawlstars: {
        id: "brawlstars",
        name: "Brawl Stars",
        shortName: "BRAWL STARS",
        logo: "brawl-stars.png"
    },

    fortnite: {
        id: "fortnite",
        name: "Fortnite",
        shortName: "FORTNITE",
        logo: "fortnite.png"
    }
};


/* =========================================================
   JEU PAR DÉFAUT
   ========================================================= */

const DEFAULT_GAME = "brawlstars";

const GAME_STORAGE_KEY = "cashArenaSelectedGame";


/* =========================================================
   RÉCUPÉRER LE JEU ACTUEL
   ========================================================= */

function getSelectedGame() {

    const savedGame = localStorage.getItem(GAME_STORAGE_KEY);

    if (savedGame && GAMES[savedGame]) {
        return savedGame;
    }

    return DEFAULT_GAME;
}


/* =========================================================
   CHANGER DE JEU
   ========================================================= */

function setSelectedGame(gameId) {

    if (!GAMES[gameId]) {
        console.warn("Jeu inconnu :", gameId);
        return;
    }

    localStorage.setItem(GAME_STORAGE_KEY, gameId);

    updateGameSelector();

    /*
       Recharge la page pour que toutes les données
       soient immédiatement adaptées au nouveau jeu.
    */
    window.location.reload();
}


/* =========================================================
   INFORMATIONS DU JEU
   ========================================================= */

function getCurrentGame() {
    return GAMES[getSelectedGame()];
}


/* =========================================================
   CRÉER LE SÉLECTEUR
   ========================================================= */

function createGameSelector() {

    const nav = document.querySelector(".navbar");

    if (!nav) {
        return;
    }

    /*
       Évite de créer le sélecteur plusieurs fois.
    */
    if (document.getElementById("cashArenaGameSelector")) {
        return;
    }

    const currentGame = getCurrentGame();

    const selector = document.createElement("div");

    selector.id = "cashArenaGameSelector";
    selector.className = "game-selector";

    selector.innerHTML = `
        <button
            type="button"
            class="game-selector-button"
            id="gameSelectorButton"
        >
            <span class="game-selector-icon">
                🎮
            </span>

            <span
                class="game-selector-name"
                id="gameSelectorName"
            >
                ${currentGame.name}
            </span>

            <span class="game-selector-arrow">
                ▼
            </span>
        </button>

        <div
            class="game-selector-menu"
            id="gameSelectorMenu"
        >

            <button
                type="button"
                class="game-option"
                data-game="brawlstars"
            >
                <span class="game-option-icon">
                    🟦
                </span>

                <span class="game-option-text">
                    <strong>Brawl Stars</strong>
                    <small>League • Teams • Tournois</small>
                </span>

                <span
                    class="game-option-check"
                    data-check="brawlstars"
                >
                    ✓
                </span>
            </button>


            <button
                type="button"
                class="game-option"
                data-game="fortnite"
            >
                <span class="game-option-icon">
                    🟪
                </span>

                <span class="game-option-text">
                    <strong>Fortnite</strong>
                    <small>League • Teams • Tournois</small>
                </span>

                <span
                    class="game-option-check"
                    data-check="fortnite"
                >
                    ✓
                </span>
            </button>

        </div>
    `;

    /*
       On place le sélecteur avant la partie connexion
       de la navbar.
    */
    const authSection = document.getElementById("authSection");

    if (authSection) {
        nav.insertBefore(selector, authSection);
    } else {
        nav.appendChild(selector);
    }


    setupGameSelectorEvents();

    updateGameSelector();
}


/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

function setupGameSelectorEvents() {

    const button = document.getElementById("gameSelectorButton");
    const menu = document.getElementById("gameSelectorMenu");

    if (!button || !menu) {
        return;
    }


    button.addEventListener("click", function(event) {

        event.stopPropagation();

        menu.classList.toggle("open");
        button.classList.toggle("open");

    });


    const options = document.querySelectorAll(".game-option");

    options.forEach(option => {

        option.addEventListener("click", function(event) {

            event.stopPropagation();

            const gameId = option.dataset.game;

            if (!gameId) {
                return;
            }

            setSelectedGame(gameId);

        });

    });


    document.addEventListener("click", function() {

        menu.classList.remove("open");
        button.classList.remove("open");

    });

}


/* =========================================================
   METTRE À JOUR LE SÉLECTEUR
   ========================================================= */

function updateGameSelector() {

    const selectedGame = getSelectedGame();
    const currentGame = GAMES[selectedGame];

    const nameElement = document.getElementById("gameSelectorName");

    if (nameElement) {
        nameElement.textContent = currentGame.name;
    }


    const options = document.querySelectorAll(".game-option");

    options.forEach(option => {

        const gameId = option.dataset.game;

        if (gameId === selectedGame) {
            option.classList.add("selected");
        } else {
            option.classList.remove("selected");
        }

    });


    const checks = document.querySelectorAll(".game-option-check");

    checks.forEach(check => {

        if (check.dataset.check === selectedGame) {
            check.style.opacity = "1";
        } else {
            check.style.opacity = "0";
        }

    });

}


/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", function() {

    createGameSelector();

});