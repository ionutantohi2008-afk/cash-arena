console.log("Admin Teams chargé");

let currentUser = null;
let requests = [];

// ======================================================
// FIREBASE
// ======================================================

if (typeof firebase === "undefined") {
    console.error("Firebase n'est pas chargé.");
}

const adminDb = firebase.firestore();
const adminAuth = firebase.auth();

// ======================================================
// AUTHENTIFICATION + PROTECTION ADMIN
// ======================================================

const ADMIN_UIDS = [
    "Xx4L7nCjMthFE2fQjC6Yi2vgzp02"
];

adminAuth.onAuthStateChanged(async function(user) {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // Vérification de l'UID
    if (!ADMIN_UIDS.includes(user.uid)) {

        console.warn(
            "⛔ Accès admin-teams refusé :",
            user.uid
        );

        alert(
            "⛔ Accès interdit. Cette page est réservée aux administrateurs."
        );

        window.location.href = "index.html";

        return;
    }

    // Utilisateur autorisé
    currentUser = user;

    console.log(
        "✅ Administrateur autorisé :",
        user.uid
    );

    loadTeamRequests();
});

// ======================================================
// CHARGER LES DEMANDES
// ======================================================

async function loadTeamRequests() {

    const container = document.getElementById("teamRequests");

    if (!container) {
        console.error("Élément #teamRequests introuvable.");
        return;
    }

    container.innerHTML = "";

    try {

        const snapshot = await adminDb
            .collection("teamRequests")
            .orderBy("createdAt", "desc")
            .get();

        requests = [];

        snapshot.forEach(function(doc) {

            requests.push({
                id: doc.id,
                ...doc.data()
            });

        });

        console.log(
            "Demandes d'équipes trouvées :",
            requests.length
        );

        if (requests.length === 0) {

            showEmptyMessage(container);

            return;
        }

        requests.forEach(function(request) {

            createRequestCard(
                container,
                request
            );

        });

    } catch (error) {

        console.error(
            "Erreur chargement demandes :",
            error
        );

        showErrorMessage(
            container,
            "Impossible de charger les demandes."
        );
    }
}

// ======================================================
// CARTE DEMANDE
// ======================================================

function createRequestCard(container, request) {

    const card = document.createElement("div");

    card.className = "team-request-card";

    const status = request.status || "pending";

    card.innerHTML = `
        <div class="team-request-header">

            <div>
                <h2>
                    ${escapeHTML(request.teamName || "Équipe sans nom")}
                </h2>

                <span class="request-id">
                    ID : ${escapeHTML(request.id)}
                </span>
            </div>

            <span class="request-status ${status}">
                ${getStatusText(status)}
            </span>

        </div>

        <div class="team-request-content">

            <p>
                <strong>Créateur :</strong>
                ${escapeHTML(request.creatorPseudo || "Inconnu")}
            </p>

            <p>
                <strong>Nombre de membres :</strong>
                ${request.memberCount || 0}
            </p>

            <p>
                <strong>Discord :</strong>
                ${escapeHTML(request.discord || "Non renseigné")}
            </p>

            <p>
                <strong>Description :</strong>
            </p>

            <div class="request-description">
                ${escapeHTML(request.description || "Aucune description.")}
            </div>

            <p>
                <strong>Membres :</strong>
            </p>

            <div class="request-members">
                ${createMembersList(request.members)}
            </div>

        </div>

        <div class="team-request-actions">

            ${
                status === "pending"
                ?
                `
                <button
                    class="accept-team-btn"
                    onclick="acceptTeamRequest('${request.id}')"
                >
                    ✓ ACCEPTER
                </button>

                <button
                    class="reject-team-btn"
                    onclick="rejectTeamRequest('${request.id}')"
                >
                    ✕ REFUSER
                </button>
                `
                :
                `
                <span class="request-processed">
                    Demande déjà traitée
                </span>
                `
            }

        </div>
    `;

    container.appendChild(card);
}

// ======================================================
// LISTE DES MEMBRES
// ======================================================

function createMembersList(members) {

    if (!members) {
        return "Aucun membre renseigné.";
    }

    if (!Array.isArray(members)) {
        return escapeHTML(String(members));
    }

    if (members.length === 0) {
        return "Aucun membre renseigné.";
    }

    return members
        .map(function(member) {

            return `
                <span class="request-member">
                    ${escapeHTML(member)}
                </span>
            `;

        })
        .join("");
}

// ======================================================
// ACCEPTER
// ======================================================

