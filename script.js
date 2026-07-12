// ====================== CONFIG ======================
const ADMIN_USER = "Iflidiomas";
const ADMIN_PIN = "2026";

const casillaDescriptions = {
  1: {
    title: "Challenge 1",
    desc: "Introduce yourself in English (video or audio)",
  },
  5: {
    title: "Milestone 5",
    desc: "Complete your first full conversation practice",
  },
  10: { title: "Milestone 10", desc: "Read and record a short story" },
  15: {
    title: "Milestone 15",
    desc: "Write and present a paragraph about your goals",
  },
  20: { title: "Milestone 20", desc: "Intermediate listening + speaking test" },
  25: {
    title: "Milestone 25",
    desc: "Create a 2-minute presentation in English",
  },
  30: {
    title: "FINAL GRAND PRIZE",
    desc: "Complete the full course challenge and receive your certificate!",
  },
};

for (let i = 1; i <= 30; i++) {
  if (!casillaDescriptions[i]) {
    casillaDescriptions[i] = {
      title: `Challenge ${i}`,
      desc: `Complete the assigned task for level ${Math.ceil(i / 5)}`,
    };
  }
}

// ====================== INTEGRACIÓN DE FIREBASE ======================
// Importamos los módulos necesarios de Firebase a través de CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// !!! REEMPLAZA ESTE OBJETO CON LAS CREDENCIALES EXACTAS DE TU PROYECTO DE FIREBASE !!! Reemplazado..
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCbie2kCYWIlox7Cvs_MYf9HU4JPrCXgFI",
  authDomain: "orange-energy-42100.firebaseapp.com",
  databaseURL: "https://orange-energy-42100-default-rtdb.firebaseio.com",
  projectId: "orange-energy-42100",
  storageBucket: "orange-energy-42100.firebasestorage.app",
  messagingSenderId: "151551658032",
  appId: "1:151551658032:web:0a3a7a6346614f0f69c5f5",
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ====================== GLOBAL VARIABLES ======================
let currentUser = null;
let currentEditingStudentKey = null;
let users = {}; // Ahora se llenará en tiempo real desde Firebase

