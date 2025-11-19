/***********************
 * CONFIG: GAS ENDPOINT
 ***********************/
window.__GAS_ENDPOINT__ = window.__GAS_ENDPOINT__ || "https://script.google.com/macros/s/AKfycbzPq1Bkg1-OTK1mnoWNgO1jRu8OZ-0FFYYL7iRQWmPYZH5EE0o-k6PBFK8xVArm_mBvZA/exec";

/***********************
 * dataSdk (fetch mode)
 ***********************/
(function () {
  if (window.dataSdk && window.dataSdk.__wired) return;

  async function refresh(handler) {
    const res = await fetch(`${window.__GAS_ENDPOINT__}?action=getAllData`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      credentials: "omit"
    });
    const data = await res.json();
    if (handler && typeof handler.onDataChanged === "function") {
      handler.onDataChanged(Array.isArray(data) ? data : []);
    }
  }

  async function postJSON(action, payload) {
    const res = await fetch(window.__GAS_ENDPOINT__, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ action, data: payload })
    });
    return res.json();
  }

  window.dataSdk = {
    __wired: true,
    async init(handler) {
      await refresh(handler);
      return { isOk: true };
    },
    async create(obj) {
      const r = await postJSON("createRecord", obj);
      return { isOk: !!(r && r.success) };
    },
    async update(obj) {
      const r = await postJSON("updateRecord", obj);
      return { isOk: !!(r && r.success) };
    },
    async delete(obj) {
      const r = await postJSON("deleteRecord", obj);
      return { isOk: !!(r && r.success) };
    }
  };
})();

/***********************
 * APP STATE & CONFIG
 ***********************/
const defaultConfig = {
  system_title: "ระบบกำกับติดตามการส่งรายละเอียดรายวิชา",
  institution_name: "โรงเรียน/มหาวิทยาลัย",
  primary_color: "#667eea",
  secondary_color: "#764ba2",
  background_color: "#f5f7fa",
  text_color: "#333333",
  accent_color: "#ff4757"
};

let allData = [];
let currentUser = null;
let isAdmin = false;
let currentPage = 1;
const itemsPerPage = 5;

// ใช้ป้องกันกรณี init ซ้ำ
window.__APP_ALREADY_INIT__ = window.__APP_ALREADY_INIT__ || false;

/***********************
 * DATA HANDLER
 ***********************/
const dataHandler = {
  onDataChanged(data) {
    allData = data || [];
    if (currentUser) {
      renderDashboard();
    }
  }
};

/***********************
 * INIT APP
 ***********************/
async function initApp() {
  if (window.__APP_ALREADY_INIT__) return;
  window.__APP_ALREADY_INIT__ = true;

  if (!window.dataSdk || typeof window.dataSdk.init !== "function") {
    console.error("dataSdk not available");
    return;
  }

  await window.dataSdk.init(dataHandler);

  // elementSdk (ถ้ามี)
  if (window.elementSdk) {
    window.elementSdk.init({
      defaultConfig,
      onConfigChange: (config) => {
        document.getElementById("systemTitle").textContent =
          config.system_title || defaultConfig.system_title;
        document.getElementById("institutionName").textContent =
          config.institution_name || defaultConfig.institution_name;
      },
      mapToCapabilities: (config) => ({
        recolorables: [],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
      }),
      mapToEditPanelValues: (config) =>
        new Map([
          ["system_title", config.system_title || defaultConfig.system_title],
          ["institution_name", config.institution_name || defaultConfig.institution_name]
        ])
    });
  }

  setupEventListeners();
}

/***********************
 * EVENT LISTENERS
 ***********************/
