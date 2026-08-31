// ====================== CONFIG ======================
const ADMIN_USER = "Iflidiomas";
const ADMIN_PIN_BASE64 = "MjAyNg==";

import { syllabusInPerson } from "./syllabus-in-person.js";
import { syllabusOnline } from "./syllabus-online.js";
import { syllabusKids } from "./syllabus-kids.js";
import { termsContent } from "./syllabus-terms.js";

// Objeto contenedor que centraliza los tres syllabus
const syllabiCollection = {
  "in-person": syllabusInPerson,
  online: syllabusOnline,
  kids: syllabusKids,
};

// Variable global activa para las descripciones de las casillas
export let casillaDescriptions = {};

// Función auxiliar para cargar dinámicamente el syllabus según la modalidad
function loadStudentSyllabus(modality) {
  const selectedSyllabus = syllabiCollection[modality] || syllabusInPerson; // Fallback por defecto

  for (let i = 1; i <= 30; i++) {
    casillaDescriptions[i] = selectedSyllabus[i] || {
      title: `Challenge ${i}`,
      desc: `Complete the assigned task for level ${Math.ceil(i / 5)}`,
    };
  }
}

// ====================== AUDIO EFFECTS ======================
const audioYouRock = new Audio("assets/sounds/you_rock.mp3");
const audioYouDidIt = new Audio("assets/sounds/you_did_it.mp3");

function playLevelSound(num) {
  try {
    const sound = num % 3 === 0 ? audioYouDidIt : audioYouRock;
    sound.currentTime = 0; // Reinicia el audio si ya se estaba reproduciendo
    sound.play().catch((error) => {
      console.log(
        "Autoplay de audio bloqueado por políticas del navegador:",
        error,
      );
    });
  } catch (e) {
    console.error("Error al reproducir el efecto de sonido:", e);
  }
}

// ====================== INTEGRACIÓN DE FIREBASE ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCbie2kCYWIlox7Cvs_MYf9HU4JPrCXgFI",
  authDomain: "orange-energy-42100.firebaseapp.com",
  databaseURL: "https://orange-energy-42100-default-rtdb.firebaseio.com",
  projectId: "orange-energy-42100",
  storageBucket: "orange-energy-42100.firebasestorage.app",
  messagingSenderId: "151551658032",
  appId: "1:151551658032:web:0a3a7a6346614f0f69c5f5",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// FORZAR el uso de Long-Polling si el WebSocket falla (protección con optional chaining)
if (db?._repo?.persistentConnection_) {
  db._repo.persistentConnection_.forceLongPolling_ = true;
}

setTimeout(() => {
  if (db?._repo?.persistentConnection_) {
    db._repo.persistentConnection_.forceLongPolling_ = true;
    console.log("Firebase forzado a modo HTTP Long-Polling.");
  }
}, 1000);

// ====================== GLOBAL VARIABLES ======================
let currentUser = null;
let currentEditingStudentKey = null;
let currentAdminView = "list"; // Mantiene constancia de en qué vista del panel estamos
let users = {};

const usersRef = ref(db, "users");

// Escucha activa de cambios en tiempo real adaptada al flujo de vistas
onValue(usersRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    users = data;
    console.log("Datos cargados correctamente");
  } else {
    console.warn(
      "Firebase devolvió datos vacíos, no sobrescribiremos la variable local.",
    );
  }

  const adminScreen = document.getElementById("admin-screen");
  if (adminScreen && adminScreen.classList.contains("active")) {
    if (currentAdminView === "list") {
      const searchInput = document.getElementById("search-students");
      const modalitySelect = document.getElementById("filter-modality");
      window.renderStudentsList(
        searchInput ? searchInput.value : "",
        modalitySelect ? modalitySelect.value : "",
      );
    } else if (currentAdminView === "manage" && currentEditingStudentKey) {
      window.adminEditStudent(currentEditingStudentKey);
    } else if (currentAdminView === "board" && currentEditingStudentKey) {
      window.viewStudentBoard(currentEditingStudentKey);
    }
  }

  if (currentUser && users[currentUser.key]) {
    currentUser.progress = users[currentUser.key].progress || {};
    const boardView = document.getElementById("student-board-view");
    if (boardView) {
      renderBoard(currentUser.progress, "student-board-view");
    } else {
      renderBoard(currentUser.progress, "game-board");
    }
  }
});

