console.log("🏆 Team chargé");

let currentUser = null;
let currentTeam = null;

const urlParams = new URLSearchParams(window.location.search);
const teamId = urlParams.get("id");

// ======================================================
// AUTHENTIFICATION & INITIALISATION
// ======================================================
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    await loadTeam();
});

// ======================================================
// CHARGEMENT DE L'ÉQUIPE
// ======================================================
async function loadTeam() {
    const loader = document.getElementById("teamLoader");

    if (!teamId) {
        showTeamError();
        return;
    }

    try {
        const teamRef = db.collection("teams").doc(teamId);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            showTeamError();
            return;
        }

        currentTeam = {
            id: teamDoc.id,
            ...teamDoc.data()
        };

        displayTeam(currentTeam);
        await loadTeamMembers();

        if (loader) {
            loader.classList.add("hidden");
        }

    } catch (error) {
        console.error("Erreur chargement équipe :", error);
        showTeamError();
    }
}

// ======================================================
// AFFICHAGE DES INFORMATIONS DE L'ÉQUIPE (VERSION CORRIGÉE)
// ======================================================

function displayTeam(team) {

    const teamName =
        document.getElementById("teamName");

    const teamFullDescription =
        document.getElementById("teamFullDescription");

    const teamLogo =
        document.getElementById("teamLogo");

    const teamBanner =
        document.getElementById("teamBanner");

    const teamDiscord =
        document.getElementById("teamDiscord");

    const teamMembersCount =
        document.getElementById("teamMembersCount");

    const teamTournaments =
        document.getElementById("teamTournaments");

    const teamVictories =
        document.getElementById("teamVictories");

    const teamEarnings =
        document.getElementById("teamEarnings");

    const teamRank =
        document.getElementById("teamRank");


    // NOM
    if (teamName) {
        teamName.innerText = team.name || "Équipe sans nom";
    }

    // DESCRIPTION
    if (teamFullDescription) {
        teamFullDescription.innerText = team.description || "Aucune description.";
    }

    // LOGO
    if (teamLogo) {
        teamLogo.src = team.logo || "https://dicebear.com" + encodeURIComponent(team.name || "team");
        teamLogo.style.display = "block";
    }

    // BANNIÈRE
    if (teamBanner) {
        const bannerUrl = team.banner || "https://unsplash.com";
        teamBanner.style.backgroundImage = "url('" + bannerUrl + "')";
    }

    // DISCORD
    if (teamDiscord) {
        if (team.discord) {
            teamDiscord.href = team.discord;
        } else {
            const discordCard = document.getElementById("teamDiscordCard");
            if (discordCard) discordCard.style.display = "none";
        }
    }

    // MEMBRES
    if (teamMembersCount) {
        teamMembersCount.innerText = team.memberCount || team.membersCount || (Array.isArray(team.members) ? team.members.length : 0);
    }

    // TOURNOIS
    if (teamTournaments) {
        teamTournaments.innerText = team.tournamentsPlayed || team.tournaments || 0;
    }

    // VICTOIRES
    if (teamVictories) {
        teamVictories.innerText = team.victories || team.wins || 0;
    }

    // GAINS
    if (teamEarnings) {
        const earnings = Number(team.earnings || team.totalEarnings || team.winnings || 0);
        teamEarnings.innerText = earnings.toFixed(2) + " €";
    }

    // CLASSEMENT
    if (teamRank) {
        if (team.currentSeasonRank) {
            teamRank.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:4px; align-items: center; justify-content: center;">
                    <span style="color:#ffd000; font-weight:950;">#${team.currentSeasonRank} (Saison 1)</span>
                    <small style="font-size:10px; opacity:0.5;">Global: #${team.rank || '-'}</small>
                </div>
            `;
        } else if (team.rank) {
            teamRank.innerText = "#" + team.rank;
        } else {
            teamRank.innerText = "-";
        }
    }

}


// ======================================================
// CHARGEMENT DES MEMBRES OBLIGATOIRE (SÉPARÉ ET ACCESSIBLE)
// ======================================================

async function loadTeamMembers() {

    const container =
        document.getElementById("teamMembers");

    const counter =
        document.getElementById("membersCounter");


    if (!container) return;


    try {

        const members = currentTeam.members || [];
        container.innerHTML = "";


        if (!Array.isArray(members) || members.length === 0) {

            container.innerHTML = `
                <div class="team-loading">
                    <span>Aucun membre dans cette équipe.</span>
                </div>
            `;

            if (counter) counter.innerText = "0 membres";
            return;

        }


        if (counter) {
            counter.innerText = members.length + (members.length > 1 ? " membres" : " membre");
        }


        for (const member of members) {
            await addMemberCard(container, member);
        }

        // Relance les écouteurs d'exclusion après l'injection
        if (typeof initKickEventListeners === "function") {
            initKickEventListeners();
        }


    } catch (error) {

        console.error("Erreur chargement membres :", error);
        container.innerHTML = `
            <div class="team-loading">
                <span>Impossible de charger les membres.</span>
            </div>
        `;

    }
}
// ======================================================
// CARTE D'UN MEMBRE
// ======================================================
async function addMemberCard(container, member) {
    let memberData = {};
    let uid = null;
    let pseudo = null;

    if (typeof member === "string") {
        uid = member;
    } else if (member && typeof member === "object") {
        uid = member.uid || member.id || null;
        pseudo = member.pseudo || member.username || member.name || null;
        memberData = member;
    }

    try {
        if (uid) {
            const userDoc = await db.collection("users").doc(uid).get();
            if (userDoc.exists) {
                memberData = { ...memberData, ...userDoc.data() };
            }
        }
    } catch (error) {
        console.warn("Impossible de charger le profil du membre :", uid, error);
    }

    pseudo = memberData.pseudo || memberData.username || memberData.displayName || pseudo || memberData.email || "Joueur";

    const founderUid = currentTeam.founderUid || currentTeam.creatorUid || currentTeam.ownerUid || currentTeam.createdBy || null;
    const isFounder = uid && founderUid && uid === founderUid;

    const badge = getMemberBadge(memberData);
    const avatar = getMemberAvatar(memberData);

    const card = document.createElement("div");
    card.className = "team-member-card";

    let avatarHTML = avatar 
        ? `<img src="${escapeHTML(avatar)}" alt="Avatar">` 
        : `<span>${escapeHTML(pseudo.charAt(0).toUpperCase())}</span>`;

    let badgeHTML = badge ? `<img src="${escapeHTML(badge)}" alt="Badge" class="member-badge">` : "";
    let roleHTML = isFounder ? `<span class="member-role">Fondateur</span>` : "";

    // BOUTON EXCLURE (PROPRIÉTAIRE UNIQUEMENT)
    let kickButtonHTML = "";
    if (currentUser && founderUid && currentUser.uid === founderUid) {
        if (uid !== founderUid) {
            kickButtonHTML = `
                <button class="kick-member-btn" data-member-value="${escapeHTML(String(member))}" data-member-pseudo="${escapeHTML(pseudo)}">
                    Exclure
                </button>
            `;
        }
    }

    card.innerHTML = `
        <div class="member-avatar">${avatarHTML}</div>
        <div class="member-information">
            <span class="member-name">${escapeHTML(pseudo)}</span>
            ${roleHTML}
        </div>
        <div class="member-badge-wrapper" style="display: flex; align-items: center; gap: 15px; margin-left: auto;">
            ${badgeHTML}
            ${kickButtonHTML}
        </div>
    `;

    container.appendChild(card);
}

// ======================================================
// CONFIGURATION DES BADGES
// ======================================================
function getMemberBadge(data) {
    if (!data) return null;
    if (data.badge) return data.badge;
    if (data.rankBadge) return data.rankBadge;
    if (data.leagueBadge) return data.leagueBadge;

    const rank = data.leagueRank || data.rank || data.league || "Bronze";
    const badges = {
        Bronze: "bronze.png",
        Silver: "silver.png",
        Gold: "gold.png",
        Platinum: "platinum.png",
        Diamond: "diamond.png",
        Champion: "champion.png",
        Legend: "legend.png"
    };

    return badges[rank] || "bronze.png";
}

function getMemberAvatar(data) {
    if (!data) return null;
    return data.photoURL || data.avatar || data.avatarUrl || data.profileImage || null;
}

function showTeamError() {
    const loader = document.getElementById("teamLoader");
    const error = document.getElementById("teamError");
    if (loader) loader.classList.add("hidden");
    if (error) error.style.display = "flex";
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