function setupEventListeners() {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  const guestBtn = document.getElementById("guestBtn");
  if (guestBtn) guestBtn.addEventListener("click", handleGuestLogin);

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const toggleSidebarBtn = document.getElementById("toggleSidebar");
  if (toggleSidebarBtn) toggleSidebarBtn.addEventListener("click", toggleSidebar);

  const closeModalBtn = document.getElementById("closeModal");
  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);

  const yearSelector = document.getElementById("yearSelector");
  if (yearSelector) yearSelector.addEventListener("change", renderDashboard);

  const addCourseBtn = document.getElementById("addCourseBtn");
  if (addCourseBtn) addCourseBtn.addEventListener("click", () => openCourseModal());

  const addUserBtn = document.getElementById("addUserBtn");
  if (addUserBtn) addUserBtn.addEventListener("click", () => openUserModal());

  const addCourseManageBtn = document.getElementById("addCourseManageBtn");
  if (addCourseManageBtn)
    addCourseManageBtn.addEventListener("click", () => openCourseManageModal());

  const addCoordinatorBtn = document.getElementById("addCoordinatorBtn");
  if (addCoordinatorBtn)
    addCoordinatorBtn.addEventListener("click", () => openCoordinatorModal());
}

/***********************
 * LOGIN / LOGOUT
 ***********************/

// *** ฟังก์ชันนี้คือจุดที่แก้หลัก ๆ ***
async function handleLogin(e) {
  e.preventDefault();

  const rawEmail = document.getElementById("email").value || "";
  const rawPassword = document.getElementById("password").value || "";

  const email = rawEmail.trim();
  const password = rawPassword.trim();

  Swal.fire({
    title: "กำลังเข้าสู่ระบบ...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const users = allData.filter((item) => item.type === "user");

  const user = users.find((u) => {
    const uEmail = (u.email || "").trim().toLowerCase();
    const uPass = String(u.password || "").trim();

    const active = (u.active === true) ||
      (u.active === "TRUE") ||
      (u.active === "true") ||
      (u.active === 1) ||
      (u.active === "1");

    return uEmail === email.toLowerCase() && uPass === password && active;
  });

  if (user) {
    currentUser = user;
    isAdmin = user.position === "ผู้ดูแลระบบ";

    Swal.fire({
      icon: "success",
      title: "เข้าสู่ระบบสำเร็จ",
      text: `ยินดีต้อนรับ ${user.full_name}`,
      timer: 1200,
      showConfirmButton: false
    });

    setTimeout(() => {
      document.getElementById("loginContainer").style.display = "none";
      document.getElementById("dashboard").classList.add("active");
      renderDashboard();
    }, 1200);
  } else {
    Swal.fire({
      icon: "error",
      title: "เข้าสู่ระบบไม่สำเร็จ",
      text: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
    });
  }
}

function handleGuestLogin() {
  currentUser = { full_name: "ผู้ใช้งานทั่วไป", position: "ผู้ใช้งาน" };
  isAdmin = false;

  document.getElementById("loginContainer").style.display = "none";
  document.getElementById("dashboard").classList.add("active");
  renderDashboard();
}

function handleLogout() {
  Swal.fire({
    title: "ต้องการออกจากระบบ?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "ออกจากระบบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#ff4757"
  }).then((result) => {
    if (result.isConfirmed) {
      currentUser = null;
      isAdmin = false;
      currentPage = 1;

      document.getElementById("dashboard").classList.remove("active");
      document.getElementById("loginContainer").style.display = "flex";
      document.getElementById("loginForm").reset();
    }
  });
}

/***********************
 * SIDEBAR & DASHBOARD
 ***********************/
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

function renderDashboard() {
  if (!currentUser) return;

  document.getElementById("userName").textContent = currentUser.full_name || "";
  document.getElementById("userPosition").textContent = currentUser.position || "";
  document.getElementById("userAvatar").textContent =
    (currentUser.full_name || "?").charAt(0);

  renderSidebar();
  renderStats();
  renderCourseTable();

  if (isAdmin) {
    renderUsersTable();
    renderCoursesTable();
    renderCoordinatorsTable();
  }
}

function renderSidebar() {
  const menu = document.getElementById("sidebarMenu");
  if (!menu) return;

  const menuItems = [{ id: "homePage", icon: "🏠", label: "หน้าหลัก" }];

  if (isAdmin) {
    menuItems.push(
      { id: "usersPage", icon: "👥", label: "จัดการผู้ใช้งาน" },
      { id: "coursesPage", icon: "📚", label: "จัดการรายวิชา" },
      { id: "coordinatorsPage", icon: "👨‍🏫", label: "จัดการอาจารย์" }
    );
  }

  menu.innerHTML = menuItems
    .map(
      (item, idx) => `
      <div class="menu-item ${idx === 0 ? "active" : ""}" data-page="${item.id}">
        <span class="menu-icon">${item.icon}</span>
        <span>${item.label}</span>
      </div>
    `
    )
    .join("");

  menu.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      menu.querySelectorAll(".menu-item").forEach((m) => m.classList.remove("active"));
      item.classList.add("active");

      document
        .querySelectorAll(".page-section")
        .forEach((p) => p.classList.remove("active"));
      const page = document.getElementById(item.dataset.page);
      if (page) page.classList.add("active");
    });
  });
}