window.saveUsers = function () {
  set(usersRef, users)
    .then(() => console.log("¡Datos sincronizados con Firebase con éxito!"))
    .catch((error) =>
      console.error("Error crítico al guardar en Firebase:", error),
    );
};

// ====================== LANGUAGE SELECTOR ======================
export let currentLang = localStorage.getItem("app_lang") || "en";

window.setLanguage = function (lang) {
  currentLang = lang;
  localStorage.setItem("app_lang", lang);

  // Actualiza la clase 'active' en la bandera seleccionada
  document.querySelectorAll(".lang-flag").forEach((btn) => {
    btn.classList.remove("active");
  });

  const selectedBtn = document.getElementById(`lang-${lang}`);
  if (selectedBtn) {
    selectedBtn.classList.add("active");
  }

  console.log(`Idioma activado: ${lang}`);

  // Próximamente llamaremos aquí a la función de traducción
  // updateAppLanguage(lang);
};

// ====================== HELPER FUNCTIONS ======================

function formatModalityName(modality) {
  if (modality === "kids") return "Kids & Teens";
  if (modality === "online") return "Online";
  return "In-Person";
}

function sanitizeInput(text) {
  const element = document.createElement("div");
  element.innerText = text;
  return element.innerHTML;
}

function updateAdminNavButtons(view) {
  currentAdminView = view;
  const btnBackLogin = document.getElementById("admin-back-btn");
  const btnClose = document.getElementById("admin-close-btn");
  const btnReset = document.getElementById("admin-reset-btn");
  const btnDelete = document.getElementById("admin-delete-btn");

  [btnBackLogin, btnClose, btnReset, btnDelete].forEach((btn) => {
    if (btn) btn.style.display = "none";
  });

  const navActionsContainer = document.querySelector(".admin-nav-actions");

  if (view === "list") {
    if (btnBackLogin) btnBackLogin.style.display = "block";
    if (navActionsContainer)
      navActionsContainer.classList.remove("managing-active");
  } else if (view === "manage") {
    if (btnBackLogin) btnBackLogin.style.display = "block";
    if (btnClose) btnClose.style.display = "block";
    if (btnReset) btnReset.style.display = "block";
    if (btnDelete) btnDelete.style.display = "block";

    if (navActionsContainer)
      navActionsContainer.classList.add("managing-active");
  } else if (view === "board") {
    if (btnBackLogin) btnBackLogin.style.display = "block";
    if (btnClose) btnClose.style.display = "block";
    if (navActionsContainer)
      navActionsContainer.classList.remove("managing-active");
  }
}

// ====================== RENDER BOARD ======================

