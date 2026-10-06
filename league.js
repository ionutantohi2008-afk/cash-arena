console.log("League chargé");

// ======================================================
// 🎮 JEU SÉLECTIONNÉ
// ======================================================

const CURRENT_GAME =
    typeof getSelectedGame === "function"
        ? getSelectedGame()
        : (
            localStorage.getItem(
                "cashArenaSelectedGame"
            ) || "brawlstars"
        );

const IS_FORTNITE =
    CURRENT_GAME === "fortnite";

const IS_BRAWL_STARS =
    CURRENT_GAME === "brawlstars";


// ======================================================
// 👤 UTILISATEUR
// ======================================================

let currentUser = null;


// ======================================================
// 🎮 CONFIGURATION DES JEUX
// ======================================================

const GAME_CONFIG = {

    brawlstars: {
        name: "BRAWL STARS",
        emoji: "⭐"
    },

    fortnite: {
        name: "FORTNITE",
        emoji: "🎯"
    }

};


// ======================================================
// 🏆 RANGS
// ======================================================

const RANKS = [

    {
        name: "Bronze",
        icon: "bronze.png",
        min: 0,
        max: 100
    },

    {
        name: "Silver",
        icon: "silver.png",
        min: 100,
        max: 250
    },

    {
        name: "Gold",
        icon: "gold.png",
        min: 250,
        max: 500
    },

    {
        name: "Platinum",
        icon: "platinum.png",
        min: 500,
        max: 1000
    },

    {
        name: "Diamond",
        icon: "diamond.png",
        min: 1000,
        max: 2000
    },

    {
        name: "Champion",
        icon: "champion.png",
        min: 2000,
        max: 3500
    },

    {
        name: "Legend",
        icon: "legend.png",
        min: 3500,
        max: null
    }

];


// ======================================================
// 🔧 RÉFÉRENCE PROFIL DU JEU
// ======================================================

function getGameProfileRef(uid) {

    return db
        .collection("users")
        .doc(uid)
        .collection("games")
        .doc(CURRENT_GAME);

}


// ======================================================
// 📥 CHARGER LES DONNÉES DE LEAGUE
// ======================================================

async function getCurrentGameLeagueData() {

    if (!currentUser) {

        return {
            leaguePoints: 0,
            leagueRank: "Bronze"
        };

    }


    // --------------------------------------------------
    // ⭐ BRAWL STARS
    // --------------------------------------------------

    if (IS_BRAWL_STARS) {

        const doc =
            await db
                .collection("users")
                .doc(currentUser.uid)
                .get();


        const data =
            doc.data() || {};


        return {

            leaguePoints:
                Number(
                    data.leaguePoints || 0
                ),

            leagueRank:
                data.leagueRank ||
                "Bronze"

        };

    }


    // --------------------------------------------------
    // 🎯 FORTNITE
    // --------------------------------------------------

    if (IS_FORTNITE) {

        const gameRef =
            getGameProfileRef(
                currentUser.uid
            );


        const doc =
            await gameRef.get();


        if (!doc.exists) {

            await gameRef.set({

                game:
                    "fortnite",

                leaguePoints:
                    0,

                leagueRank:
                    "Bronze",

                createdAt:
                    new Date()

            }, {
                merge: true
            });


            return {

                leaguePoints: 0,

                leagueRank:
                    "Bronze"

            };

        }


        const data =
            doc.data() || {};


        return {

            leaguePoints:
                Number(
                    data.leaguePoints || 0
                ),

            leagueRank:
                data.leagueRank ||
                "Bronze"

        };

    }


    return {

        leaguePoints: 0,

        leagueRank: "Bronze"

    };

}


// ======================================================
// 🎮 AFFICHER LE JEU
// ======================================================

function updateLeagueGameDisplay() {

    const config =
        GAME_CONFIG[
            CURRENT_GAME
        ] ||
        GAME_CONFIG.brawlstars;


    // --------------------------------------------------
    // Titre navigateur
    // --------------------------------------------------

    document.title =
        `Cash Arena • ${config.name} League`;


    // --------------------------------------------------
    // Ajouter un indicateur de jeu
    // sans modifier les IDs existants.
    // --------------------------------------------------

    let gameBadge =
        document.getElementById(
            "leagueGameBadge"
        );


    if (!gameBadge) {

        gameBadge =
            document.createElement(
                "div"
            );

        gameBadge.id =
            "leagueGameBadge";


        gameBadge.style.marginBottom =
            "15px";


        gameBadge.style.textAlign =
            "center";


        gameBadge.style.fontWeight =
            "700";


        gameBadge.style.fontSize =
            "18px";


        gameBadge.style.opacity =
            "0.95";


        const leagueCard =
            document.querySelector(
                ".league-card"
            );


        if (leagueCard) {

            leagueCard.insertBefore(
                gameBadge,
                leagueCard.firstChild
            );

        }

    }


    gameBadge.innerText =
        `${config.emoji} ${config.name} LEAGUE`;

}


// ======================================================
// 🖼️ ICÔNE DU RANG
// ======================================================

