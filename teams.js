// ======================================================
// 🏆 CASH ARENA — TEAMS.JS
// ======================================================

console.log("🏆 Teams chargé");

let currentUser = null;
let allTeams = [];

// ======================================================
// CONFIGURATION
// ======================================================

const TEAMS_COLLECTION = "teams";
const TEAM_REQUESTS_COLLECTION = "teamRequests";


// ======================================================
// INITIALISATION
// ======================================================

document.addEventListener("DOMContentLoaded", () => {

    initTeamsPage();

});


async function initTeamsPage() {

    try {

        // --------------------------------------------------
        // AUTH
        // --------------------------------------------------

        auth.onAuthStateChanged(async user => {

            if (!user) {

                currentUser = null;

                console.log(
                    "⚠️ Aucun utilisateur connecté."
                );

                return;

            }

            currentUser = user;

            console.log(
                "👤 Utilisateur connecté :",
                user.uid
            );

            await loadTeams();

        });


        // --------------------------------------------------
        // BOUTON CREER UNE EQUIPE
        // --------------------------------------------------

        const createButton =
            document.getElementById(
                "createTeamBtn"
            );

        if (createButton) {

            createButton.addEventListener(
                "click",
                openCreateTeamModal
            );

        }


        // --------------------------------------------------
        // FERMETURE MODAL
        // --------------------------------------------------

        const closeButton =
            document.getElementById(
                "closeTeamModal"
            );

        if (closeButton) {

            closeButton.addEventListener(
                "click",
                closeCreateTeamModal
            );

        }


        const overlay =
            document.getElementById(
                "teamModalOverlay"
            );

        if (overlay) {

            overlay.addEventListener(
                "click",
                closeCreateTeamModal
            );

        }


        // --------------------------------------------------
        // FORMULAIRE
        // --------------------------------------------------

        const form =
            document.getElementById(
                "createTeamForm"
            );

        if (form) {

            form.addEventListener(
                "submit",
                submitTeamRequest
            );

        }


        // --------------------------------------------------
        // BOUTON FERMER SUCCES
        // --------------------------------------------------

        const successClose =
            document.getElementById(
                "closeSuccessButton"
            );

        if (successClose) {

            successClose.addEventListener(
                "click",
                closeCreateTeamModal
            );

        }


        // --------------------------------------------------
        // RECHERCHE
        // --------------------------------------------------

        const searchInput =
            document.getElementById(
                "teamSearch"
            );

        if (searchInput) {

            searchInput.addEventListener(
                "input",
                filterTeams
            );

        }


        // --------------------------------------------------
        // COMPTEUR DESCRIPTION
        // --------------------------------------------------

        const description =
            document.getElementById(
                "teamDescription"
            );

        const counter =
            document.getElementById(
                "descriptionCounter"
            );

        if (
            description &&
            counter
        ) {

            description.addEventListener(
                "input",
                () => {

                    counter.innerText =
                        description.value.length +
                        "/500";

                }
            );

        }


    } catch (error) {

        console.error(
            "❌ Erreur initialisation Teams :",
            error
        );

    }

}


// ======================================================
// 📥 CHARGER LES EQUIPES
// ======================================================

async function loadTeams() {

    const grid =
        document.getElementById(
            "teamsGrid"
        );

    if (!grid) {

        console.error(
            "❌ teamsGrid introuvable."
        );

        return;

    }


    grid.innerHTML = `

        <div class="teams-loading">

            <div class="loading-spinner"></div>

            <span>
                Chargement des équipes...
            </span>

        </div>

    `;


    try {

        const snapshot =
            await db
                .collection(
                    TEAMS_COLLECTION
                )
                .where(
                    "status",
                    "==",
                    "approved"
                )
                .get();


        allTeams = [];


        snapshot.forEach(doc => {

            allTeams.push({

                id: doc.id,

                ...doc.data()

            });

        });


        // Classement

        allTeams.sort(
            (a, b) =>
                (a.ranking || 999999) -
                (b.ranking || 999999)
        );


        renderTeams(allTeams);


    } catch (error) {

        console.error(
            "❌ Impossible de charger les équipes :",
            error
        );


        grid.innerHTML = `

            <div class="no-teams">

                <div class="no-teams-icon">
                    ⚠️
                </div>

                <h2>
                    Impossible de charger les équipes
                </h2>

                <p>
                    Une erreur est survenue.
                    Réessaie dans quelques instants.
                </p>

            </div>

        `;

    }

}


