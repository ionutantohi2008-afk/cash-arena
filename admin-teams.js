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
// CHARGER LES DEMANDES (CORRIGÉ ✅)
// ======================================================

async function loadTeamRequests() {
    const container = document.getElementById("teamRequests");

    if (!container) {
        console.error("Élément #teamRequests introuvable.");
        return;
    }

    // On laisse le spinner de chargement tourner pendant la requête, on ne vide qu'après s'il y a des données
    try {
        // 🌟 CORRECTION ICI : On utilise "db" (la base client) au lieu de "adminDb"
        const snapshot = await db
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

        console.log("Demandes d'équipes trouvées :", requests.length);

        // On vide le conteneur JUSTE AVANT d'afficher le résultat (évite le flash blanc ou le blocage)
        container.innerHTML = "";

        if (requests.length === 0) {
            showEmptyMessage(container);
            return;
        }

        requests.forEach(function(request) {
            createRequestCard(container, request);
        });

    } catch (error) {
        console.error("Erreur chargement demandes :", error);
        
        // On vide pour afficher le message d'erreur propre
        container.innerHTML = "";
        showErrorMessage(
            container,
            "Impossible de charger les demandes. Vérifie tes permissions Admin."
        );
    }
}

// ======================================================
// CARTE DEMANDE
// ======================================================

function createRequestCard(container, request) {
    const card = document.createElement("div");
    
    // 1. DÉTECTION DU STATUT POUR LES COULEURS
    const status = request.status || "pending"; // pending, approved, ou rejected
    
    // On applique les classes CSS de base + les classes d'historique si besoin
    if (status === "approved") {
        card.className = "admin-request-card history-card approved";
    } else if (status === "rejected") {
        card.className = "admin-request-card history-card rejected";
    } else {
        card.className = "admin-request-card"; // Version "En attente" normale
    }
    
    card.id = `card-${request.id}`;

    // Sécurités pour les textes
    const creatorName = request.creatorPseudo || request.pseudo || "Inconnu";
    const creatorClass = creatorName === "Inconnu" ? "tile-value user-unknown" : "tile-value";
    const membersNeeded = request.memberCount || 0;
    const membersText = membersNeeded > 1 ? `${membersNeeded} joueurs` : `${membersNeeded} joueur`;
    const discordUrl = request.discord || "#";

    // 2. ADAPTATION DU BADGE DE STATUT VISUEL
    let statusBadgeHTML = '<div class="status-badge pending">En attente</div>';
    if (status === "approved") statusBadgeHTML = '<div class="status-badge approved">Validée</div>';
    if (status === "rejected") statusBadgeHTML = '<div class="status-badge rejected">Refusée</div>';

    // 3. ADAPTATION DES BOUTONS (On ne les met QUE si la demande est en attente)
    let actionsHTML = "";
    if (status === "pending") {
        actionsHTML = `
            <div class="card-actions">
                <button class="btn-admin btn-approve" onclick="approveTeam('${request.id}')">
                    <span class="btn-icon">✓</span> Accepter la team
                </button>
                <button class="btn-admin btn-reject" onclick="rejectTeam('${request.id}')">
                    <span class="btn-icon">×</span> Refuser
                </button>
            </div>
        `;
    }

    // 4. INJECTION DU CODE DANS LA CARTE
    card.innerHTML = `
        <div class="card-header">
            <div class="header-main">
                <h3 class="team-title">${escapeHtml(request.teamName || "Sans nom")}</h3>
                <span class="badge-id">ID: <span>${request.id}</span></span>
            </div>
            ${statusBadgeHTML}
        </div>

        <div class="card-info-grid">
            <div class="info-tile">
                <span class="tile-label">Créateur</span>
                <strong class="${creatorClass}">${escapeHtml(creatorName)}</strong>
            </div>
            <div class="info-tile">
                <span class="tile-label">Membres requis</span>
                <strong class="tile-value">${membersText}</strong>
            </div>
            <div class="info-tile full-width">
                <span class="tile-label">Lien Discord</span>
                <a href="${discordUrl}" target="_blank" class="tile-link">${escapeHtml(discordUrl)}</a>
            </div>
        </div>

        <div class="card-text-sections">
            <div class="text-section">
                <h4>Description du projet</h4>
                <div class="text-box-content">
                    <p>${escapeHtml(request.description || "Aucune description.")}</p>
                </div>
            </div>
            <div class="text-section">
                <h4>Membres indiqués</h4>
                <div class="members-tags-container">
                    ${generateMembersTags(request.members)}
                </div>
            </div>
        </div>

        ${actionsHTML} <!-- S'affichera uniquement si la demande est "pending" -->
    `;

    container.appendChild(card);
}

// 🛠️ PETITES FONCTIONS OUTILS UTILES (À mettre au bout de ton fichier JS)

// Pour afficher proprement chaque membre sous forme de petit badge individuel
function generateMembersTags(membersData) {
    if (!membersData) return '<span class="member-tag">Aucun membre indiqué</span>';
    
    // Si c'est déjà un tableau de membres
    if (Array.isArray(membersData)) {
        return membersData.map(m => `<span class="member-tag">${escapeHtml(m)}</span>`).join('');
    }
    
    // Si c'est du texte brut tapé à la ligne dans le textarea, on le découpe ligne par ligne
    if (typeof membersData === "string") {
        return membersData.split('\n')
            .filter(m => m.trim() !== "")
            .map(m => `<span class="member-tag">${escapeHtml(m.trim())}</span>`)
            .join('');
    }
    
    return '<span class="member-tag">Aucun membre indiqué</span>';
}

// Sécurité anti-hack pour éviter que quelqu'un injecte du code HTML malveillant dans les inputs
function escapeHtml(str) {
    if (!str) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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