function getRankIcon(rank) {

    return `
        <img
            src="${rank.icon}"
            alt="${rank.name}"
            class="rank-icon-img"
        >
    `;

}


// ======================================================
// 🏆 TROUVER LE RANG
// ======================================================

function getRankFromLP(lp) {

    for (
        const rank of RANKS
    ) {

        if (
            rank.max === null
        ) {

            return rank;

        }


        if (
            lp >= rank.min &&
            lp < rank.max
        ) {

            return rank;

        }

    }


    return RANKS[0];

}


// ======================================================
// 📊 AFFICHER LE CLASSEMENT
// ======================================================

async function updateLeagueDisplay() {

    if (!currentUser) {

        return;

    }


    try {

        const data =
            await getCurrentGameLeagueData();


        const lp =
            Number(
                data.leaguePoints || 0
            );


        const rank =
            getRankFromLP(lp);


        const playerRank =
            document.getElementById(
                "playerRank"
            );


        const rankIcon =
            document.getElementById(
                "rankIcon"
            );


        const playerLP =
            document.getElementById(
                "playerLP"
            );


        if (playerRank) {

            playerRank.innerText =
                rank.name;

        }


        if (rankIcon) {

            rankIcon.innerHTML =
                getRankIcon(rank);

        }


        if (playerLP) {

            playerLP.innerText =
                lp + " LP";

        }


        updateProgress(lp);

        highlightRoad(
            rank.name
        );


        const legendCard =
            document.getElementById(
                "legendCard"
            );


        if (
            rank.name === "Legend"
        ) {

            if (legendCard) {

                legendCard.style.display =
                    "block";

            }


            await loadLegend();

        } else {

            if (legendCard) {

                legendCard.style.display =
                    "none";

            }

        }

    } catch (error) {

        console.error(
            "❌ Erreur League :",
            error
        );

    }

}


// ======================================================
// 🔐 AUTHENTIFICATION
// ======================================================

auth.onAuthStateChanged(
    async user => {

        if (!user) {

            window.location =
                "index.html";

            return;

        }


        currentUser =
            user;


        updateLeagueGameDisplay();


        await updateLeagueDisplay();


        previousRank =
            (
                await getCurrentGameLeagueData()
            ).leagueRank ||
            "Bronze";

    }
);


// ======================================================
// 📈 PROGRESSION
// ======================================================

function updateProgress(lp) {

    const rank =
        getRankFromLP(lp);


    const fill =
        document.getElementById(
            "progressFill"
        );


    const text =
        document.getElementById(
            "progressText"
        );


    const nextText =
        document.getElementById(
            "nextRank"
        );


    if (!fill || !text || !nextText) {

        return;

    }


    if (
        rank.max === null
    ) {

        fill.style.width =
            "100%";


        text.innerText =
            lp + " LP";


        nextText.innerHTML =
            "🔥 Tu as atteint le rang maximum !";


        return;

    }


    const current =
        lp -
        rank.min;


    const total =
        rank.max -
        rank.min;


    const percent =
        Math.max(
            0,
            Math.min(
                100,
                (
                    current /
                    total
                ) * 100
            )
        );


    fill.style.width =
        percent + "%";


    text.innerHTML =
        lp +
        " / " +
        rank.max +
        " LP";


    const nextRank =
        RANKS[
            RANKS.indexOf(rank) +
            1
        ];


    if (nextRank) {

        nextText.innerHTML =
            "Encore <b>" +
            (
                rank.max -
                lp
            ) +
            " LP</b> avant <b>" +
            nextRank.name +
            "</b>";

    }

}


// ======================================================
// 🛣️ ROAD DES RANGS
// ======================================================

function highlightRoad(
    rankName
) {

    document
        .querySelectorAll(
            ".road-rank"
        )
        .forEach(
            rank => {

                rank.classList.remove(
                    "active"
                );

            }
        );


    const id =
        "road" +
        rankName;


    const card =
        document.getElementById(
            id
        );


    if (card) {

        card.classList.add(
            "active"
        );

    }

}


// ======================================================
// 🎉 RANK UP
// ======================================================

let previousRank = null;


async function checkRankUp() {

    if (!currentUser) {

        return;

    }


    try {

        const data =
            await getCurrentGameLeagueData();


        const lp =
            Number(
                data.leaguePoints || 0
            );


        const rank =
            getRankFromLP(lp);


        if (
            previousRank === null
        ) {

            previousRank =
                rank.name;

            return;

        }


        if (
            previousRank !==
            rank.name
        ) {

            showRankUp(
                rank
            );


            previousRank =
                rank.name;

        }

    } catch (error) {

        console.error(
            "❌ Erreur Rank Up :",
            error
        );

    }

}


// ======================================================
// 🎉 POPUP RANK UP
// ======================================================

function showRankUp(
    rank
) {

    const popup =
        document.getElementById(
            "rankUpPopup"
        );


    const icon =
        document.getElementById(
            "rankUpIcon"
        );


    const text =
        document.getElementById(
            "rankUpText"
        );


    if (!popup || !icon || !text) {

        return;

    }


    icon.innerHTML =
        getRankIcon(rank);


    text.innerText =
        rank.name;


    popup.classList.add(
        "show"
    );


    setTimeout(
        () => {

            popup.classList.remove(
                "show"
            );

        },
        5000
    );

}