// ======================================================
// 🎨 AFFICHER LES EQUIPES
// ======================================================

function renderTeams(teams) {

    const grid =
        document.getElementById(
            "teamsGrid"
        );

    if (!grid) return;


    grid.innerHTML = "";


    if (!teams.length) {

        grid.innerHTML = `

            <div class="no-teams">

                <div class="no-teams-icon">
                    🏆
                </div>

                <h2>
                    Aucune équipe
                </h2>

                <p>
                    Sois le premier à créer une équipe
                    sur Cash Arena.
                </p>

            </div>

        `;

        updateTeamCount(0);

        return;

    }


    teams.forEach(team => {

        grid.insertAdjacentHTML(
            "beforeend",
            createTeamCard(team)
        );

    });


    updateTeamCount(
        teams.length
    );


    // Ajouter événements

    document
        .querySelectorAll(
            ".team-view-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const teamId =
                        button.dataset.teamId;

                    viewTeam(teamId);

                }
            );

        });

}


// ======================================================
// 🃏 CARTE EQUIPE
// ======================================================

function createTeamCard(team) {

    const banner =
        team.banner ||
        "assets/team-default-banner.jpg";


    const logo =
        team.logo ||
        "assets/team-default-logo.png";


    const name =
        escapeHTML(
            team.name ||
            "Équipe sans nom"
        );


    const description =
        escapeHTML(
            team.description ||
            "Aucune description."
        );


    const members =
        Array.isArray(team.members)
            ? team.members.length
            : Number(
                team.memberCount || 0
            );


    const ranking =
        Number(
            team.ranking || 0
        );


    let rankingText =
        ranking > 0
            ? "#" + ranking
            : "N/A";


    return `

        <article
            class="team-card"
            data-team-id="${team.id}"
        >

            <div class="team-banner">

                <img
                    src="${escapeAttribute(banner)}"
                    alt="Bannière ${name}"
                    loading="lazy"
                    onerror="
                        this.src='assets/team-default-banner.jpg'
                    "
                >

                <div class="team-logo-wrapper">

                    <img
                        src="${escapeAttribute(logo)}"
                        alt="Logo ${name}"
                        loading="lazy"
                        onerror="
                            this.src='assets/team-default-logo.png'
                        "
                    >

                </div>

            </div>


            <div class="team-card-content">

                <div class="team-card-title">

                    <h2>
                        ${name}
                    </h2>

                    <div class="team-rank">

                        🏆

                        ${rankingText}

                    </div>

                </div>


                <p class="team-description">

                    ${description}

                </p>


                <div class="team-meta">

                    <div class="team-meta-item">

                        👥

                        <strong>
                            ${members}
                        </strong>

                        membres

                    </div>


                    <div class="team-meta-item">

                        🎮

                        <strong>
                            ${team.tournamentsPlayed || 0}
                        </strong>

                        tournois

                    </div>


                    <div class="team-meta-item">

                        🏆

                        <strong>
                            ${team.wins || 0}
                        </strong>

                        victoires

                    </div>

                </div>


                <button
                    class="team-view-button"
                    data-team-id="${team.id}"
                    type="button"
                >

                    VOIR L'ÉQUIPE

                </button>

            </div>

        </article>

    `;

}


// ======================================================
// 🔎 RECHERCHE
// ======================================================

