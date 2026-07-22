// ====================== CONFIG ======================
const ADMIN_USER = "Iflidiomas";
const ADMIN_PIN = "2026";

import { syllabusInPerson } from "./syllabus-in-person.js";
import { syllabusOnline } from "./syllabus-online.js";
import { syllabusKids } from "./syllabus-kids.js";

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

// Corrección: Usamos getDatabase estándar, pero configuramos el transporte forzado
const db = getDatabase(app);

// FORZAR el uso de Long-Polling si el WebSocket falla
// Esto es un parche interno del SDK para redes restrictivas
if (db._repo) {
  db._repo.persistentConnection_.forceLongPolling_ = true;
}

setTimeout(() => {
  if (db && db._repo) {
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
  // PROTECCIÓN: Solo actualizamos si recibimos datos reales
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
      window.renderStudentsList(searchInput ? searchInput.value : "");
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

// ====================== HELPER FUNCTIONS ======================
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

  // Ocultar todos primero
  [btnBackLogin, btnClose, btnReset, btnDelete].forEach((btn) => {
    if (btn) btn.style.display = "none";
  });

  // Mostrar según vista
  if (view === "list") {
    btnBackLogin.style.display = "block";
  } else if (view === "manage") {
    btnBackLogin.style.display = "block";
    btnClose.style.display = "block";
    btnReset.style.display = "block";
    btnDelete.style.display = "block"; // Asegura que se muestre aquí
  } else if (view === "board") {
    btnBackLogin.style.display = "block";
    btnClose.style.display = "block";
  }
}

// Aseguramos que el evento se asigne una vez cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const deleteBtn = document.getElementById("admin-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      window.deleteStudentProfile();
    });
  }
});
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

    casilla.innerHTML =
      i === 30 && progress[i]
        ? `<span>👑</span>`
        : progress[i]
          ? `<span>🏆</span>`
          : `<span>${i}</span>`;

    casilla.addEventListener("click", () => showCasillaModal(i));
    board.appendChild(casilla);
  }
}

// ====================== MODAL ======================
function showCasillaModal(num) {
  const modal = document.getElementById("casilla-modal");
  if (!modal) return;
  document.getElementById("modal-title").textContent =
    casillaDescriptions[num].title;
  document.getElementById("modal-description").textContent =
    casillaDescriptions[num].desc;
  modal.style.display = "flex";
}