function renderBoard(progress = {}, containerId = "game-board") {
  const board =
    document.getElementById(containerId) ||
    document.getElementById("game-board");
  if (!board) return;
  board.innerHTML = "";

  for (let i = 1; i <= 30; i++) {
    const casilla = document.createElement("div");
    casilla.className = `casilla ${progress[i] ? "unlocked" : "locked"}`;

    if ([5, 10, 15, 20, 25].includes(i)) casilla.classList.add("special");
    if (i === 30) casilla.classList.add("final");

    if (progress[i]) {
      casilla.innerHTML = `<img src="assets/stickers/sticker_${i}.png" alt="Sticker ${i}" style="width: 80%; height: 80%; object-fit: contain; pointer-events: none;" />`;
    } else {
      casilla.innerHTML = `<span>${i}</span>`;
    }

    const isUnlocked = !!progress[i];
    casilla.addEventListener("click", () => showCasillaModal(i, isUnlocked));
    board.appendChild(casilla);
  }

  // BOTÓN TERMS AND CONDITIONS
  const boardContainer =
    board.closest(".board-container") || board.parentElement;
  if (boardContainer) {
    let termsWrapper =
      boardContainer.parentNode.querySelector(".terms-wrapper");
    if (!termsWrapper) {
      termsWrapper = document.createElement("div");
      termsWrapper.className = "terms-wrapper";
      termsWrapper.style = "margin: 1.5rem 0; text-align: center;";

      const termsBtn = document.createElement("button");
      termsBtn.id = "terms-btn";
      termsBtn.className = "terms-btn";
      termsBtn.textContent = "Terms and Conditions";

      termsBtn.addEventListener("click", () => {
        const modal = document.getElementById("casilla-modal");
        const modalTitle = document.getElementById("modal-title");
        const modalDesc = document.getElementById("modal-description");
        if (modalTitle) modalTitle.textContent = termsContent.title;
        if (modalDesc) modalDesc.textContent = termsContent.description;
        if (modal) modal.style.display = "flex";
      });

      termsWrapper.appendChild(termsBtn);
      boardContainer.parentNode.insertBefore(
        termsWrapper,
        boardContainer.nextSibling,
      );
    }
  }
}

// ====================== MODAL CON EFECTO DE CONFETÍ Y SONIDO ======================
function showCasillaModal(num, isUnlocked = false) {
  const modal = document.getElementById("casilla-modal");
  if (!modal) return;

  const data =
    casillaDescriptions && casillaDescriptions[num]
      ? casillaDescriptions[num]
      : { title: `Challenge ${num}`, desc: "Description not available." };

  const modalContent = modal.querySelector(".modal-content");
  if (modalContent) {
    modalContent.innerHTML = `
      <span id="close-modal" class="close">&times;</span>
      <div class="modal-sticker-container">
        <img src="assets/stickers/sticker_${num}.png" alt="Sticker ${num}" class="modal-sticker-img" />
      </div>
      <h3 id="modal-title">${sanitizeInput(data.title)}</h3>
      <p id="modal-description">${sanitizeInput(data.desc)}</p>
    `;

    const closeBtn = modalContent.querySelector("#close-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
        if (typeof isSuccessModal !== "undefined" && isSuccessModal) {
          isSuccessModal = false;
          const backLogin = document.getElementById("back-to-login");
          if (backLogin) backLogin.click();
        }
      });
    }
  }

  modal.style.display = "flex";

  // Efectos de sonido y confetí al abrir casilla desbloqueada
  if (isUnlocked) {
    playLevelSound(num);

    if (typeof confetti === "function") {
      setTimeout(() => {
        if (modal.style.display === "flex") {
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = {
            startVelocity: 30,
            spread: 360,
            ticks: 60,
            zIndex: 99999,
          };

          function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
          }

          const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            confetti(
              Object.assign({}, defaults, {
                particleCount,
                origin: {
                  x: randomInRange(0.4, 0.6),
                  y: randomInRange(0.4, 0.6),
                },
                colors: ["#fe5c14", "#079cff", "#ffd700", "#ffffff"],
              }),
            );
          }, 250);
        }
      }, 300);
    }
  }
}