// ======================================================
// 🏆 TOP LEGEND
// ======================================================

async function loadLegend() {

    const table =
        document.getElementById(
            "legendTable"
        );


    if (!table) {

        return;

    }


    try {

        let players = [];


        // ------------------------------------------------
        // ⭐ BRAWL STARS
        // ------------------------------------------------

        if (IS_BRAWL_STARS) {

            const snapshot =
                await db
                    .collection("users")
                    .where(
                        "leagueRank",
                        "==",
                        "Legend"
                    )
                    .get();


            snapshot.forEach(
                doc => {

                    const data =
                        doc.data() || {};


                    players.push({

                        id:
                            doc.id,

                        pseudo:
                            data.pseudo ||
                            data.email ||
                            "Joueur",

                        leaguePoints:
                            Number(
                                data.leaguePoints ||
                                0
                            )

                    });

                }
            );

        }


        // ------------------------------------------------
        // 🎯 FORTNITE
        // ------------------------------------------------

        if (IS_FORTNITE) {

            const snapshot =
                await db
                    .collectionGroup(
                        "games"
                    )
                    .where(
                        "game",
                        "==",
                        "fortnite"
                    )
                    .where(
                        "leagueRank",
                        "==",
                        "Legend"
                    )
                    .get();


            snapshot.forEach(
                doc => {

                    const data =
                        doc.data() || {};


                    players.push({

                        id:
                            doc.id,

                        pseudo:
                            data.pseudo ||
                            data.fortniteName ||
                            "Joueur",

                        leaguePoints:
                            Number(
                                data.leaguePoints ||
                                0
                            )

                    });

                }
            );

        }


        players.sort(
            (a, b) =>
                (
                    b.leaguePoints ||
                    0
                ) -
                (
                    a.leaguePoints ||
                    0
                )
        );


        table.innerHTML =
            "";


        if (
            players.length === 0
        ) {

            table.innerHTML = `

                <tr>

                    <td colspan="3">

                        Aucun joueur Legend.

                    </td>

                </tr>

            `;


            return;

        }


        players.forEach(
            (
                player,
                index
            ) => {

                let medal =
                    "";


                if (
                    index === 0
                ) {

                    medal =
                        "🥇";

                } else if (
                    index === 1
                ) {

                    medal =
                        "🥈";

                } else if (
                    index === 2
                ) {

                    medal =
                        "🥉";

                } else {

                    medal =
                        "#" +
                        (
                            index +
                            1
                        );

                }


                table.innerHTML += `

                    <tr>

                        <td>
                            ${medal}
                        </td>

                        <td>
                            ${player.pseudo}
                        </td>

                        <td>
                            ⭐ ${player.leaguePoints}
                        </td>

                    </tr>

                `;

            }
        );

    } catch (error) {

        console.error(
            "❌ Erreur Top Legend :",
            error
        );


        table.innerHTML = `

            <tr>

                <td colspan="3">

                    Impossible de charger le classement.

                </td>

            </tr>

        `;

    }

}


// ======================================================
// 🔄 RAFRAÎCHISSEMENT
// ======================================================

async function refreshLeague() {

    if (!currentUser) {

        return;

    }


    await updateLeagueDisplay();

}


// ======================================================
// ⏱️ RAFRAÎCHISSEMENT AUTOMATIQUE
// ======================================================

setInterval(
    refreshLeague,
    5000
);


// ======================================================
// 🔄 VÉRIFICATION RANK UP
// ======================================================

setInterval(
    checkRankUp,
    3000
);


// ======================================================
// 🏆 ACTUALISATION TOP LEGEND
// ======================================================

setInterval(
    () => {

        const legendCard =
            document.getElementById(
                "legendCard"
            );


        if (
            legendCard &&
            legendCard.style.display !==
                "none"
        ) {

            loadLegend();

        }

    },
    10000
);


// ======================================================
// 📊 ANIMATION PROGRESSION
// ======================================================

function animateProgress(
    percent
) {

    const fill =
        document.getElementById(
            "progressFill"
        );


    if (!fill) {

        return;

    }


    fill.style.width =
        "0%";


    setTimeout(
        () => {

            fill.style.width =
                percent +
                "%";

        },
        150
    );

}


// ======================================================
// 🎮 CHANGEMENT DE JEU
// ======================================================

window.addEventListener(
    "storage",
    event => {

        if (
            event.key !==
            "cashArenaSelectedGame"
        ) {

            return;

        }


        const newGame =
            event.newValue ||
            "brawlstars";


        if (
            newGame !==
            CURRENT_GAME
        ) {

            window.location.reload();

        }

    }
);


// ======================================================
// 🚀 CHARGEMENT INITIAL
// ======================================================

window.addEventListener(
    "DOMContentLoaded",
    () => {

        updateLeagueGameDisplay();

    }
);