// ====================== ADMIN PANEL FUNCTIONS ======================
window.adminEditStudent = function (key) {
  currentEditingStudentKey = key;
  const student = users[key];
  const container = document.getElementById("students-list");
  if (!student || !container) return;

  updateAdminNavButtons("manage");
  container.innerHTML = "";

  // --- SUSTITUYE DESDE AQUÍ ---
  const titleContainer = document.createElement("div");
  titleContainer.style =
    "text-align: center; width: 100%; margin-bottom: 1.5rem;";

  const title = document.createElement("h3");
  title.style =
    "display: inline-block; color: var(--orange); font-size: 1.8rem; margin: 0;";
  title.innerHTML = `Managing: ${sanitizeInput(student.name)}`;

  titleContainer.appendChild(title);
  container.appendChild(titleContainer);

  // Ajustamos el estilo del contenedor de estadísticas a blanco y texto negro
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
    lockBtn.style = `background: ${unlocked ? "#d32f2f" : "#FF6200"}; color: white; padding: 12px 24px; border: none; border-radius: 12px; font-weight: bold; font-size: 1.05rem; margin: 0; width: auto; min-width: 130px;`;
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

//Botón delete ----------

window.deleteStudentProfile = function () {
  if (currentEditingStudentKey && users[currentEditingStudentKey]) {
    const studentName = users[currentEditingStudentKey].name;

    // Ventana de confirmación
    if (
      confirm(
        `WARNING: Are you sure you want to permanently DELETE the profile for ${studentName}? This action cannot be undone.`,
      )
    ) {
      // Borramos el usuario del objeto local
      delete users[currentEditingStudentKey];

      // Sincronizamos con Firebase
      window.saveUsers();

      // Volvemos a la lista principal
      currentEditingStudentKey = null;
      window.showAdminPanel();
    }
  }
};

window.viewStudentBoard = function (key) {
  const student = users[key];
  if (!student) return;
  updateAdminNavButtons("board");

  // CARGAMOS EL SYLLABUS SEGÚN LA MODALIDAD DEL ESTUDIANTE
  loadStudentSyllabus(student.modality);

  let html = `
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <h3 style="color: var(--orange); font-size: 1.8rem; display: inline-block; text-align: center;">
        Board Progress - ${sanitizeInput(student.name)} (${student.modality || "in-person"})
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

document.getElementById("admin-close-btn").addEventListener("click", () => {
  currentEditingStudentKey = null;
  updateAdminNavButtons("list");
  const searchInput = document.getElementById("search-students");
  window.renderStudentsList(searchInput ? searchInput.value : "");
});

document
  .getElementById("admin-reset-btn")
  .addEventListener("click", window.executeReset);

// ====================== LOGIN & SIGNUP ======================
document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();

  let name = document.getElementById("login-name").value.trim();
  let pin = document.getElementById("login-pin").value.trim();
  const key = (name + pin).toLowerCase().replace(/\s/g, "");

  if (users[key]) {
    currentUser = {
      name: users[key].name,
      key,
      progress: users[key].progress || {},
      modality: users[key].modality || "in-person", // <--- Aquí cargamos la modalidad guardada
    };
    showBoard();
  } else {
    alert("Student not found. Please Sign Up first.");
  }
});

document.getElementById("signup-form").addEventListener("submit", (e) => {
  e.preventDefault();

  let nameInput = document.getElementById("signup-name");
  let pinInput = document.getElementById("signup-pin");

  let name = nameInput ? nameInput.value.trim() : "";
  let pin = pinInput ? pinInput.value.trim() : "";

  // 1. VALIDACIÓN DE NOMBRE
  if (!name) {
    alert("Please enter a student name.");
    if (nameInput) nameInput.focus();
    return;
  }

  // 2. VALIDACIÓN DE PIN
  if (!pin) {
    alert("Please enter a 4-digit PIN.");
    if (pinInput) pinInput.focus();
    return;
  }

  if (pin.length !== 4) {
    alert("PIN must be exactly 4 digits.");
    if (pinInput) pinInput.focus();
    return;
  }

  // 3. VALIDACIÓN DE MODALIDAD
  if (!selectedModality) {
    alert(
      "Please select a study modality (In-Person, Online, or Kids & Teens).",
    );
    return;
  }

  const key = (name + pin).toLowerCase().replace(/\s/g, "");
  if (users[key]) {
    alert("This student already exists.");
    return;
  }

  // GUARDADO CON MODALIDAD
  users[key] = {
    name: name,
    progress: {},
    modality: selectedModality,
  };

  window.saveUsers();

  // MENSAJE DE ÉXITO
  alert("Account created successfully!");

  // Limpiar selección y formulario
  selectedModality = null;
  document.getElementById("signup-form").reset();

  // Resetear colores visuales de los botones de modalidad
  document
    .querySelectorAll(".mod-btn")
    .forEach((btn) => (btn.style.backgroundColor = "#767676"));

  document.getElementById("back-to-login").click();
});

function showBoard() {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("board-screen").classList.add("active");
  document.getElementById("student-name-display").textContent =
    currentUser.name;

  // CARGAMOS EL SYLLABUS CORRESPONDIENTE A SU MODALIDAD
  loadStudentSyllabus(currentUser.modality);

  renderBoard(currentUser.progress);
}

document.getElementById("logout-btn").addEventListener("click", () => {
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

// ====================== ADMIN MAIN VIEW ======================
window.showAdminPanel = function () {
  currentEditingStudentKey = null;
  updateAdminNavButtons("list");
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("admin-screen").classList.add("active");
  window.renderStudentsList();
};

window.renderStudentsList = function (filter = "") {
  const container = document.getElementById("students-list");
  if (!container) return;
  container.innerHTML =
    '<h3 style="text-align: center; margin: 0 auto 1rem auto; max-width: 420px;">Registered Students</h3>';

  Object.keys(users).forEach((key) => {
    const student = users[key];
    if (student.name.toLowerCase().includes(filter.toLowerCase())) {
      const unlockedCount = Object.keys(student.progress || {}).length;

      const div = document.createElement("div");
      div.className = "student-row";
      // Aseguramos que el contenedor de los botones tenga espacio
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.justifyContent = "space-between";

      div.innerHTML = `
    <div class="student-info">
        <strong style="font-size: 1.8rem; display: block; color: #000000;">
            ${sanitizeInput(student.name)}
        </strong>
        <span style="color: #767676; margin-top: 6px; font-size: 1.1rem; display: block;">
            Unlocked: <strong style="color: #767676;">${unlockedCount}/30</strong>
        </span>
    </div>
    <div class="actions" style="display: flex; gap: 10px;"></div>
`;

      const actionsDiv = div.querySelector(".actions");

      // 1. Botón "View Board"
      const viewBtn = document.createElement("button");
      viewBtn.textContent = "Student Board";
      viewBtn.style.background = "#767676"; // Gris
      viewBtn.addEventListener("click", () => window.viewStudentBoard(key));

      // 2. Botón "Manage Student"
      const manageBtn = document.createElement("button");
      manageBtn.textContent = "Manage Student";
      manageBtn.addEventListener("click", () => window.adminEditStudent(key));

      actionsDiv.appendChild(viewBtn);
      actionsDiv.appendChild(manageBtn);
      container.appendChild(div);
    }
  });

  if (Object.keys(users).length === 0) {
    container.innerHTML +=
      '<p style="text-align:center; color:#888; padding: 2rem;">No students registered yet.</p>';
  }
};

document
  .getElementById("search-students")
  .addEventListener("input", (e) => window.renderStudentsList(e.target.value));

// Abrir el modal
document.getElementById("admin-btn").addEventListener("click", () => {
  document.getElementById("admin-login-modal").style.display = "flex";
});

// Cerrar el modal (Cancelar)
document.getElementById("admin-login-cancel").addEventListener("click", () => {
  document.getElementById("admin-login-modal").style.display = "none";
});

// Lógica de validación dentro del modal
document.getElementById("admin-login-submit").addEventListener("click", () => {
  const name = document.getElementById("admin-user-input").value;
  const pin = document.getElementById("admin-pin-input").value;

  if (name === ADMIN_USER && pin === ADMIN_PIN) {
    document.getElementById("admin-login-modal").style.display = "none";
    // Limpiar inputs
    document.getElementById("admin-user-input").value = "";
    document.getElementById("admin-pin-input").value = "";
    window.showAdminPanel();
  } else {
    alert("Incorrect admin credentials.");
  }
});

// --- Lógica para permitir presionar ENTER ---
const adminUserInput = document.getElementById("admin-user-input");
const adminPinInput = document.getElementById("admin-pin-input");
const loginSubmitBtn = document.getElementById("admin-login-submit");

function handleEnterKey(event) {
  if (event.key === "Enter") {
    loginSubmitBtn.click();
  }
}

adminUserInput.addEventListener("keypress", handleEnterKey);
adminPinInput.addEventListener("keypress", handleEnterKey);

// ====================== NAVIGATION ======================
document.getElementById("signup-btn").addEventListener("click", () => {
  document.getElementById("login-screen").classList.remove("active");
  document.getElementById("signup-screen").classList.add("active");
});

document.getElementById("back-to-login").addEventListener("click", () => {
  document.getElementById("signup-screen").classList.remove("active");
  document.getElementById("login-screen").classList.add("active");
});

document.getElementById("admin-back-btn").addEventListener("click", () => {
  document.getElementById("admin-screen").classList.remove("active");
  document.getElementById("login-screen").classList.add("active");
});

document.getElementById("close-modal").addEventListener("click", () => {
  document.getElementById("casilla-modal").style.display = "none";
});

// --- LOGICA DE SELECCION DE MODALIDAD ---
let selectedModality = null;

window.selectModality = function (modality, btnElement) {
  selectedModality = modality;

  // Resetear color de todos los botones de modalidad
  document.querySelectorAll(".mod-btn").forEach((btn) => {
    btn.style.backgroundColor = "#767676"; // Color original
  });

  // Cambiar color del botón seleccionado
  btnElement.style.backgroundColor = "#fe5c14"; // Color naranja primario
};

// ====================== INIT ======================
document.getElementById("login-screen").classList.add("active");
