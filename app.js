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
  institution_name: "หน่วยงานของท่าน"
};

let dataReady = false;
let allData = [];
let currentUser = null;
let isAdmin = false;
let currentPage = 1;
const itemsPerPage = 5;

/***********************
 * สร้างรายการปีการศึกษา จากข้อมูลจริง
 ***********************/
function populateYearSelector() {
  const yearSelect = document.getElementById("yearSelector");
  if (!yearSelect) return;

  const courseItems = (allData || []).filter(
    (item) => item.type === "course" && item.academic_year
  );

  const years = Array.from(
    new Set(
      courseItems
        .map((c) => String(c.academic_year).trim())
        .filter((y) => y !== "")
    )
  );

  years.sort((a, b) => Number(b) - Number(a));

  if (years.length === 0) {
    yearSelect.innerHTML =
      '<option value="">-- ยังไม่มีข้อมูลปีการศึกษา --</option>';
    return;
  }

  yearSelect.innerHTML = years
    .map((y) => `<option value="${y}">ปีการศึกษา ${y}</option>`)
    .join("");

  yearSelect.value = years[0];

  renderStats();
  renderCourseTable();
}

/***********************
 * DATA HANDLER
 ***********************/
const dataHandler = {
  onDataChanged(data) {
    allData = data || [];
    dataReady = true;

    populateYearSelector();

    if (currentUser) {
      renderDashboard();
    }
  }
};

/***********************
 * INIT APP
 ***********************/
