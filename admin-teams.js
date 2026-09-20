// ============================================================
// CASH ARENA - ADMIN TEAMS
// Gestion des demandes de création d'équipes
// ============================================================

let currentUser = null;
let requests = [];
let currentFilter = "pending";
let currentRejectRequestId = null;


// ============================================================
// CONFIGURATION FIREBASE
// ============================================================

const ADMIN_UIDS = [
    "Xx4L7nCjMthFE2fQjC6Yi2vgzp02"
];


// ============================================================
// INITIALISATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    initAdminTeams();
});


// ============================================================
// INITIALISATION ADMIN
// ============================================================

function initAdminTeams() {

    if (typeof firebase === "undefined") {
        console.error("Firebase n'est pas chargé.");
        return;
    }

    const adminAuth = firebase.auth();
    const adminDb = firebase.firestore();

    adminAuth.onAuthStateChanged(async (user) => {

        if (!user) {
            window.location.href = "index.html";
            return;
        }

        currentUser = user;

        // Vérification admin
        if (!ADMIN_UIDS.includes(user.uid)) {
            alert("Accès refusé.");
            window.location.href = "index.html";
            return;
        }

        setupAdminInterface();
        await loadTeamRequests();
    });


    // ========================================================
    // CONFIGURATION DE L'INTERFACE
    // ========================================================

    function setupAdminInterface() {

        setupTabs();
        setupSearch();
        setupRefreshButton();
        setupRejectModal();
    }


    // ========================================================
    // ONGLET / FILTRES
    // ========================================================

    function setupTabs() {

        const tabs = document.querySelectorAll(".admin-tab");

        tabs.forEach((tab) => {

            tab.addEventListener("click", () => {

                tabs.forEach((item) => {
                    item.classList.remove("active");
                });

                tab.classList.add("active");

                currentFilter = tab.dataset.filter || "all";

                renderRequests();
            });

        });
    }


    // ========================================================
    // RECHERCHE
    // ========================================================

    function setupSearch() {

        const searchInput = document.getElementById("adminSearch");

        if (!searchInput) {
            return;
        }

        searchInput.addEventListener("input", () => {
            renderRequests();
        });
    }


    // ========================================================
    // BOUTON ACTUALISER
    // ========================================================

    function setupRefreshButton() {

        const refreshButton = document.getElementById("refreshRequests");

        if (!refreshButton) {
            return;
        }

        refreshButton.addEventListener("click", async () => {

            refreshButton.disabled = true;

            const originalText = refreshButton.innerHTML;

            refreshButton.innerHTML = "Actualisation...";

            try {
                await loadTeamRequests();
            } catch (error) {
                console.error(error);
            }

            refreshButton.disabled = false;
            refreshButton.innerHTML = originalText;
        });
    }


    // ========================================================
    // CHARGER LES DEMANDES
    // ========================================================

    async function loadTeamRequests() {

        const container = document.getElementById("teamRequests");

        if (container) {
            container.innerHTML = `
                <div class="admin-loading">
                    Chargement des demandes...
                </div>
            `;
        }

        try {

            const snapshot = await adminDb
                .collection("teamRequests")
                .orderBy("createdAt", "desc")
                .get();

            requests = [];

            snapshot.forEach((doc) => {

                const data = doc.data();

                requests.push({
                    id: doc.id,
                    ...data
                });

            });

            updateAdminStats();
            renderRequests();

        } catch (error) {

            console.error(
                "Erreur lors du chargement des demandes :",
                error
            );

            if (container) {

                container.innerHTML = `
                    <div class="admin-error">
                        <h3>Erreur</h3>
                        <p>
                            Impossible de charger les demandes
                            d'équipes.
                        </p>
                        <p>
                            ${escapeHtml(error.message || "")}
                        </p>
                    </div>
                `;
            }
        }
    }


    // ========================================================
    // STATISTIQUES
    // ========================================================

    function updateAdminStats() {

        let pendingCount = 0;
        let approvedCount = 0;
        let rejectedCount = 0;

        requests.forEach((request) => {

            const status = getRequestStatus(request);

            if (status === "pending") {
                pendingCount++;
            }

            if (status === "approved") {
                approvedCount++;
            }

            if (status === "rejected") {
                rejectedCount++;
            }
        });

        const totalCount = requests.length;


        const pendingElement =
            document.getElementById("pendingCount");

        const approvedElement =
            document.getElementById("approvedCount");

        const rejectedElement =
            document.getElementById("rejectedCount");

        const totalElement =
            document.getElementById("totalCount");


        if (pendingElement) {
            pendingElement.textContent = pendingCount;
        }

        if (approvedElement) {
            approvedElement.textContent = approvedCount;
        }

        if (rejectedElement) {
            rejectedElement.textContent = rejectedCount;
        }

        if (totalElement) {
            totalElement.textContent = totalCount;
        }
    }


    // ========================================================
    // NORMALISATION DU STATUT
    // ========================================================

    function getRequestStatus(request) {

        let status = request.status || "pending";

        /*
         * Ancienne version :
         * accepted
         *
         * Nouvelle version :
         * approved
         *
         * On garde la compatibilité avec les anciennes demandes.
         */

        if (status === "accepted") {
            status = "approved";
        }

        return status;
    }


    // ========================================================
    // AFFICHAGE DES DEMANDES
    // ========================================================

    function renderRequests() {

        const container = document.getElementById("teamRequests");

        if (!container) {
            return;
        }

        let filteredRequests = [...requests];


        // ----------------------------------------------------
        // FILTRE PAR STATUT
        // ----------------------------------------------------

        if (currentFilter !== "all") {

            filteredRequests = filteredRequests.filter(
                (request) => {

                    return getRequestStatus(request)
                        === currentFilter;
                }
            );
        }


        // ----------------------------------------------------
        // RECHERCHE
        // ----------------------------------------------------

        const searchInput =
            document.getElementById("adminSearch");

        const searchValue =
            searchInput
                ? searchInput.value.trim().toLowerCase()
                : "";


        if (searchValue !== "") {

            filteredRequests =
                filteredRequests.filter((request) => {

                    const teamName =
                        request.teamName || "";

                    const creatorEmail =
                        request.creatorEmail ||
                        request.email ||
                        "";

                    const creatorName =
                        request.creatorName ||
                        request.displayCreator ||
                        "";

                    const creatorId =
                        request.creatorId || "";

                    const requestId =
                        request.id || "";

                    const combinedText = `
                        ${teamName}
                        ${creatorEmail}
                        ${creatorName}
                        ${creatorId}
                        ${requestId}
                    `.toLowerCase();

                    return combinedText.includes(searchValue);
                });
        }


        // ----------------------------------------------------
        // AUCUNE DEMANDE
        // ----------------------------------------------------

        if (filteredRequests.length === 0) {

            let message = "Aucune demande.";

            if (searchValue !== "") {
                message = "Aucun résultat pour cette recherche.";
            } else if (currentFilter === "pending") {
                message = "Aucune demande en attente.";
            } else if (currentFilter === "approved") {
                message = "Aucune équipe validée.";
            } else if (currentFilter === "rejected") {
                message = "Aucune demande refusée.";
            }

            container.innerHTML = `
                <div class="admin-empty">
                    <div class="admin-empty-icon">
                        📭
                    </div>

                    <h3>${message}</h3>

                    <p>
                        Les demandes correspondant à ce filtre
                        apparaîtront ici.
                    </p>
                </div>
            `;

            return;
        }


        // ----------------------------------------------------
        // AFFICHAGE
        // ----------------------------------------------------

        container.innerHTML = "";

        filteredRequests.forEach((request) => {

            const card =
                createRequestCard(request);

            container.appendChild(card);
        });
    }


    // ========================================================
    // CRÉATION D'UNE CARTE DE DEMANDE
    // ========================================================

    function createRequestCard(request) {

        const card = document.createElement("div");

        card.className = "team-request-card";

        card.dataset.requestId = request.id;


        const status =
            getRequestStatus(request);


        const teamName =
            request.teamName ||
            request.name ||
            "Équipe sans nom";


        const creatorEmail =
            request.creatorEmail ||
            request.email ||
            "Email non disponible";


        const creatorName =
            request.creatorName ||
            request.displayCreator ||
            creatorEmail;


        const creatorId =
            request.creatorId ||
            "Non disponible";


        const teamDescription =
            request.description ||
            request.teamDescription ||
            "Aucune description.";


        const members =
            Array.isArray(request.members)
                ? request.members
                : [];


        const createdDate =
            formatDate(request.createdAt);


        // ----------------------------------------------------
        // STATUT
        // ----------------------------------------------------

        let statusText = "En attente";
        let statusClass = "pending";

        if (status === "approved") {
            statusText = "Validée";
            statusClass = "approved";
        }

        if (status === "rejected") {
            statusText = "Refusée";
            statusClass = "rejected";
        }


        // ----------------------------------------------------
        // MEMBRES
        // ----------------------------------------------------

        let membersHTML = "";

        if (members.length > 0) {

            membersHTML = members
                .map((member) => {

                    if (typeof member === "string") {

                        return `
                            <span class="team-member">
                                ${escapeHtml(member)}
                            </span>
                        `;
                    }

                    const memberName =
                        member.name ||
                        member.username ||
                        member.email ||
                        member.uid ||
                        "Membre";


                    return `
                        <span class="team-member">
                            ${escapeHtml(memberName)}
                        </span>
                    `;
                })
                .join("");

        } else {

            membersHTML = `
                <span class="team-member-empty">
                    Aucun membre renseigné
                </span>
            `;
        }


        // ----------------------------------------------------
        // RAISON DU REFUS
        // ----------------------------------------------------

        let rejectionHTML = "";

        if (
            status === "rejected" &&
            request.rejectionReason
        ) {

            rejectionHTML = `
                <div class="request-rejection">
                    <strong>Raison du refus :</strong>

                    <p>
                        ${escapeHtml(
                            request.rejectionReason
                        )}
                    </p>
                </div>
            `;
        }


        // ----------------------------------------------------
        // ID DE L'ÉQUIPE
        // ----------------------------------------------------

        let teamIdHTML = "";

        if (request.teamId) {

            teamIdHTML = `
                <div class="request-info-row">
                    <span class="request-info-label">
                        ID équipe
                    </span>

                    <span class="request-info-value">
                        ${escapeHtml(request.teamId)}
                    </span>
                </div>
            `;
        }


        // ----------------------------------------------------
        // ACTIONS
        // ----------------------------------------------------

        let actionsHTML = "";


        if (status === "pending") {

            actionsHTML = `
                <div class="request-actions">

                    <button
                        type="button"
                        class="admin-action-btn approve-btn"
                        data-action="approve"
                        data-id="${escapeAttribute(request.id)}"
                    >
                        ✓ Valider
                    </button>

                    <button
                        type="button"
                        class="admin-action-btn reject-btn"
                        data-action="reject"
                        data-id="${escapeAttribute(request.id)}"
                    >
                        ✕ Refuser
                    </button>

                </div>
            `;
        }


        if (status === "approved") {

            actionsHTML = `
                <div class="request-actions">

                    <div class="request-approved-message">
                        ✓ Équipe validée
                    </div>

                </div>
            `;
        }


        if (status === "rejected") {

            actionsHTML = `
                <div class="request-actions">

                    <div class="request-rejected-message">
                        ✕ Demande refusée
                    </div>

                </div>
            `;
        }


        // ----------------------------------------------------
        // HTML FINAL
        // ----------------------------------------------------

        card.innerHTML = `

            <div class="request-card-header">

                <div class="request-title-section">

                    <h3>
                        ${escapeHtml(teamName)}
                    </h3>

                    <span class="request-status ${statusClass}">
                        ${statusText}
                    </span>

                </div>

                <div class="request-date">
                    ${createdDate}
                </div>

            </div>


            <div class="request-card-body">

                <div class="request-info">

                    <div class="request-info-row">

                        <span class="request-info-label">
                            Créateur
                        </span>

                        <span class="request-info-value">
                            ${escapeHtml(creatorName)}
                        </span>

                    </div>


                    <div class="request-info-row">

                        <span class="request-info-label">
                            Email
                        </span>

                        <span class="request-info-value">
                            ${escapeHtml(creatorEmail)}
                        </span>

                    </div>


                    <div class="request-info-row">

                        <span class="request-info-label">
                            UID
                        </span>

                        <span class="request-info-value request-uid">
                            ${escapeHtml(creatorId)}
                        </span>

                    </div>

                    ${teamIdHTML}

                </div>


                <div class="request-description">

                    <span class="request-info-label">
                        Description
                    </span>

                    <p>
                        ${escapeHtml(teamDescription)}
                    </p>

                </div>


                <div class="request-members">

                    <span class="request-info-label">
                        Membres
                    </span>

                    <div class="members-list">
                        ${membersHTML}
                    </div>

                </div>


                ${rejectionHTML}

            </div>


            ${actionsHTML}

        `;


        // ----------------------------------------------------
        // BOUTON VALIDER
        // ----------------------------------------------------

        const approveButton =
            card.querySelector(
                '[data-action="approve"]'
            );

        if (approveButton) {

            approveButton.addEventListener(
                "click",
                async () => {

                    await approveTeamRequest(
                        request.id
                    );

                }
            );
        }


        // ----------------------------------------------------
        // BOUTON REFUSER
        // ----------------------------------------------------

        const rejectButton =
            card.querySelector(
                '[data-action="reject"]'
            );

        if (rejectButton) {

            rejectButton.addEventListener(
                "click",
                () => {

                    openRejectModal(
                        request.id
                    );

                }
            );
        }


        return card;
    }


    // ========================================================
    // VALIDER UNE ÉQUIPE
    // ========================================================

    async function approveTeamRequest(requestId) {

        const request =
            requests.find(
                (item) => item.id === requestId
            );


        if (!request) {

            alert(
                "Impossible de trouver cette demande."
            );

            return;
        }


        const currentStatus =
            getRequestStatus(request);


        if (currentStatus !== "pending") {

            alert(
                "Cette demande a déjà été traitée."
            );

            return;
        }


        const confirmation =
            confirm(
                `Voulez-vous vraiment valider l'équipe "${request.teamName || request.name || "sans nom"}" ?`
            );


        if (!confirmation) {
            return;
        }


        try {

            // ------------------------------------------------
            // CRÉATION DE L'ÉQUIPE
            // ------------------------------------------------

            const teamRef =
                await adminDb
                    .collection("teams")
                    .add({

                        name:
                            request.teamName ||
                            request.name ||
                            "Équipe sans nom",

                        description:
                            request.description ||
                            request.teamDescription ||
                            "",

                        creatorId:
                            request.creatorId ||
                            "",

                        creatorEmail:
                            request.creatorEmail ||
                            request.email ||
                            "",

                        creatorName:
                            request.creatorName ||
                            request.displayCreator ||
                            "",

                        members:
                            Array.isArray(request.members)
                                ? request.members
                                : [],

                        score: 0,

                        season: 1,

                        status: "active",

                        createdAt:
                            firebase.firestore
                                .FieldValue
                                .serverTimestamp(),

                        approvedAt:
                            firebase.firestore
                                .FieldValue
                                .serverTimestamp(),

                        approvedBy:
                            currentUser
                                ? currentUser.uid
                                : "system"

                    });


            // ------------------------------------------------
            // MISE À JOUR DE LA DEMANDE
            // ------------------------------------------------

            await adminDb
                .collection("teamRequests")
                .doc(requestId)
                .update({

                    status: "approved",

                    teamId: teamRef.id,

                    processedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp(),

                    processedBy:
                        currentUser
                            ? currentUser.uid
                            : "system"

                });


            // ------------------------------------------------
            // MISE À JOUR LOCALE
            // ------------------------------------------------

            const localRequest =
                requests.find(
                    (item) =>
                        item.id === requestId
                );


            if (localRequest) {

                localRequest.status = "approved";
                localRequest.teamId = teamRef.id;

            }


            updateAdminStats();
            renderRequests();


            alert(
                "L'équipe a été validée avec succès !"
            );


        } catch (error) {

            console.error(
                "Erreur lors de la validation :",
                error
            );


            alert(
                "Une erreur est survenue lors de la validation de l'équipe.\n\n" +
                error.message
            );
        }
    }


    // ========================================================
    // OUVRIR LE MODAL DE REFUS
    // ========================================================

    function openRejectModal(requestId) {

        currentRejectRequestId = requestId;


        const modal =
            document.getElementById("rejectModal");

        const reasonInput =
            document.getElementById("rejectReason");


        if (!modal) {

            console.error(
                "Le modal rejectModal est introuvable."
            );

            return;
        }


        if (reasonInput) {
            reasonInput.value = "";
        }


        modal.classList.add("active");


        if (reasonInput) {

            setTimeout(() => {
                reasonInput.focus();
            }, 100);
        }
    }


    // ========================================================
    // FERMER LE MODAL
    // ========================================================

    function closeRejectModal() {

        const modal =
            document.getElementById("rejectModal");


        if (modal) {
            modal.classList.remove("active");
        }


        currentRejectRequestId = null;


        const reasonInput =
            document.getElementById("rejectReason");


        if (reasonInput) {
            reasonInput.value = "";
        }
    }


    // ========================================================
    // CONFIGURATION DU MODAL
    // ========================================================

    function setupRejectModal() {

        const confirmButton =
            document.getElementById("confirmReject");

        const cancelButton =
            document.getElementById("cancelReject");

        const closeButton =
            document.getElementById("closeRejectModal");

        const modal =
            document.getElementById("rejectModal");


        // ----------------------------------------------------
        // CONFIRMER
        // ----------------------------------------------------

        if (confirmButton) {

            confirmButton.addEventListener(
                "click",
                async () => {

                    if (!currentRejectRequestId) {

                        alert(
                            "Aucune demande sélectionnée."
                        );

                        return;
                    }


                    const reasonInput =
                        document.getElementById(
                            "rejectReason"
                        );


                    const reason =
                        reasonInput
                            ? reasonInput.value.trim()
                            : "";


                    if (reason === "") {

                        alert(
                            "Veuillez indiquer une raison pour le refus."
                        );

                        if (reasonInput) {
                            reasonInput.focus();
                        }

                        return;
                    }


                    confirmButton.disabled = true;

                    const originalText =
                        confirmButton.innerHTML;

                    confirmButton.innerHTML =
                        "Refus en cours...";


                    try {

                        await rejectTeamRequest(
                            currentRejectRequestId,
                            reason
                        );

                        closeRejectModal();

                    } catch (error) {

                        console.error(error);

                    }


                    confirmButton.disabled = false;

                    confirmButton.innerHTML =
                        originalText;
                }
            );
        }


        // ----------------------------------------------------
        // ANNULER
        // ----------------------------------------------------

        if (cancelButton) {

            cancelButton.addEventListener(
                "click",
                () => {
                    closeRejectModal();
                }
            );
        }


        // ----------------------------------------------------
        // FERMER
        // ----------------------------------------------------

        if (closeButton) {

            closeButton.addEventListener(
                "click",
                () => {
                    closeRejectModal();
                }
            );
        }


        // ----------------------------------------------------
        // CLIQUER EN DEHORS DU MODAL
        // ----------------------------------------------------

        if (modal) {

            modal.addEventListener(
                "click",
                (event) => {

                    if (
                        event.target === modal
                    ) {

                        closeRejectModal();
                    }
                }
            );
        }


        // ----------------------------------------------------
        // TOUCHE ESC
        // ----------------------------------------------------

        document.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Escape"
                ) {

                    closeRejectModal();
                }
            }
        );
    }


    // ========================================================
    // REFUSER UNE ÉQUIPE
    // ========================================================

    async function rejectTeamRequest(
        requestId,
        reason
    ) {

        const request =
            requests.find(
                (item) => item.id === requestId
            );


        if (!request) {

            alert(
                "Impossible de trouver cette demande."
            );

            throw new Error(
                "Demande introuvable."
            );
        }


        const currentStatus =
            getRequestStatus(request);


        if (currentStatus !== "pending") {

            alert(
                "Cette demande a déjà été traitée."
            );

            throw new Error(
                "Demande déjà traitée."
            );
        }


        try {

            await adminDb
                .collection("teamRequests")
                .doc(requestId)
                .update({

                    status: "rejected",

                    rejectionReason:
                        reason ||
                        "Aucune raison indiquée.",

                    processedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp(),

                    processedBy:
                        currentUser
                            ? currentUser.uid
                            : "system"

                });


            // ------------------------------------------------
            // MISE À JOUR LOCALE
            // ------------------------------------------------

            const localRequest =
                requests.find(
                    (item) =>
                        item.id === requestId
                );


            if (localRequest) {

                localRequest.status = "rejected";

                localRequest.rejectionReason =
                    reason ||
                    "Aucune raison indiquée.";
            }


            updateAdminStats();
            renderRequests();


            alert(
                "La demande a été refusée."
            );


        } catch (error) {

            console.error(
                "Erreur lors du refus :",
                error
            );


            alert(
                "Une erreur est survenue lors du refus.\n\n" +
                error.message
            );


            throw error;
        }
    }


    // ========================================================
    // FORMATAGE DE LA DATE
    // ========================================================

    function formatDate(timestamp) {

        if (!timestamp) {
            return "Date inconnue";
        }


        try {

            let date;


            if (
                timestamp &&
                typeof timestamp.toDate === "function"
            ) {

                date = timestamp.toDate();

            } else if (
                timestamp instanceof Date
            ) {

                date = timestamp;

            } else if (
                typeof timestamp === "string" ||
                typeof timestamp === "number"
            ) {

                date = new Date(timestamp);

            } else {

                return "Date inconnue";
            }


            if (isNaN(date.getTime())) {
                return "Date inconnue";
            }


            return date.toLocaleString(
                "fr-FR",
                {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

        } catch (error) {

            console.error(
                "Erreur de formatage de date :",
                error
            );

            return "Date inconnue";
        }
    }


    // ========================================================
    // ÉCHAPPEMENT HTML
    // ========================================================

    function escapeHtml(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }


        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    // ========================================================
    // ÉCHAPPEMENT ATTRIBUT
    // ========================================================

    function escapeAttribute(value) {

        return escapeHtml(value);
    }


    // ========================================================
    // FONCTIONS ACCESSIBLES DEPUIS LE HTML
    // ========================================================

    window.acceptTeamRequest =
        approveTeamRequest;

    window.rejectTeamRequest =
        rejectTeamRequest;

    window.refreshTeamRequests =
        loadTeamRequests;

}