/***********************
 * STATS & COURSE TABLE
 ***********************/
function renderStats() {
  const statsGrid = document.getElementById("statsGrid");
  if (!statsGrid) return;

  const yearSelector = document.getElementById("yearSelector");
  const selectedYear = yearSelector ? yearSelector.value : "";

  const courses = allData.filter(
    (item) => item.type === "course" && item.academic_year === selectedYear
  );

  const totalByYear = {};
  const completedByYear = {};
  const inProgressByYear = {};
  const notStartedByYear = {};

  courses.forEach((course) => {
    const year = course.year_level || "-";
    totalByYear[year] = (totalByYear[year] || 0) + 1;

    if (course.status_director) {
      completedByYear[year] = (completedByYear[year] || 0) + 1;
    } else if (course.status_academic || course.status_homeroom) {
      inProgressByYear[year] = (inProgressByYear[year] || 0) + 1;
    } else {
      notStartedByYear[year] = (notStartedByYear[year] || 0) + 1;
    }
  });

  const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

  const statsHTML = `
    ${
      isAdmin
        ? `
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-title">รายวิชาทั้งหมด</span>
        <span class="stat-icon">📊</span>
      </div>
      <div class="stat-value">${courses.length}</div>
      <div class="stat-breakdown">
        ${Object.entries(totalByYear)
          .map(([year, count]) => `<span class="year-badge">ปี ${year}: ${count}</span>`)
          .join("")}
      </div>
    </div>
    `
        : ""
    }

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-title">ส่งเสร็จสมบูรณ์</span>
        <span class="stat-icon">✅</span>
      </div>
      <div class="stat-value">${sum(completedByYear)}</div>
      <div class="stat-breakdown">
        ${Object.entries(completedByYear)
          .map(([year, count]) => `<span class="year-badge">ปี ${year}: ${count}</span>`)
          .join("")}
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-title">อยู่ระหว่างดำเนินการ</span>
        <span class="stat-icon">⏳</span>
      </div>
      <div class="stat-value">${sum(inProgressByYear)}</div>
      <div class="stat-breakdown">
        ${Object.entries(inProgressByYear)
          .map(([year, count]) => `<span class="year-badge">ปี ${year}: ${count}</span>`)
          .join("")}
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-title">ยังไม่ส่ง</span>
        <span class="stat-icon">❌</span>
      </div>
      <div class="stat-value">${sum(notStartedByYear)}</div>
      <div class="stat-breakdown">
        ${Object.entries(notStartedByYear)
          .map(([year, count]) => `<span class="year-badge">ปี ${year}: ${count}</span>`)
          .join("")}
      </div>
    </div>
  `;

  statsGrid.innerHTML = statsHTML;
}