async function initApp() {
  try {
    await window.dataSdk.init(dataHandler);
  } catch (err) {
    console.error("init error", err);
    Swal.fire({
      icon: "error",
      title: "เชื่อมต่อข้อมูลไม่สำเร็จ",
      text: "กรุณาตรวจสอบการตั้งค่า Web App (Code.gs) และลองใหม่อีกครั้ง"
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
  if (yearSelector) yearSelector.addEventListener("change", () => {
    renderStats();
    renderCourseTable();
  });

  const addUserBtn = document.getElementById("addUserBtn");
  if (addUserBtn) addUserBtn.addEventListener("click", () => {
    Swal.fire("ยังไม่ได้เปิดใช้", "ส่วนเพิ่มผู้ใช้งานจะเชื่อมต่อภายหลัง", "info");
  });

  const addCourseManageBtn = document.getElementById("addCourseManageBtn");
  if (addCourseManageBtn) addCourseManageBtn.addEventListener("click", () => {
    Swal.fire("ยังไม่ได้เปิดใช้", "ส่วนเพิ่มรายวิชาแม่แบบจะเชื่อมต่อภายหลัง", "info");
  });

  const addCoordinatorBtn = document.getElementById("addCoordinatorBtn");
  if (addCoordinatorBtn) addCoordinatorBtn.addEventListener("click", () => {
    Swal.fire("ยังไม่ได้เปิดใช้", "ส่วนเพิ่มอาจารย์จะเชื่อมต่อภายหลัง", "info");
  });
}

/***********************
 * LOGIN / LOGOUT
 ***********************/
async function handleLogin(e) {
  e.preventDefault();

  const rawEmail = document.getElementById("email").value || "";
  const rawPassword = document.getElementById("password").value || "";

  const email = rawEmail.trim();
  const password = rawPassword.trim();

  if (!dataReady) {
    Swal.fire({
      icon: "info",
      title: "กำลังโหลดข้อมูล",
      text: "กรุณาลองใหม่อีกครั้งในไม่กี่วินาที"
    });
    return;
  }

  Swal.fire({
    title: "กำลังเข้าสู่ระบบ...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 400));

  const users = allData.filter((item) => item.type === "user");

  const user = users.find((u) => {
    const uEmail = (u.email || "").trim().toLowerCase();
    const uPass = String(u.password || "").trim();

    const active =
      u.active === true ||
      u.active === "TRUE" ||
      u.active === "true" ||
      u.active === 1 ||
      u.active === "1";

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
      document.getElementById("loginContainer").classList.add("hidden");
      document.getElementById("dashboard").classList.remove("hidden");
      renderDashboard();
    }, 1200);
  } else {
    Swal.fire({
      icon: "error",
      title: "เข้าสู่ระบบไม่สำเร็จ",
      text: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือผู้ใช้งานยังไม่เปิดใช้งาน"
    });
  }
}

function handleGuestLogin() {
  currentUser = { full_name: "ผู้ใช้งานทั่วไป", position: "ผู้ใช้งาน" };
  isAdmin = false;

  document.getElementById("loginContainer").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  renderDashboard();
}

function handleLogout() {
  Swal.fire({
    title: "ต้องการออกจากระบบ?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "ออกจากระบบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#ef4444"
  }).then((result) => {
    if (result.isConfirmed) {
      currentUser = null;
      isAdmin = false;
      currentPage = 1;

      document.getElementById("dashboard").classList.add("hidden");
      document.getElementById("loginContainer").classList.remove("hidden");
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

  const userNameEl = document.getElementById("userName");
  const userPositionEl = document.getElementById("userPosition");
  const userAvatarEl = document.getElementById("userAvatar");

  if (userNameEl) userNameEl.textContent = currentUser.full_name || "";
  if (userPositionEl) userPositionEl.textContent = currentUser.position || "";
  if (userAvatarEl) userAvatarEl.textContent =
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

  const items = [{ id: "homePage", icon: "🏠", label: "หน้าหลัก" }];

  if (isAdmin) {
    items.push(
      { id: "usersPage", icon: "👥", label: "จัดการผู้ใช้งาน" },
      { id: "coursesPage", icon: "📚", label: "จัดการรายวิชา" },
      { id: "coordinatorsPage", icon: "👨‍🏫", label: "จัดการอาจารย์" }
    );
  }

  menu.innerHTML = items
    .map(
      (item, idx) => `
      <div class="menu-item ${idx === 0 ? "active" : ""}" data-page="${item.id}">
        <span class="menu-icon mr-2">${item.icon}</span>
        <span>${item.label}</span>
      </div>
    `
    )
    .join("");

  menu.querySelectorAll(".menu-item").forEach((el) => {
    el.addEventListener("click", () => {
      menu.querySelectorAll(".menu-item").forEach((m) => m.classList.remove("active"));
      el.classList.add("active");

      document
        .querySelectorAll(".page-section")
        .forEach((p) => p.classList.add("hidden"));
      const page = document.getElementById(el.dataset.page);
      if (page) page.classList.remove("hidden");
    });
  });
}

/***********************
 * STATS & COURSE TABLE
 ***********************/
function renderStats() {
  const statsGrid = document.getElementById("statsGrid");
  const yearSelector = document.getElementById("yearSelector");
  if (!statsGrid || !yearSelector) return;

  const selectedYear = yearSelector.value;
  if (!selectedYear) {
    statsGrid.innerHTML = `
      <div class="stat-card bg-white rounded-lg border p-3 text-xs col-span-4">
        <div class="stat-header flex items-center justify-between mb-1">
          <span class="stat-title font-semibold">ยังไม่มีข้อมูลปีการศึกษา</span>
        </div>
        <p class="text-gray-500">กรุณาบันทึกข้อมูลในชีต COURSES ก่อน</p>
      </div>
    `;
    return;
  }

  const courses = allData.filter(
    (item) => item.type === "course" && String(item.academic_year) === selectedYear
  );

  const totalByYear = {};
  const completedByYear = {};
  const inProgressByYear = {};
  const notStartedByYear = {};

  courses.forEach((c) => {
    const yearLevel = c.year_level || "-";
    totalByYear[yearLevel] = (totalByYear[yearLevel] || 0) + 1;

    if (c.status_director) {
      completedByYear[yearLevel] = (completedByYear[yearLevel] || 0) + 1;
    } else if (c.status_academic || c.status_homeroom) {
      inProgressByYear[yearLevel] = (inProgressByYear[yearLevel] || 0) + 1;
    } else {
      notStartedByYear[yearLevel] = (notStartedByYear[yearLevel] || 0) + 1;
    }
  });

  const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

  statsGrid.innerHTML = `
    ${
      isAdmin
        ? `
    <div class="stat-card bg-white rounded-lg border p-3 text-xs">
      <div class="stat-header flex items-center justify-between mb-1">
        <span class="stat-title font-semibold">รายวิชาทั้งหมด</span>
        <span class="stat-icon">📊</span>
      </div>
      <div class="stat-value text-2xl font-bold">${courses.length}</div>
      <div class="stat-breakdown mt-1 space-x-1">
        ${Object.entries(totalByYear)
          .map(([y, count]) => `<span class="year-badge px-2 py-0.5 bg-slate-100 rounded-full">ปี ${y}: ${count}</span>`)
          .join("")}
      </div>
    </div>
    `
        : ""
    }

    <div class="stat-card bg-white rounded-lg border p-3 text-xs">
      <div class="stat-header flex items-center justify-between mb-1">
        <span class="stat-title font-semibold">ส่งเสร็จสมบูรณ์</span>
        <span class="stat-icon">✅</span>
      </div>
      <div class="stat-value text-2xl font-bold">${sum(completedByYear)}</div>
      <div class="stat-breakdown mt-1 space-x-1">
        ${Object.entries(completedByYear)
          .map(([y, count]) => `<span class="year-badge px-2 py-0.5 bg-green-50 rounded-full">ปี ${y}: ${count}</span>`)
          .join("")}
      </div>
    </div>

    <div class="stat-card bg-white rounded-lg border p-3 text-xs">
      <div class="stat-header flex items-center justify-between mb-1">
        <span class="stat-title font-semibold">อยู่ระหว่างดำเนินการ</span>
        <span class="stat-icon">⏳</span>
      </div>
      <div class="stat-value text-2xl font-bold">${sum(inProgressByYear)}</div>
      <div class="stat-breakdown mt-1 space-x-1">
        ${Object.entries(inProgressByYear)
          .map(([y, count]) => `<span class="year-badge px-2 py-0.5 bg-yellow-50 rounded-full">ปี ${y}: ${count}</span>`)
          .join("")}
      </div>
    </div>

    <div class="stat-card bg-white rounded-lg border p-3 text-xs">
      <div class="stat-header flex items-center justify-between mb-1">
        <span class="stat-title font-semibold">ยังไม่ส่ง</span>
        <span class="stat-icon">❌</span>
      </div>
      <div class="stat-value text-2xl font-bold">${sum(notStartedByYear)}</div>
      <div class="stat-breakdown mt-1 space-x-1">
        ${Object.entries(notStartedByYear)
          .map(([y, count]) => `<span class="year-badge px-2 py-0.5 bg-red-50 rounded-full">ปี ${y}: ${count}</span>`)
          .join("")}
      </div>
    </div>
  `;
}

function renderCourseTable() {
  const yearSelector = document.getElementById("yearSelector");
  const tbody = document.getElementById("courseTableBody");
  if (!yearSelector || !tbody) return;

  const selectedYear = yearSelector.value;
  const courses = allData.filter(
    (item) => item.type === "course" && String(item.academic_year) === selectedYear
  );

  const totalPages = Math.max(1, Math.ceil(courses.length / itemsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = courses.slice(start, end);

  tbody.innerHTML = pageItems
    .map((c) => {
      const isOverdue =
        c.due_date &&
        c.status_director &&
        new Date(c.status_director) > new Date(c.due_date);

      return `
        <tr class="border-b">
          <td class="px-2 py-1 text-xs">${c.course_name || ""}</td>
          <td class="px-2 py-1 text-xs">${c.coordinators || "-"}</td>
          <td class="px-2 py-1 text-center text-xs">${c.year_level || ""}</td>
          <td class="px-2 py-1 text-center text-xs">${c.room || ""}</td>
          <td class="px-2 py-1 text-center text-xs">${c.semester || ""}</td>
          <td class="px-2 py-1 text-xs">
            <div class="flex flex-col gap-0.5">
              ${c.status_academic ? `<small>✓ งานวิชาการ: ${c.status_academic}</small>` : "<small>○ งานวิชาการ</small>"}
              ${c.status_homeroom ? `<small>✓ อ.ประจำชั้น: ${c.status_homeroom}</small>` : "<small>○ อ.ประจำชั้น</small>"}
              ${c.status_director ? `<small>✓ รองผอ.: ${c.status_director}</small>` : "<small>○ รองผอ.</small>"}
              ${c.file_shared ? "<small>✓ Scan แล้ว</small>" : "<small>○ ยังไม่ Scan</small>"}
            </div>
          </td>
          <td class="px-2 py-1 text-center text-xs">
            ${
              c.pdf_url
                ? `<a href="${c.pdf_url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline">ดูไฟล์</a>`
                : "-"
            }
          </td>
          <td class="px-2 py-1 text-center text-xs">
            ${
              isAdmin
                ? `
              <button class="action-btn text-xs text-blue-600" onclick="Swal.fire('แก้ไข','ส่วนแก้ไขจะเชื่อมต่อภายหลัง','info')">แก้ไข</button>
              <button class="action-btn text-xs text-red-600" onclick="Swal.fire('ลบ','ส่วนลบจะเชื่อมต่อภายหลัง','info')">ลบ</button>
            `
                : "-"
            }
          </td>
          <td class="px-2 py-1 text-center text-xs">
            <span class="px-2 py-0.5 rounded-full text-[10px] ${
              isOverdue ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
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
    <span class="page-info px-2">หน้า ${currentPage} / ${totalPages}</span>
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
 * ADMIN TABLES – placeholder
 ***********************/
function renderUsersTable() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  const users = allData.filter((item) => item.type === "user");
  tbody.innerHTML = users
    .map(
      (u) => `
      <tr class="border-b">
        <td class="px-2 py-1 text-xs">${u.full_name || ""}</td>
        <td class="px-2 py-1 text-xs">${u.email || ""}</td>
        <td class="px-2 py-1 text-xs">${u.position || ""}</td>
        <td class="px-2 py-1 text-center text-xs">
          ${
            u.active === true ||
            u.active === "TRUE" ||
            u.active === "true" ||
            u.active === 1 ||
            u.active === "1"
              ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px]">ใช้งาน</span>'
              : '<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px]">ปิดใช้งาน</span>'
          }
        </td>
        <td class="px-2 py-1 text-center text-xs">
          <button class="text-blue-600 text-xs" onclick="Swal.fire('แก้ไขผู้ใช้','จะเชื่อมต่อภายหลัง','info')">แก้ไข</button>
        </td>
      </tr>
    `
    )
    .join("");
}

function renderCoursesTable() {
  const tbody = document.getElementById("coursesTableBody");
  if (!tbody) return;
  const masters = allData.filter((item) => item.type === "course_master");
  tbody.innerHTML = masters
    .map(
      (c) => `
      <tr class="border-b">
        <td class="px-2 py-1 text-xs">${c.course_name || ""}</td>
        <td class="px-2 py-1 text-xs">${c.coordinators || ""}</td>
        <td class="px-2 py-1 text-center text-xs">${c.year_level || ""}</td>
        <td class="px-2 py-1 text-center text-xs">${c.room || ""}</td>
        <td class="px-2 py-1 text-center text-xs">${c.semester || ""}</td>
        <td class="px-2 py-1 text-center text-xs">${c.due_date || ""}</td>
        <td class="px-2 py-1 text-center text-xs">
          <button class="text-blue-600 text-xs" onclick="Swal.fire('แก้ไขรายวิชา','จะเชื่อมต่อภายหลัง','info')">แก้ไข</button>
        </td>
      </tr>
    `
    )
    .join("");
}

function renderCoordinatorsTable() {
  const tbody = document.getElementById("coordinatorsTableBody");
  if (!tbody) return;
  const coords = allData.filter((item) => item.type === "coordinator");
  tbody.innerHTML = coords
    .map(
      (c) => `
      <tr class="border-b">
        <td class="px-2 py-1 text-xs">${c.coordinator_name || ""}</td>
        <td class="px-2 py-1 text-center text-xs">
          <button class="text-blue-600 text-xs" onclick="Swal.fire('แก้ไขอาจารย์','จะเชื่อมต่อภายหลัง','info')">แก้ไข</button>
        </td>
      </tr>
    `
    )
    .join("");
}

/***********************
 * MODAL HELPERS
 ***********************/
function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.classList.add("hidden");
}

window.onclick = function (event) {
  const modal = document.getElementById("modal");
  if (modal && event.target === modal) {
    closeModal();
  }
};

/***********************
 * BOOTSTRAP
 ***********************/
document.addEventListener("DOMContentLoaded", initApp);