// Escucha activa de la base de datos (Sincronización en tiempo real)
const usersRef = ref(db, "users");
onValue(usersRef, (snapshot) => {
  const data = snapshot.val();
  users = data || {};

  // Si el administrador está viendo la lista de estudiantes, la actualiza en tiempo real
  const adminScreen = document.getElementById("admin-screen");
  if (
    adminScreen &&
    adminScreen.classList.contains("active") &&
    !currentEditingStudentKey
  ) {
    renderStudentsList(document.getElementById("search-students").value);
  }

  // Si el estudiante tiene su tablero abierto, actualiza sus casillas si el admin las cambia
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

// Reemplazamos el antiguo LocalStorage por Firebase
function saveUsers() {
  set(ref(db, "users"), users);
}

// ====================== HELPER FUNCTIONS ======================
function sanitizeInput(text) {
  const element = document.createElement("div");
  element.innerText = text;
  return element.innerHTML;
}

function updateAdminNavButtons(view) {
  const btnBackLogin = document.getElementById("admin-back-btn");
  const btnClose = document.getElementById("admin-close-btn");
  const btnReset = document.getElementById("admin-reset-btn");

  btnBackLogin.style.display = "none";
  btnClose.style.display = "none";
  btnReset.style.display = "none";

  if (view === "list") {
    btnBackLogin.style.display = "block";
  } else if (view === "manage") {
    btnBackLogin.style.display = "block";
    btnClose.style.display = "block";
    btnReset.style.display = "block";
  } else if (view === "board") {
    btnBackLogin.style.display = "block";
    btnClose.style.display = "block";
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
  document.getElementById("modal-title").textContent =
    casillaDescriptions[num].title;
  document.getElementById("modal-description").textContent =
    casillaDescriptions[num].desc;
  modal.style.display = "flex";
}

// ====================== ADMIN PANEL FUNCTIONS ======================
function adminEditStudent(key) {
  currentEditingStudentKey = key;
  const student = users[key];
  const container = document.getElementById("students-list");

  updateAdminNavButtons("manage");

  let html = `
        <h3 style="text-align: center; margin-bottom: 1.5rem; color: var(--orange); font-size: 1.8rem;">Managing: ${sanitizeInput(student.name)}</h3>
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(232, 231, 231, 0.19); padding: 16px 20px; border-radius: 14px; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
            <span style="font-size: 1.5rem; font-weight: bold;">
                Progress: <strong>${Object.keys(student.progress || {}).length} / 30</strong>
            </span>
            <button onclick="viewStudentBoard('${key}')" style="background: #4CAF50; padding: 12px 26px; font-size: 1.1rem; border-radius: 12px; width: auto; margin: 0;">
                👁️ View Student Board
            </button>
        </div>
        <div id="manage-list">
    `;

  for (let i = 1; i <= 30; i++) {
    const unlocked = !!(student.progress && student.progress[i]);
    html += `
            <div id="manage-row-${i}" style="display: flex; align-items: center; justify-content: space-between; background: #2a2a2a; padding: 18px 20px; margin-bottom: 10px; border-radius: 14px; border: 1px solid #444; flex-wrap: wrap; gap: 10px;">
                <span style="font-size: 1.4rem; font-weight: 600;">
                    Stage ${i}
                    ${[5, 10, 15, 20, 25].includes(i) ? " <span style='color:#ffd700'>⭐ Special</span>" : ""}
                    ${i === 30 ? " <span style='color:#ffd700'>🏆 Final</span>" : ""}
                </span>
                <button onclick="toggleCasilla('${key}', ${i})" 
                        style="background: ${unlocked ? "#d32f2f" : "#FF6200"}; 
                               color: white; 
                               padding: 12px 24px; 
                               border: none; 
                               border-radius: 12px; 
                               font-weight: bold;
                               font-size: 1.05rem;
                               margin: 0;
                               width: auto;
                               min-width: 130px;">
                    ${unlocked ? "🔒 Lock" : "🔓 Unlock"}
                </button>
            </div>
        `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

window.toggleCasilla = function (key, num) {
  if (!users[key].progress) users[key].progress = {};

  if (users[key].progress[num]) {
    delete users[key].progress[num];
  } else {
    users[key].progress[num] = true;
  }

  saveUsers(); // Guarda directamente en la nube
};

function executeReset() {
  if (currentEditingStudentKey && users[currentEditingStudentKey]) {
    const studentName = users[currentEditingStudentKey].name;
    if (
      confirm(
        `Reset ALL progress for ${sanitizeInput(studentName)}? This cannot be undone.`,
      )
    ) {
      users[currentEditingStudentKey].progress = {};
      saveUsers();
      adminEditStudent(currentEditingStudentKey);
    }
  }
}

window.viewStudentBoard = function (key) {
  const student = users[key];
  updateAdminNavButtons("board");

  let html = `
        <h3 style="text-align: center; margin-bottom: 1.5rem; color: var(--orange); font-size: 1.8rem;">Board Progress - ${sanitizeInput(student.name)}</h3>
        <div id="student-board-view" class="game-board" style="margin: 20px auto; max-width: 1250px;"></div>
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
  renderStudentsList(document.getElementById("search-students").value);
});

document
  .getElementById("admin-reset-btn")
  .addEventListener("click", executeReset);

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
    };
    showBoard();
  } else {
    alert("Student not found. Please Sign Up first.");
  }
});

document.getElementById("signup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  let name = sanitizeInput(document.getElementById("signup-name").value.trim());
  let pin = document.getElementById("signup-pin").value.trim();

  if (pin.length !== 4) return alert("PIN must be 4 digits (DDMM)");

  const key = (name + pin).toLowerCase().replace(/\s/g, "");
  if (users[key]) return alert("This student already exists.");

  users[key] = { name, progress: {} };
  saveUsers();
  alert("Account created successfully!");
  document.getElementById("back-to-login").click();
});

function showBoard() {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("board-screen").classList.add("active");
  document.getElementById("student-name-display").textContent =
    currentUser.name;
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
function showAdminPanel() {
  currentEditingStudentKey = null;
  updateAdminNavButtons("list");
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("admin-screen").classList.add("active");
  renderStudentsList();
}

function renderStudentsList(filter = "") {
  const container = document.getElementById("students-list");
  container.innerHTML = "<h3>Registered Students</h3>";

  Object.keys(users).forEach((key) => {
    const student = users[key];
    if (student.name.toLowerCase().includes(filter.toLowerCase())) {
      const unlockedCount = Object.keys(student.progress || {}).length;

      const div = document.createElement("div");
      div.className = "student-row";
      div.innerHTML = `
                <div class="student-info">
                    <strong style="font-size: 1.8rem; display: block;">${sanitizeInput(student.name)}</strong>
                    <span style="color: #aaa; margin-top: 6px; font-size: 1.1rem; display: block;">
                        Unlocked: <strong>${unlockedCount}/30</strong>
                    </span>
                </div>
                <button onclick="adminEditStudent('${key}')" style="margin: 0;">Manage Student</button>
            `;
      container.appendChild(div);
    }
  });

  if (Object.keys(users).length === 0) {
    container.innerHTML +=
      '<p style="text-align:center; color:#888; padding: 2rem;">No students registered yet.</p>';
  }
}

document
  .getElementById("search-students")
  .addEventListener("input", (e) => renderStudentsList(e.target.value));

document.getElementById("admin-btn").addEventListener("click", () => {
  const name = prompt("Admin Username:");
  const pin = prompt("Admin PIN:");
  if (name === ADMIN_USER && pin === ADMIN_PIN) {
    showAdminPanel();
  } else {
    alert("Incorrect admin credentials.");
  }
});

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

// ====================== INIT ======================
document.getElementById("login-screen").classList.add("active");