function filterTeams() {

    const input =
        document.getElementById(
            "teamSearch"
        );

    if (!input) return;


    const search =
        input.value
            .trim()
            .toLowerCase();


    if (!search) {

        renderTeams(allTeams);

        return;

    }


    const filtered =
        allTeams.filter(team => {

            const name =
                String(
                    team.name || ""
                ).toLowerCase();


            const description =
                String(
                    team.description || ""
                ).toLowerCase();


            return (
                name.includes(search) ||
                description.includes(search)
            );

        });


    renderTeams(filtered);

}


// ======================================================
// 👥 COMPTEUR
// ======================================================

function updateTeamCount(count) {

    const element =
        document.getElementById(
            "teamCount"
        );

    if (!element) return;


    element.innerText =
        count;

}


// ======================================================
// ➕ OUVRIR MODAL
// ======================================================

function openCreateTeamModal() {

    if (!currentUser) {

        alert(
            "Tu dois être connecté pour créer une équipe."
        );

        return;

    }


    const modal =
        document.getElementById(
            "teamModal"
        );


    if (!modal) return;


    modal.classList.add(
        "show"
    );


    document.body.style.overflow =
        "hidden";


    resetTeamModal();

}


// ======================================================
// ❌ FERMER MODAL
// ======================================================

function closeCreateTeamModal() {

    const modal =
        document.getElementById(
            "teamModal"
        );


    if (!modal) return;


    modal.classList.remove(
        "show"
    );


    document.body.style.overflow =
        "";


    resetTeamModal();

}


// ======================================================
// 🔄 RESET MODAL
// ======================================================

function resetTeamModal() {

    const form =
        document.getElementById(
            "createTeamForm"
        );


    const formContainer =
        document.getElementById(
            "teamRequestFormContainer"
        );


    const success =
        document.getElementById(
            "teamRequestSuccess"
        );


    const message =
        document.getElementById(
            "teamFormMessage"
        );


    if (form) {

        form.reset();

    }


    if (formContainer) {

        formContainer.style.display =
            "block";

    }


    if (success) {

        success.style.display =
            "none";

    }


    if (message) {

        message.style.display =
            "none";

        message.innerText =
            "";

    }


    const counter =
        document.getElementById(
            "descriptionCounter"
        );

    if (counter) {

        counter.innerText =
            "0/500";

    }

}


// ======================================================
// 📨 ENVOYER DEMANDE
// ======================================================