// ====================== ADMIN PANEL FUNCTIONS ======================
window.adminEditStudent = function (key) {
  currentEditingStudentKey = key;
  const student = users[key];
  const container = document.getElementById("students-list");
  if (!student || !container) return;

  updateAdminNavButtons("manage");
  container.innerHTML = "";

  const titleContainer = document.createElement("div");
  titleContainer.style =
    "text-align: center; width: 100%; margin-bottom: 1.5rem;";

  const title = document.createElement("h3");
  title.style =
    "display: inline-block; color: var(--orange); font-size: 1.8rem; margin: 0;";

  const formattedModality = formatModalityName(student.modality);
  title.innerHTML = `Managing: ${sanitizeInput(student.name)} (${formattedModality})`;

  titleContainer.appendChild(title);
  container.appendChild(titleContainer);

  const statsDiv = document.createElement("div");
  statsDiv.style =
    "display: flex; align-items: center; justify-content: space-between; background: #ffffff; padding: 16px 20px; border: 1px solid #898989; border-radius: 14px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; color: #000000;";
  statsDiv.innerHTML = `
    <span style="font-size: 2rem; font-weight: bold; color: #000000;">
      Progress: <strong>${Object.keys(student.progress || {}).length} / 30</strong>
    </span>
  `;

  const viewBoardBtn = document.createElement("button");
  viewBoardBtn.style =
    "background: #767676; padding: 12px 26px; font-size: 1.1rem; border-radius: 12px; width: auto; margin: 0;";
  viewBoardBtn.textContent = "Student Board";
  viewBoardBtn.addEventListener("click", () => window.viewStudentBoard(key));

  statsDiv.appendChild(viewBoardBtn);
  container.appendChild(statsDiv);

  const manageList = document.createElement("div");
  manageList.id = "manage-list";

  for (let i = 1; i <= 30; i++) {
    const unlocked = !!(student.progress && student.progress[i]);
    const row = document.createElement("div");
    row.id = `manage-row-${i}`;
    row.style =
      "display: flex; align-items: center; justify-content: space-between; background: #2a2a2a; padding: 18px 20px; margin-bottom: 10px; border-radius: 14px; border: 1px solid #444; flex-wrap: wrap; gap: 10px;";

    row.innerHTML = `
      <span style="font-size: 1.4rem; font-weight: 600;">
          Stage ${i}
          ${[5, 10, 15, 20, 25].includes(i) ? " <span style='color:#ffd700'>⭐ Special</span>" : ""}
          ${i === 30 ? " <span style='color:#ffd700'>🏆 Final</span>" : ""}
      </span>
    `;

    const lockBtn = document.createElement("button");
    lockBtn.style = `background: ${unlocked ? "#960707" : "#FF6200"}; color: white; padding: 12px 24px; border: none; border-radius: 12px; font-weight: bold; font-size: 1.05rem; margin: 0; width: auto; min-width: 130px;`;
    lockBtn.textContent = unlocked ? "🔒 Lock" : "🔓 Unlock";

    lockBtn.addEventListener("click", () => window.toggleCasilla(key, i));

    row.appendChild(lockBtn);
    manageList.appendChild(row);
  }

  container.appendChild(manageList);
};

window.toggleCasilla = function (key, num) {
  if (!users[key]) return;
  if (!users[key].progress) users[key].progress = {};

  if (users[key].progress[num]) {
    delete users[key].progress[num];
  } else {
    users[key].progress[num] = true;
  }

  window.saveUsers();
  window.adminEditStudent(key);
};

window.executeReset = function () {
  if (currentEditingStudentKey && users[currentEditingStudentKey]) {
    const studentName = users[currentEditingStudentKey].name;
    if (
      confirm(
        `Reset ALL progress for ${sanitizeInput(studentName)}? This cannot be undone.`,
      )
    ) {
      users[currentEditingStudentKey].progress = {};
      window.saveUsers();
      window.adminEditStudent(currentEditingStudentKey);
    }
  }
};

window.deleteStudentProfile = function () {
  if (currentEditingStudentKey && users[currentEditingStudentKey]) {
    const studentName = users[currentEditingStudentKey].name;

    if (
      confirm(
        `WARNING: Are you sure you want to permanently DELETE the profile for ${studentName}? This action cannot be undone.`,
      )
    ) {
      delete users[currentEditingStudentKey];
      window.saveUsers();
      currentEditingStudentKey = null;
      window.showAdminPanel();
    }
  }
};

window.viewStudentBoard = function (key) {
  const student = users[key];
  if (!student) return;
  updateAdminNavButtons("board");

  loadStudentSyllabus(student.modality);

  const formattedModality = formatModalityName(student.modality);

  let html = `
    <div style="text-align: center; margin-bottom: 1rem;">
      <h3 style="color: var(--orange); font-size: 1.8rem; display: inline-block; text-align: center;">
        Board Progress - ${sanitizeInput(student.name)} (${formattedModality})
      </h3>
    </div>
    <div class="board-container" style="margin: 0 auto; max-width: 1300px;">
      <div id="student-board-view" class="game-board"></div>
    </div>
  `;
  document.getElementById("students-list").innerHTML = html;

  setTimeout(
    () => renderBoard(student.progress || {}, "student-board-view"),
    50,
  );
};