function renderCourseTable() {
  const yearSelector = document.getElementById("yearSelector");
  const selectedYear = yearSelector ? yearSelector.value : "";

  const tbody = document.getElementById("courseTableBody");
  if (!tbody) return;

  const courses = allData.filter(
    (item) => item.type === "course" && item.academic_year === selectedYear
  );

  const totalPages = Math.max(1, Math.ceil(courses.length / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCourses = courses.slice(startIndex, endIndex);

  tbody.innerHTML = paginatedCourses
    .map((course) => {
      const isOverdue =
        course.due_date &&
        course.status_director &&
        new Date(course.status_director) > new Date(course.due_date);

      return `
      <tr>
        <td>${course.course_name || ""}</td>
        <td>${course.coordinators || "-"}</td>
        <td>${course.year_level || ""}</td>
        <td>${course.room || ""}</td>
        <td>${course.semester || ""}</td>
        <td>
          <div class="status-step">
            ${
              course.status_academic
                ? `<small>✓ งานวิชาการ: ${course.status_academic}</small>`
                : "<small>○ งานวิชาการ</small>"
            }
            ${
              course.status_homeroom
                ? `<small>✓ อ.ประจำชั้น: ${course.status_homeroom}</small>`
                : "<small>○ อ.ประจำชั้น</small>"
            }
            ${
              course.status_director
                ? `<small>✓ รองผอ.: ${course.status_director}</small>`
                : "<small>○ รองผอ.</small>"
            }
            ${
              course.file_shared
                ? "<small>✓ Scan แล้ว</small>"
                : "<small>○ ยังไม่ Scan</small>"
            }
          </div>
        </td>
        <td>
          ${
            course.pdf_url
              ? `<a href="${course.pdf_url}" target="_blank" rel="noopener noreferrer" style="color:#667eea;">📄 ดูไฟล์</a>`
              : "-"
          }
        </td>
        ${
          isAdmin
            ? `
        <td>
          <button class="action-btn btn-edit" onclick="editCourse('${course.__backendId}')">✏️</button>
          <button class="action-btn btn-delete" onclick="deleteCourse('${course.__backendId}')">🗑️</button>
        </td>
        `
            : ""
        }
        <td>
          <span class="status-badge ${
            isOverdue ? "status-overdue" : "status-normal"
          }">
            ${isOverdue ? "เกินกำหนด" : "ปกติ"}
          </span>
        </td>
      </tr>
    `;
    })
    .join("");

  const actionHeader = document.getElementById("actionHeader");
  if (actionHeader) actionHeader.style.display = isAdmin ? "table-cell" : "none";

  const addBtn = document.getElementById("addCourseBtn");
  if (addBtn) addBtn.style.display = isAdmin ? "block" : "none";

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById("pagination");
  if (!pagination) return;

  pagination.innerHTML = `
    <button onclick="goToPage(1)" ${currentPage === 1 ? "disabled" : ""}>◀ หน้าแรก</button>
    <button onclick="goToPage(${Math.max(
      1,
      currentPage - 10
    )})" ${currentPage <= 10 ? "disabled" : ""}>⏮ ย้อนกลับ 10</button>
    <button onclick="goToPage(${currentPage - 1})" ${
    currentPage === 1 ? "disabled" : ""
  }>&lt; ก่อนหน้า</button>
    <span class="page-info">หน้า ${currentPage} / ${totalPages}</span>
    <button onclick="goToPage(${currentPage + 1})" ${
    currentPage >= totalPages ? "disabled" : ""
  }>ถัดไป &gt;</button>
    <button onclick="goToPage(${Math.min(
      totalPages,
      currentPage + 10
    )})" ${currentPage + 10 > totalPages ? "disabled" : ""}>ไปข้างหน้า 10 ⏭</button>
    <button onclick="goToPage(${totalPages})" ${
    currentPage === totalPages ? "disabled" : ""
  }>หน้าสุดท้าย ▶</button>
  `;
}

function goToPage(page) {
  currentPage = Math.max(1, page);
  renderCourseTable();
}

/***********************
 * ADMIN TABLES
 * (ส่วนนี้ผมไม่ได้แตะ logic เลย)
 ***********************/
// ... ตรงนี้ปอยสามารถใช้เวอร์ชันเดิมของตาราง Users / Courses / Coordinators / Course_master
// ถ้าตอนนี้ใช้งานได้แล้ว ก็ไม่จำเป็นต้องแก้
// (เพื่อไม่ให้ข้อความยาวเกิน ผมไม่คัดลอกซ้ำทั้งหมดในคำตอบนี้)
// หลัก ๆ คือ login ผ่านแล้ว ส่วนอื่นจะทำงานตาม dataSdk เหมือนเดิม

/***********************
 * MODAL HELPERS (close)
 ***********************/
function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.classList.remove("active");
}

window.onclick = function (event) {
  const modal = document.getElementById("modal");
  if (event.target === modal) {
    closeModal();
  }
};

/***********************
 * BOOTSTRAP
 ***********************/
document.addEventListener("DOMContentLoaded", initApp);