async function submitTeamRequest(event) {

    event.preventDefault();


    if (!currentUser) {

        showFormError(
            "Tu dois être connecté."
        );

        return;

    }


    const name =
        document
            .getElementById(
                "teamName"
            )
            ?.value
            .trim();


    const memberCount =
        Number(
            document
                .getElementById(
                    "teamMemberCount"
                )
                ?.value
        );


    const membersText =
        document
            .getElementById(
                "teamMembers"
            )
            ?.value
            .trim();


    const discord =
        document
            .getElementById(
                "teamDiscord"
            )
            ?.value
            .trim();


    const description =
        document
            .getElementById(
                "teamDescription"
            )
            ?.value
            .trim();


    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (!name) {

        showFormError(
            "Indique le nom de ton équipe."
        );

        return;

    }


    if (
        !memberCount ||
        memberCount < 1
    ) {

        showFormError(
            "Le nombre de membres est invalide."
        );

        return;

    }


    if (!membersText) {

        showFormError(
            "Indique les pseudos des membres."
        );

        return;

    }


    const members =
        membersText
            .split(",")
            .map(
                member =>
                    member.trim()
            )
            .filter(Boolean);


    if (
        members.length !==
        memberCount
    ) {

        showFormError(
            `Tu as indiqué ${members.length} membre(s), mais le nombre demandé est ${memberCount}.`
        );

        return;

    }


    if (!discord) {

        showFormError(
            "Indique le lien Discord de ton équipe."
        );

        return;

    }


    if (!description) {

        showFormError(
            "Ajoute une description."
        );

        return;

    }


    // --------------------------------------------------
    // PROTECTION SIMPLE
    // --------------------------------------------------

    if (name.length > 30) {

        showFormError(
            "Le nom de l'équipe est trop long."
        );

        return;

    }


    if (description.length > 500) {

        showFormError(
            "La description ne peut pas dépasser 500 caractères."
        );

        return;

    }


    const submitButton =
        document.querySelector(
            ".submit-team-request"
        );


    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.innerHTML =
            "ENVOI EN COURS...";

    }


        try {
        const requestId = generateRequestId();

        // VERIFIER DEMANDES EXISTANTES
        const existing = await db.collection(TEAM_REQUESTS_COLLECTION)
            .where("userId", "==", currentUser.uid)
            .where("status", "==", "pending")
            .limit(1)
            .get();

        if (!existing.empty) {
            showFormError("Tu as déjà une demande de création d'équipe en attente.");
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = `<span>FAIRE LA DEMANDE</span><span class="button-arrow">→</span>`;
            }
            return;
        }

        // CREER LA DEMANDE
        await db.collection(TEAM_REQUESTS_COLLECTION).doc(requestId).set({
            requestId: requestId,
            userId: currentUser.uid,
            userEmail: currentUser.email || null,
            teamName: name,
            memberCount: memberCount,
            members: members,
            discord: discord,
            description: description,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedAt: null,
            reviewedBy: null,
            reviewReason: null
        });

        console.log("✅ Demande équipe créée :", requestId);

        // 🌟 CORRECTION ICI : On affiche le succès d'abord
        showRequestSuccess(requestId);
        
        // Et on quitte proprement la fonction sans passer par le comportement par défaut du finally
        return; 

    } catch (error) {
        console.error("❌ Erreur création demande équipe :", error);
        showFormError("Impossible d'envoyer la demande. Réessaie.");
        
        // 🌟 CORRECTION ICI : On ne réactive le bouton QUE s'il y a eu une erreur
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = `<span>FAIRE LA DEMANDE</span><span class="button-arrow">→</span>`;
        }
    }
    // ❌ Supprimez complètement le bloc "finally" qui était ici et qui forçait la réactivation du bouton en permanence
}


// ======================================================
// 🆔 ID DEMANDE
// ======================================================

function generateRequestId() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let random =
        "";


    for (
        let i = 0;
        i < 6;
        i++
    ) {

        random +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];

    }


    return (
        "CA-" +
        random
    );

}


// ======================================================
// ✅ SUCCES
// ======================================================

function showRequestSuccess(
    requestId
) {

    const formContainer =
        document.getElementById(
            "teamRequestFormContainer"
        );


    const success =
        document.getElementById(
            "teamRequestSuccess"
        );


    const requestIdElement =
        document.getElementById(
            "requestId"
        );


    if (formContainer) {

        formContainer.style.display =
            "none";

    }


    if (success) {

        success.style.display =
            "block";

    }


    if (requestIdElement) {

        requestIdElement.innerText =
            requestId;

    }

}


// ======================================================
// ❌ ERREUR FORMULAIRE
// ======================================================

function showFormError(
    message
) {

    const element =
        document.getElementById(
            "teamFormMessage"
        );


    if (!element) {

        alert(message);

        return;

    }


    element.innerText =
        message;

    element.className =
        "team-form-message error";

    element.style.display =
        "block";


    element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


// ======================================================
// 👀 VOIR UNE EQUIPE
// ======================================================

function viewTeam(teamId) {

    if (!teamId) return;


    window.location.href =
        "team.html?id=" +
        encodeURIComponent(
            teamId
        );

}


// ======================================================
// 🛡️ PROTECTION HTML
// ======================================================

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttribute(value) {

    return escapeHTML(value);

}


// ======================================================
// 🔒 ECHAP POUR FERMER LA MODAL
// ======================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeCreateTeamModal();

        }

    }
);


// ======================================================
// FIN
// ======================================================

console.log(
    "🏆 Cash Arena Teams prêt."
);