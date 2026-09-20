// ============================================================
// CASH ARENA - ADMIN TEAMS
// Gestion des demandes de création d'équipes
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    // ============================================================
    // CONFIGURATION
    // ============================================================

    const ADMIN_UIDS = [
        "Xx4L7nCjMthFE2fQjC6Yi2vgzp02"
    ];

    let currentUser = null;
    let requests = [];
    let currentFilter = "pending";
    let currentSearch = "";
    let currentRejectRequestId = null;


    // ============================================================
    // FIREBASE
    // ============================================================

    const adminDb = firebase.firestore();
    const adminAuth = firebase.auth();


    // ============================================================
    // ELEMENTS HTML
    // ============================================================

    const teamRequestsContainer = document.getElementById("teamRequests");

    const pendingCount = document.getElementById("pendingCount");
    const approvedCount = document.getElementById("approvedCount");
    const rejectedCount = document.getElementById("rejectedCount");
    const totalCount = document.getElementById("totalCount");

    const searchInput = document.getElementById("adminSearch");
    const refreshButton = document.getElementById("refreshRequests");

    const rejectModal = document.getElementById("rejectModal");
    const rejectReason = document.getElementById("rejectReason");
    const confirmReject = document.getElementById("confirmReject");
    const cancelReject = document.getElementById("cancelReject");

    const closeRejectModal =
        document.getElementById("closeRejectModal") ||
        document.querySelector(".close-modal");


    // ============================================================
    // VERIFICATION ADMIN
    // ============================================================

    adminAuth.onAuthStateChanged(async (user) => {

        if (!user) {
            window.location.href = "index.html";
            return;
        }

        currentUser = user;

        if (!ADMIN_UIDS.includes(user.uid)) {
            alert("Accès refusé.");
            window.location.href = "index.html";
            return;
        }

        setupAdminInterface();
        await loadTeamRequests();
    });


    // ============================================================
    // INITIALISATION INTERFACE
    // ============================================================

    function setupAdminInterface() {

        setupTabs();
        setupSearch();
        setupRefresh();
        setupRejectModal();
    }


    // ============================================================
    // ONGLETS
    // ============================================================

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


    // ============================================================
    // RECHERCHE
    // ============================================================

    function setupSearch() {

        if (!searchInput) return;

        searchInput.addEventListener("input", () => {

            currentSearch = searchInput.value
                .trim()
                .toLowerCase();

            renderRequests();
        });
    }


    // ============================================================
    // BOUTON ACTUALISER
    // ============================================================

    function setupRefresh() {

        if (!refreshButton) return;

        refreshButton.addEventListener("click", async () => {

            const originalText = refreshButton.innerHTML;

            refreshButton.disabled = true;
            refreshButton.innerHTML = "Actualisation...";

            try {
                await loadTeamRequests();
            } catch (error) {
                console.error("Erreur actualisation :", error);
            }

            refreshButton.disabled = false;
            refreshButton.innerHTML = originalText;
        });
    }


    // ============================================================
    // CHARGEMENT DES DEMANDES
    // ============================================================

    async function loadTeamRequests() {

        if (!teamRequestsContainer) return;

        teamRequestsContainer.innerHTML = `
            <div class="admin-loading">
                <div class="loading-spinner"></div>
                <p>Chargement des demandes...</p>
            </div>
        `;

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

            console.log("Demandes chargées :", requests);

            updateAdminStats();
            renderRequests();

        } catch (error) {

            console.error(
                "Erreur lors du chargement des demandes :",
                error
            );

            teamRequestsContainer.innerHTML = `
                <div class="admin-empty">
                    <div class="admin-empty-icon">⚠️</div>
                    <h3>Erreur de chargement</h3>
                    <p>
                        Impossible de récupérer les demandes d'équipes.
                    </p>
                </div>
            `;
        }
    }


    // ============================================================
    // NORMALISATION DU STATUT
    // ============================================================

    function getRequestStatus(request) {

        const status = request.status || "pending";

        // Compatibilité avec une ancienne valeur éventuelle
        if (status === "accepted") {
            return "approved";
        }

        return status;
    }


    // ============================================================
    // COMPTEURS
    // ============================================================

    function updateAdminStats() {

        let pending = 0;
        let approved = 0;
        let rejected = 0;

        requests.forEach((request) => {

            const status = getRequestStatus(request);

            if (status === "pending") {
                pending++;
            }

            if (status === "approved") {
                approved++;
            }

            if (status === "rejected") {
                rejected++;
            }
        });

        if (pendingCount) {
            pendingCount.textContent = pending;
        }

        if (approvedCount) {
            approvedCount.textContent = approved;
        }

        if (rejectedCount) {
            rejectedCount.textContent = rejected;
        }

        if (totalCount) {
            totalCount.textContent = requests.length;
        }
    }


    // ============================================================
    // FILTRAGE + AFFICHAGE
    // ============================================================

    function renderRequests() {

        if (!teamRequestsContainer) return;

        let filteredRequests = [...requests];


        // --------------------------------------------------------
        // FILTRE STATUT
        // --------------------------------------------------------

        if (currentFilter !== "all") {

            filteredRequests = filteredRequests.filter((request) => {

                return getRequestStatus(request) === currentFilter;

            });
        }


        // --------------------------------------------------------
        // RECHERCHE
        // --------------------------------------------------------

        if (currentSearch) {

            filteredRequests = filteredRequests.filter((request) => {

                const members = Array.isArray(request.members)
                    ? request.members.join(" ")
                    : "";

                const searchableText = [

                    request.teamName,
                    request.userId,
                    request.userEmail,
                    request.requestId,
                    request.teamId,
                    request.description,
                    request.discord,
                    members

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return searchableText.includes(currentSearch);
            });
        }


        // --------------------------------------------------------
        // AUCUN RESULTAT
        // --------------------------------------------------------

        if (filteredRequests.length === 0) {

            let message = "Aucune demande.";

            if (currentSearch) {
                message = "Aucune demande ne correspond à votre recherche.";
            } else if (currentFilter === "pending") {
                message = "Aucune demande en attente.";
            } else if (currentFilter === "approved") {
                message = "Aucune équipe validée.";
            } else if (currentFilter === "rejected") {
                message = "Aucune demande refusée.";
            }

            teamRequestsContainer.innerHTML = `
                <div class="admin-empty">
                    <div class="admin-empty-icon">📋</div>
                    <h3>Aucun résultat</h3>
                    <p>${escapeHTML(message)}</p>
                </div>
            `;

            return;
        }


        // --------------------------------------------------------
        // CREATION DES CARTES
        // --------------------------------------------------------

        teamRequestsContainer.innerHTML = filteredRequests
            .map((request) => createRequestCard(request))
            .join("");
    }


    // ============================================================
    // CARTE D'UNE DEMANDE
    // ============================================================

    function createRequestCard(request) {

        const status = getRequestStatus(request);

        const teamName =
            request.teamName ||
            "Équipe sans nom";

        const userEmail =
            request.userEmail ||
            "Email non disponible";

        const userId =
            request.userId ||
            "UID non disponible";

        const requestId =
            request.requestId ||
            request.id ||
            "ID non disponible";

        const teamId =
            request.teamId ||
            "Non disponible";

        const description =
            request.description ||
            "Aucune description fournie.";

        const discord =
            request.discord ||
            "";

        const members =
            Array.isArray(request.members)
                ? request.members
                : [];

        const memberCount =
            request.memberCount !== undefined
                ? request.memberCount
                : members.length;

        const date =
            formatTimestamp(request.createdAt);


        // --------------------------------------------------------
        // STATUT
        // --------------------------------------------------------

        let statusText = "En attente";

        if (status === "approved") {
            statusText = "Validée";
        }

        if (status === "rejected") {
            statusText = "Refusée";
        }


        // --------------------------------------------------------
        // NOM DU CREATEUR
        // --------------------------------------------------------

        // IMPORTANT :
        // teamRequests ne contient PAS creatorName.
        // Le nom sera récupéré depuis users/{userId}
        // après affichage de la carte.

        const creatorDisplay =
            userEmail !== "Email non disponible"
                ? userEmail
                : userId;


        // --------------------------------------------------------
        // MEMBRES
        // --------------------------------------------------------

        let membersHTML = "";

        if (members.length > 0) {

            membersHTML = members
                .map((member) => {

                    return `
                        <div class="team-member">
                            <span class="team-member-icon">👤</span>
                            <span>${escapeHTML(member)}</span>
                        </div>
                    `;

                })
                .join("");

        } else {

            membersHTML = `
                <div class="team-member-empty">
                    Aucun membre renseigné
                </div>
            `;
        }


        // --------------------------------------------------------
        // DISCORD
        // --------------------------------------------------------

        let discordHTML = `
            <span class="request-info-value">
                Non disponible
            </span>
        `;

        if (discord) {

            discordHTML = `
                <a
                    href="${escapeAttribute(discord)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="request-info-value discord-link"
                >
                    Rejoindre le Discord ↗
                </a>
            `;
        }


        // --------------------------------------------------------
        // ACTIONS
        // --------------------------------------------------------

        let actionsHTML = "";

        if (status === "pending") {

            actionsHTML = `
                <div class="request-actions">

                    <button
                        class="admin-action-btn approve-btn"
                        onclick="acceptTeamRequest('${escapeAttribute(request.id)}')"
                    >
                        ✓ Valider l'équipe
                    </button>

                    <button
                        class="admin-action-btn reject-btn"
                        onclick="rejectTeamRequest('${escapeAttribute(request.id)}')"
                    >
                        ✕ Refuser
                    </button>

                </div>
            `;

        } else if (status === "approved") {

            actionsHTML = `
                <div class="request-approved-message">
                    ✓ Cette équipe a été validée.
                </div>
            `;

        } else if (status === "rejected") {

            actionsHTML = `
                <div class="request-rejected-message">
                    ✕ Cette demande a été refusée.
                </div>
            `;
        }


        // --------------------------------------------------------
        // RAISON DU REFUS
        // --------------------------------------------------------

        let rejectionHTML = "";

        if (
            status === "rejected" &&
            request.reviewReason
        ) {

            rejectionHTML = `
                <div class="request-rejection">
                    <strong>Raison du refus :</strong>
                    <p>${escapeHTML(request.reviewReason)}</p>
                </div>
            `;
        }


        // --------------------------------------------------------
        // CARTE COMPLETE
        // --------------------------------------------------------

        return `
            <div
                class="team-request-card ${status}"
                data-request-id="${escapeAttribute(request.id)}"
            >

                <div class="request-card-header">

                    <div class="request-title-section">

                        <h3>
                            ${escapeHTML(teamName)}
                        </h3>

                        <span class="request-id">
                            ${escapeHTML(requestId)}
                        </span>

                    </div>

                    <span class="request-status ${status}">
                        ${statusText}
                    </span>

                </div>


                <div class="request-card-body">


                    <!-- ================================================= -->
                    <!-- CREATEUR -->
                    <!-- ================================================= -->

                    <div class="request-info">

                        <div class="request-info-row">

                            <span class="request-info-label">
                                Créateur
                            </span>

                            <span
                                class="request-info-value creator-name"
                                data-user-id="${escapeAttribute(userId)}"
                            >
                                ${escapeHTML(creatorDisplay)}
                            </span>

                        </div>


                        <div class="request-info-row">

                            <span class="request-info-label">
                                Email
                            </span>

                            <span class="request-info-value">
                                ${escapeHTML(userEmail)}
                            </span>

                        </div>


                        <div class="request-info-row">

                            <span class="request-info-label">
                                UID
                            </span>

                            <span class="request-info-value request-uid">
                                ${escapeHTML(userId)}
                            </span>

                        </div>


                        <div class="request-info-row">

                            <span class="request-info-label">
                                ID demande
                            </span>

                            <span class="request-info-value">
                                ${escapeHTML(requestId)}
                            </span>

                        </div>


                        <div class="request-info-row">

                            <span class="request-info-label">
                                ID équipe
                            </span>

                            <span class="request-info-value">
                                ${escapeHTML(teamId)}
                            </span>

                        </div>


                        <div class="request-info-row">

                            <span class="request-info-label">
                                Membres
                            </span>

                            <span class="request-info-value">
                                ${memberCount}
                            </span>

                        </div>


                        <div class="request-info-row">

                            <span class="request-info-label">
                                Date
                            </span>

                            <span class="request-info-value">
                                ${escapeHTML(date)}
                            </span>

                        </div>


                        <div class="request-info-row">

                            <span class="request-info-label">
                                Discord
                            </span>

                            ${discordHTML}

                        </div>

                    </div>


                    <!-- ================================================= -->
                    <!-- DESCRIPTION -->
                    <!-- ================================================= -->

                    <div class="request-description">

                        <div class="request-info-label">
                            Description
                        </div>

                        <p>
                            ${escapeHTML(description)}
                        </p>

                    </div>


                    <!-- ================================================= -->
                    <!-- MEMBRES -->
                    <!-- ================================================= -->

                    <div class="request-members">

                        <div class="request-info-label">
                            Membres de l'équipe
                        </div>

                        <div class="members-list">
                            ${membersHTML}
                        </div>

                    </div>


                    <!-- ================================================= -->
                    <!-- RAISON REFUS -->
                    <!-- ================================================= -->

                    ${rejectionHTML}


                    <!-- ================================================= -->
                    <!-- ACTIONS -->
                    <!-- ================================================= -->

                    ${actionsHTML}

                </div>

            </div>
        `;
    }


    // ============================================================
    // VALIDATION D'UNE EQUIPE
    // ============================================================

    async function approveTeamRequest(requestId) {

        const request = requests.find(
            (item) => item.id === requestId
        );

        if (!request) {

            alert("Demande introuvable.");
            return;
        }


        if (getRequestStatus(request) !== "pending") {

            alert("Cette demande a déjà été traitée.");
            return;
        }


        const teamName =
            request.teamName ||
            "Équipe sans nom";


        const confirmed = confirm(
            `Voulez-vous vraiment valider l'équipe "${teamName}" ?`
        );

        if (!confirmed) {
            return;
        }


        try {

            // --------------------------------------------------------
            // CREATION DE L'EQUIPE
            // --------------------------------------------------------

            const teamRef = await adminDb
                .collection("teams")
                .add({

                    teamName: teamName,

                    ownerId: request.userId || null,

                    ownerEmail: request.userEmail || null,

                    members: Array.isArray(request.members)
                        ? request.members
                        : [],

                    memberCount:
                        request.memberCount ||
                        (
                            Array.isArray(request.members)
                                ? request.members.length
                                : 0
                        ),

                    description:
                        request.description || "",

                    discord:
                        request.discord || "",

                    requestId:
                        request.requestId ||
                        request.id,

                    createdAt:
                        firebase.firestore.FieldValue
                            .serverTimestamp(),

                    status: "active"
                });


            // --------------------------------------------------------
            // MISE A JOUR DE LA DEMANDE
            // --------------------------------------------------------

            await adminDb
                .collection("teamRequests")
                .doc(requestId)
                .update({

                    status: "approved",

                    teamId: teamRef.id,

                    processedAt:
                        firebase.firestore.FieldValue
                            .serverTimestamp(),

                    processedBy:
                        currentUser
                            ? currentUser.uid
                            : "system"
                });


            alert(
                `L'équipe "${teamName}" a été validée avec succès.`
            );


            await loadTeamRequests();


        } catch (error) {

            console.error(
                "Erreur validation équipe :",
                error
            );

            alert(
                "Une erreur est survenue lors de la validation de l'équipe."
            );
        }
    }


    // ============================================================
    // OUVRIR MODAL REFUS
    // ============================================================

    function rejectTeamRequest(requestId) {

        const request = requests.find(
            (item) => item.id === requestId
        );

        if (!request) {

            alert("Demande introuvable.");
            return;
        }


        if (getRequestStatus(request) !== "pending") {

            alert("Cette demande a déjà été traitée.");
            return;
        }


        currentRejectRequestId = requestId;


        if (rejectReason) {
            rejectReason.value = "";
        }


        if (rejectModal) {

            rejectModal.classList.add("active");

            rejectModal.style.display = "flex";
        }
    }


    // ============================================================
    // FERMER MODAL REFUS
    // ============================================================

    function closeRejectModalFunction() {

        currentRejectRequestId = null;


        if (rejectReason) {
            rejectReason.value = "";
        }


        if (rejectModal) {

            rejectModal.classList.remove("active");

            rejectModal.style.display = "none";
        }
    }


    // ============================================================
    // CONFIGURATION MODAL
    // ============================================================

    function setupRejectModal() {

        if (confirmReject) {

            confirmReject.addEventListener(
                "click",
                async () => {

                    await confirmRejectRequest();

                }
            );
        }


        if (cancelReject) {

            cancelReject.addEventListener(
                "click",
                () => {

                    closeRejectModalFunction();

                }
            );
        }


        if (closeRejectModal) {

            closeRejectModal.addEventListener(
                "click",
                () => {

                    closeRejectModalFunction();

                }
            );
        }


        if (rejectModal) {

            rejectModal.addEventListener(
                "click",
                (event) => {

                    if (event.target === rejectModal) {

                        closeRejectModalFunction();

                    }

                }
            );
        }
    }


    // ============================================================
    // CONFIRMER REFUS
    // ============================================================

    async function confirmRejectRequest() {

        if (!currentRejectRequestId) {
            return;
        }


        const request = requests.find(
            (item) =>
                item.id === currentRejectRequestId
        );


        if (!request) {

            alert("Demande introuvable.");

            closeRejectModalFunction();

            return;
        }


        const reason =
            rejectReason
                ? rejectReason.value.trim()
                : "";


        try {

            await adminDb
                .collection("teamRequests")
                .doc(currentRejectRequestId)
                .update({

                    status: "rejected",

                    reviewReason:
                        reason ||
                        "Aucune raison indiquée.",

                    reviewedAt:
                        firebase.firestore.FieldValue
                            .serverTimestamp(),

                    reviewedBy:
                        currentUser
                            ? currentUser.uid
                            : "system",

                    processedAt:
                        firebase.firestore.FieldValue
                            .serverTimestamp(),

                    processedBy:
                        currentUser
                            ? currentUser.uid
                            : "system"
                });


            closeRejectModalFunction();


            alert(
                `La demande de l'équipe "${request.teamName || "sans nom"}" a été refusée.`
            );


            await loadTeamRequests();


        } catch (error) {

            console.error(
                "Erreur refus équipe :",
                error
            );

            alert(
                "Une erreur est survenue lors du refus de la demande."
            );
        }
    }


    // ============================================================
    // RECUPERATION DU NOM DU CREATEUR
    // ============================================================

    async function loadCreatorNames() {

        const creatorElements =
            document.querySelectorAll(
                ".creator-name[data-user-id]"
            );


        if (!creatorElements.length) {
            return;
        }


        const alreadyLoaded = new Set();


        for (const element of creatorElements) {

            const userId =
                element.dataset.userId;


            if (
                !userId ||
                userId === "UID non disponible" ||
                alreadyLoaded.has(userId)
            ) {
                continue;
            }


            alreadyLoaded.add(userId);


            try {

                const userDoc = await adminDb
                    .collection("users")
                    .doc(userId)
                    .get();


                if (!userDoc.exists) {
                    continue;
                }


                const userData =
                    userDoc.data();


                // On teste plusieurs noms possibles
                // sans modifier l'UID ou l'email.

                const creatorName =
                    userData.username ||
                    userData.displayName ||
                    userData.name ||
                    userData.pseudo ||
                    userData.playerName ||
                    null;


                if (creatorName) {

                    // Tous les éléments correspondant
                    // au même UID sont mis à jour.

                    document
                        .querySelectorAll(
                            `.creator-name[data-user-id="${CSS.escape(userId)}"]`
                        )
                        .forEach((item) => {

                            item.textContent =
                                creatorName;
                        });
                }


            } catch (error) {

                console.warn(
                    "Impossible de récupérer le nom du créateur :",
                    userId,
                    error
                );
            }
        }
    }


    // ============================================================
    // ECHAPPEMENT HTML
    // ============================================================

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


    // ============================================================
    // ECHAPPEMENT ATTRIBUT
    // ============================================================

    function escapeAttribute(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }


    // ============================================================
    // FORMAT DATE FIREBASE
    // ============================================================

    function formatTimestamp(timestamp) {

        if (!timestamp) {
            return "Date non disponible";
        }


        try {

            let date;


            // Timestamp Firebase
            if (
                timestamp &&
                typeof timestamp.toDate === "function"
            ) {

                date = timestamp.toDate();

            }

            // Date JS
            else if (timestamp instanceof Date) {

                date = timestamp;

            }

            // Timestamp avec seconds
            else if (timestamp.seconds) {

                date = new Date(
                    timestamp.seconds * 1000
                );

            }

            else {

                return "Date non disponible";
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
                "Erreur format date :",
                error
            );

            return "Date non disponible";
        }
    }


    // ============================================================
    // EXPORT GLOBAL POUR LES BOUTONS
    // ============================================================

    window.acceptTeamRequest =
        approveTeamRequest;

    window.rejectTeamRequest =
        rejectTeamRequest;

    window.refreshTeamRequests =
        loadTeamRequests;


    // ============================================================
    // CHARGER LES NOMS APRES RENDU
    // ============================================================

    const originalRenderRequests =
        renderRequests;


    renderRequests = function () {

        originalRenderRequests();

        // Petit délai pour laisser les cartes
        // être ajoutées au DOM.

        setTimeout(() => {

            loadCreatorNames();

        }, 50);
    };

});