// ====================== LOGIN & SIGNUP ======================
let isSuccessModal = false;
let selectedModality = null;

function showBoard() {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("board-screen")?.classList.add("active");

  const nameDisplay = document.getElementById("student-name-display");
  if (nameDisplay) nameDisplay.textContent = currentUser.name;

  loadStudentSyllabus(currentUser.modality);
  renderBoard(currentUser.progress);
}

// ====================== ADMIN MAIN VIEW ======================
window.showAdminPanel = function () {
  currentEditingStudentKey = null;
  updateAdminNavButtons("list");
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("admin-screen")?.classList.add("active");

  const searchInput = document.getElementById("search-students");
  const modalitySelect = document.getElementById("filter-modality");
  if (searchInput) searchInput.value = "";
  if (modalitySelect) modalitySelect.value = "";

  window.renderStudentsList();
};

function triggerFilter() {
  const text = document.getElementById("search-students")?.value || "";
  const modality = document.getElementById("filter-modality")?.value || "";
  window.renderStudentsList(text, modality);
}

window.renderStudentsList = function (
  filter = "",
  selectedModalityFilter = "",
) {
  const container = document.getElementById("students-list");
  if (!container) return;

  container.innerHTML = "";

  const totalStudents = Object.keys(users).length;
  let matchCount = 0;

  Object.keys(users).forEach((key) => {
    const student = users[key];
    const nameMatches = student.name
      .toLowerCase()
      .includes(filter.toLowerCase());
    const modalityMatches =
      !selectedModalityFilter || student.modality === selectedModalityFilter;

    if (nameMatches && modalityMatches) {
      matchCount++;
    }
  });

  const statsHeader = document.createElement("div");
  statsHeader.style =
    "background: linear-gradient(135deg, rgba(117, 117, 117, 0.8), rgba(151, 151, 151, 0.5)); padding: 14px 20px; border: 1px solid #898989; border-radius: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; color: #000000; flex-wrap: wrap; gap: 10px;";

  let statsHtml = `
    <span style="font-size: 1.2rem; font-weight: bold;">
      Students: <strong style="color: var(--orange);">${totalStudents}</strong>
    </span>
  `;

  if (selectedModalityFilter || filter) {
    const activeModalityText = selectedModalityFilter
      ? formatModalityName(selectedModalityFilter)
      : "All Modalities";
    statsHtml += `
      <span style="font-size: 1.1rem; font-weight: bold; color: #555555;">
        (${activeModalityText}): <strong style="color: var(--orange);">${matchCount}</strong>
      </span>
    `;
  }
  statsHeader.innerHTML = statsHtml;
  container.appendChild(statsHeader);

  let renderMatchCounter = 0;
  Object.keys(users).forEach((key) => {
    const student = users[key];
    const nameMatches = student.name
      .toLowerCase()
      .includes(filter.toLowerCase());
    const modalityMatches =
      !selectedModalityFilter || student.modality === selectedModalityFilter;

    if (nameMatches && modalityMatches) {
      renderMatchCounter++;
      const unlockedCount = Object.keys(student.progress || {}).length;
      const formattedModality = formatModalityName(student.modality);

      const div = document.createElement("div");
      div.className = "student-row";

      div.innerHTML = `
        <div class="student-info">
            <strong style="font-size: 1.8rem; display: block; color: #000000;">
                ${sanitizeInput(student.name)}
            </strong>
            <span style="color: #767676; margin-top: 4px; font-size: 1.1rem; display: block;">
                Modality: <strong style="color: var(--orange);">${formattedModality}</strong> | Unlocked: <strong style="color: #767676;">${unlockedCount}/30</strong>
            </span>
        </div>
        <div class="actions" style="display: flex; gap: 10px;"></div>
      `;

      const actionsDiv = div.querySelector(".actions");

      const viewBtn = document.createElement("button");
      viewBtn.textContent = "Student Board";
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.viewStudentBoard(key);
      });

      const manageBtn = document.createElement("button");
      manageBtn.textContent = "Manage Student";
      manageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.adminEditStudent(key);
      });

      actionsDiv.appendChild(viewBtn);
      actionsDiv.appendChild(manageBtn);
      container.appendChild(div);
    }
  });

  if (renderMatchCounter === 0) {
    container.innerHTML += `
      <p style="text-align:center; color:#888; padding: 2rem;">No students found matching the criteria.</p>
    `;
  }
};