async function acceptTeamRequest(requestId) {

    if (!requestId) {
        return;
    }

    const confirmed = confirm(
        "Voulez-vous vraiment accepter cette demande d'équipe ?"
    );

    if (!confirmed) {
        return;
    }

    try {

        const requestRef = adminDb
            .collection("teamRequests")
            .doc(requestId);

        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {

            alert(
                "Cette demande n'existe plus."
            );

            return;
        }

        const request = requestDoc.data();

        if (request.status === "accepted") {

            alert(
                "Cette demande est déjà acceptée."
            );

            return;
        }

        const teamRef = adminDb
            .collection("teams")
            .doc();

        const teamData = {

            name: request.teamName || "Nouvelle équipe",

            creatorUid:
                request.creatorUid || null,

            creatorPseudo:
                request.creatorPseudo || "Inconnu",

            memberCount:
                request.memberCount || 0,

            members:
                Array.isArray(request.members)
                ? request.members
                : [],

            discord:
                request.discord || "",

            description:
                request.description || "",

            logo:
                request.logo || "",

            banner:
                request.banner || "",

            rank:
                0,

            tournaments:
                0,

            victories:
                0,

            earnings:
                0,

            createdAt:
                firebase.firestore.FieldValue.serverTimestamp(),

            updatedAt:
                firebase.firestore.FieldValue.serverTimestamp()
        };

        const batch = adminDb.batch();

        batch.set(
            teamRef,
            teamData
        );

        batch.update(
            requestRef,
            {

                status: "accepted",

                teamId:
                    teamRef.id,

                processedAt:
                    firebase.firestore.FieldValue.serverTimestamp(),

                processedBy:
                    currentUser.uid

            }
        );

        await batch.commit();

        alert(
            "✅ Équipe créée avec succès !"
        );

        loadTeamRequests();

    } catch (error) {

        console.error(
            "Erreur acceptation équipe :",
            error
        );

        alert(
            "❌ Impossible d'accepter la demande."
        );
    }
}

// ======================================================
// REFUSER
// ======================================================

async function rejectTeamRequest(requestId) {

    if (!requestId) {
        return;
    }

    const reason = prompt(
        "Pourquoi refuses-tu cette demande ?"
    );

    if (reason === null) {
        return;
    }

    try {

        const requestRef = adminDb
            .collection("teamRequests")
            .doc(requestId);

        const requestDoc =
            await requestRef.get();

        if (!requestDoc.exists) {

            alert(
                "Cette demande n'existe plus."
            );

            return;
        }

        const request =
            requestDoc.data();

        if (request.status === "rejected") {

            alert(
                "Cette demande est déjà refusée."
            );

            return;
        }

        await requestRef.update({

            status: "rejected",

            rejectionReason:
                reason || "Aucune raison indiquée.",

            processedAt:
                firebase.firestore.FieldValue.serverTimestamp(),

            processedBy:
                currentUser.uid

        });

        alert(
            "❌ Demande refusée."
        );

        loadTeamRequests();

    } catch (error) {

        console.error(
            "Erreur refus équipe :",
            error
        );

        alert(
            "❌ Impossible de refuser la demande."
        );
    }
}

// ======================================================
// STATUT
// ======================================================

function getStatusText(status) {

    if (status === "accepted") {
        return "✓ ACCEPTÉE";
    }

    if (status === "rejected") {
        return "✕ REFUSÉE";
    }

    return "● EN ATTENTE";
}

// ======================================================
// MESSAGE VIDE
// ======================================================

function showEmptyMessage(container) {

    const message =
        document.createElement("div");

    message.className =
        "empty-requests";

    message.innerText =
        "Aucune demande de création d'équipe.";

    container.appendChild(message);
}

// ======================================================
// MESSAGE ERREUR
// ======================================================

function showErrorMessage(
    container,
    messageText
) {

    const message =
        document.createElement("div");

    message.className =
        "error-requests";

    message.innerText =
        messageText;

    container.appendChild(message);
}

// ======================================================
// PROTECTION HTML
// ======================================================

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ======================================================
// RAFRAÎCHISSEMENT MANUEL
// ======================================================

function refreshTeamRequests() {

    loadTeamRequests();

}

// ======================================================
// EXPOSER LES FONCTIONS AUX BOUTONS HTML
// ======================================================

window.acceptTeamRequest =
    acceptTeamRequest;

window.rejectTeamRequest =
    rejectTeamRequest;

window.refreshTeamRequests =
    refreshTeamRequests;