window.selectModality = function (modality, btnElement) {
  selectedModality = modality;

  document.querySelectorAll(".mod-btn").forEach((btn) => {
    btn.style.backgroundColor = "#767676";
  });

  if (btnElement) btnElement.style.backgroundColor = "#fe5c14";
};

window.togglePasswordVisibility = function (inputId, iconElement) {
  const inputField = document.getElementById(inputId);
  if (!inputField) return;

  if (inputField.type === "password") {
    inputField.type = "text";
    iconElement.textContent = "👁️‍🗨️";
  } else {
    inputField.type = "password";
    iconElement.textContent = "👁️";
  }
};

// ====================== EVENT INITIALIZATION ======================
document.addEventListener("DOMContentLoaded", () => {
  // Configuración de pantalla inicial
  const loginScreen = document.getElementById("login-screen");
  if (loginScreen) loginScreen.classList.add("active");

  // Botón Borrar en Admin
  const deleteBtn = document.getElementById("admin-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      window.deleteStudentProfile();
    });
  }

  // Cierre y Reset en Admin
  const closeAdminBtn = document.getElementById("admin-close-btn");
  if (closeAdminBtn) {
    closeAdminBtn.addEventListener("click", () => {
      currentEditingStudentKey = null;
      updateAdminNavButtons("list");
      triggerFilter();
    });
  }

  const resetAdminBtn = document.getElementById("admin-reset-btn");
  if (resetAdminBtn) {
    resetAdminBtn.addEventListener("click", window.executeReset);
  }

  // Filtros de búsqueda y modalidad
  const searchInput = document.getElementById("search-students");
  const modalitySelect = document.getElementById("filter-modality");
  if (searchInput) searchInput.addEventListener("input", triggerFilter);
  if (modalitySelect) modalitySelect.addEventListener("change", triggerFilter);

  // Formularios de Login y Registro
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      let name = document.getElementById("login-name").value.trim();
      let pin = document.getElementById("login-pin").value.trim();
      const key = (name + pin).toLowerCase().replace(/\s/g, "");

      if (users[key]) {
        currentUser = {
          name: users[key].name,
          key,
          progress: users[key].progress || {},
          modality: users[key].modality || "in-person",
        };
        showBoard();
      } else {
        alert("Student not found. Please Sign Up first.");
      }
    });
  }

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();

      let nameInput = document.getElementById("signup-name");
      let pinInput = document.getElementById("signup-pin");

      let name = nameInput ? nameInput.value.trim() : "";
      let pin = pinInput ? pinInput.value.trim() : "";

      const modal = document.getElementById("casilla-modal");
      const modalTitle = document.getElementById("modal-title");
      const modalDesc = document.getElementById("modal-description");

      function showSignupAlert(title, message, success = false) {
        if (!modal) return;
        if (modalTitle) modalTitle.textContent = title;
        if (modalDesc) modalDesc.textContent = message;
        modal.style.display = "flex";
        isSuccessModal = success;
      }

      if (!name) {
        showSignupAlert("Incomplete Data", "Please enter a student name.");
        if (nameInput) nameInput.focus();
        return;
      }

      if (!pin) {
        showSignupAlert("Incomplete Data", "Please enter a 4-digit PIN.");
        if (pinInput) pinInput.focus();
        return;
      }

      if (pin.length !== 4) {
        showSignupAlert("Invalid PIN", "PIN must be exactly 4 digits.");
        if (pinInput) pinInput.focus();
        return;
      }

      if (!selectedModality) {
        showSignupAlert(
          "Modality Required",
          "Please select a study modality (In-Person, Online, or Kids & Teens).",
        );
        return;
      }

      const key = (name + pin).toLowerCase().replace(/\s/g, "");
      if (users[key]) {
        showSignupAlert("Account Exists", "This student already exists.");
        return;
      }

      users[key] = {
        name: name,
        progress: {},
        modality: selectedModality,
      };

      window.saveUsers();
      showSignupAlert("Success!", "Account created successfully!", true);

      selectedModality = null;
      signupForm.reset();

      document
        .querySelectorAll(".mod-btn")
        .forEach((btn) => (btn.style.backgroundColor = "#767676"));
    });
  }

  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      currentUser = null;
      document.getElementById("login-name").value = "";
      document.getElementById("login-pin").value = "";

      document
        .querySelectorAll(".screen")
        .forEach((s) => s.classList.remove("active"));
      document.getElementById("login-screen").classList.add("active");

      const gameBoard = document.getElementById("game-board");
      if (gameBoard) gameBoard.innerHTML = "";
    });
  }

  // Autenticación de Admin
  const adminBtn = document.getElementById("admin-btn");
  if (adminBtn) {
    adminBtn.addEventListener("click", () => {
      const modal = document.getElementById("admin-login-modal");
      if (modal) modal.style.display = "flex";
    });
  }

  const adminCancelBtn = document.getElementById("admin-login-cancel");
  if (adminCancelBtn) {
    adminCancelBtn.addEventListener("click", () => {
      const modal = document.getElementById("admin-login-modal");
      if (modal) modal.style.display = "none";
    });
  }

  const adminSubmitBtn = document.getElementById("admin-login-submit");
  if (adminSubmitBtn) {
    adminSubmitBtn.addEventListener("click", () => {
      const name = document.getElementById("admin-user-input").value;
      const pin = document.getElementById("admin-pin-input").value;

      if (name === ADMIN_USER && pin === atob(ADMIN_PIN_BASE64)) {
        document.getElementById("admin-login-modal").style.display = "none";
        document.getElementById("admin-user-input").value = "";
        document.getElementById("admin-pin-input").value = "";
        window.showAdminPanel();
      } else {
        alert("Incorrect admin credentials.");
      }
    });
  }

  const adminUserInput = document.getElementById("admin-user-input");
  const adminPinInput = document.getElementById("admin-pin-input");

  function handleEnterKey(event) {
    if (event.key === "Enter" && adminSubmitBtn) {
      adminSubmitBtn.click();
    }
  }

  if (adminUserInput)
    adminUserInput.addEventListener("keypress", handleEnterKey);
  if (adminPinInput) adminPinInput.addEventListener("keypress", handleEnterKey);

  // Navegación Básica
  const signupBtn = document.getElementById("signup-btn");
  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      document.getElementById("login-screen").classList.remove("active");
      document.getElementById("signup-screen").classList.add("active");
    });
  }

  const backToLoginBtn = document.getElementById("back-to-login");
  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
      document.getElementById("signup-screen").classList.remove("active");
      document.getElementById("login-screen").classList.add("active");
    });
  }

  const adminBackBtn = document.getElementById("admin-back-btn");
  if (adminBackBtn) {
    adminBackBtn.addEventListener("click", () => {
      document.getElementById("admin-screen").classList.remove("active");
      document.getElementById("login-screen").classList.add("active");
    });
  }

  const closeModalBtn = document.getElementById("close-modal");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      const modal = document.getElementById("casilla-modal");
      if (modal) modal.style.display = "none";

      if (isSuccessModal) {
        isSuccessModal = false;
        const backBtn = document.getElementById("back-to-login");
        if (backBtn) backBtn.click();
      }
    });
  }
});
