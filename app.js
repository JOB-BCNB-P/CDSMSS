/* ===== Config: Google Apps Script Web App endpoint ===== */
window.__GAS_ENDPOINT__ = "https://script.google.com/macros/s/AKfycbz9WJdCDKyqe1YQKMgJVUctvU9L1rI9CjIFay5S6nlV81WcztU1jJx1Nt75AbG8F4XjTw/exec";

/* ===== dataSdk (fetch mode for GitHub Pages) ===== */
(function () {
  if (window.dataSdk && window.dataSdk.__wired) return;

  async function refresh(handler) {
    const res = await fetch(`${window.__GAS_ENDPOINT__}?action=getAllData`, {
      method: "GET",
      mode: "cors",
      headers: {
        "Accept": "application/json",
      },
      credentials: "same-origin"
    });
    const data = await res.json();
    if (handler && typeof handler.onDataChanged === "function") {
      handler.onDataChanged(Array.isArray(data) ? data : []);
    }
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

// === App code (migrated from inline script) ===
const defaultConfig = {
  system_title: "ระบบกำกับติดตามการส่งรายละเอียดรายวิชา",
  institution_name: "โรงเรียน/มหาวิทยาลัย",
  primary_color: "#667eea",
  secondary_color: "#764ba2",
  background_color: "#f5f7fa",
  text_color: "#333333",
  accent_color: "#ff4757"
};
// ด้านบนไฟล์
let dataReady = false;
let allData = [];
let currentUser = null;
let isAdmin = false;
let currentPage = 1;
const itemsPerPage = 5;

const dataHandler = {
  onDataChanged(data) {
    allData = data;
    dataReady = true;
    if (currentUser) {
      renderDashboard();
    }
  }
};

async function initApp() {
  // If external dataSdk exists (local dev), use it. Otherwise use adapter above.
  if (!window.dataSdk || typeof window.dataSdk.init !== 'function') {
    console.error('dataSdk not found. Ensure Apps Script adapter or SDK is loaded.');
    return;
  }

  const initResult = await window.dataSdk.init(dataHandler);
  if (!initResult.isOk) {
    console.error('Failed to initialize data SDK');
    return;
  }

  if (window.elementSdk) {
    window.elementSdk.init({
      defaultConfig,
      onConfigChange: async (config) => {
        document.getElementById('systemTitle').textContent = config.system_title || defaultConfig.system_title;
        document.getElementById('institutionName').textContent = config.institution_name || defaultConfig.institution_name;
        document.documentElement.style.setProperty('--primary-color', config.primary_color || defaultConfig.primary_color);
        document.documentElement.style.setProperty('--secondary-color', config.secondary_color || defaultConfig.secondary_color);
      },
      mapToCapabilities: (config) => ({
        recolorables: [
          {
            get: () => config.primary_color || defaultConfig.primary_color,
            set: (value) => {
              if (window.elementSdk) {
                window.elementSdk.setConfig({ primary_color: value });
              }
            }
          }
        ],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
      }),
      mapToEditPanelValues: (config) => new Map([
        ["system_title", config.system_title || defaultConfig.system_title],
        ["institution_name", config.institution_name || defaultConfig.institution_name]
      ])
    });
  }

  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('guestBtn').addEventListener('click', handleGuestLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('yearSelector').addEventListener('change', renderDashboard);

  document.getElementById('addCourseBtn').addEventListener('click', () => openCourseModal());
  document.getElementById('addUserBtn').addEventListener('click', () => openUserModal());
  document.getElementById('addCourseManageBtn').addEventListener('click', () => openCourseManageModal());
  document.getElementById('addCoordinatorBtn').addEventListener('click', () => openCoordinatorModal());
}

async function handleLogin(e) {
  e.preventDefault();

  // ถ้าข้อมูลจาก Google Sheets/CSV ยังโหลดไม่เสร็จ ให้แจ้งเตือนก่อน
  if (!dataReady) {
    Swal.fire({
      icon: 'info',
      title: 'กำลังโหลดข้อมูล',
      text: 'โปรดลองใหม่อีกครั้งในไม่กี่วินาที'
    });
    return;
  }

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  Swal.fire({
    title: 'กำลังเข้าสู่ระบบ...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  const users = allData.filter(item => item.type === 'user');
  const user = users.find(u =>
    String(u.email ?? '').trim().toLowerCase() === email.trim().toLowerCase() &&
    String(u.password ?? '').trim() === password.trim() &&
    String(u.active).toLowerCase() === 'true'
  );

  if (user) {
    currentUser = user;
    isAdmin = user.position === 'ผู้ดูแลระบบ';

    Swal.fire({
      icon: 'success',
      title: 'เข้าสู่ระบบสำเร็จ',
      text: `ยินดีต้อนรับ ${user.full_name}`,
      timer: 1500,
      showConfirmButton: false
    });

    setTimeout(() => {
      document.getElementById('loginContainer').style.display = 'none';
      document.getElementById('dashboard').classList.add('active');
      renderDashboard();
    }, 1500);
  } else {
    Swal.fire({
      icon: 'error',
      title: 'เข้าสู่ระบบไม่สำเร็จ',
      text: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    });
  }
}

function handleGuestLogin() {
  currentUser = { full_name: 'ผู้ใช้งานทั่วไป', position: 'ผู้ใช้งาน' };
  isAdmin = false;

  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
  renderDashboard();
}

function handleLogout() {
  Swal.fire({
    title: 'ต้องการออกจากระบบ?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ff4757'
  }).then((result) => {
    if (result.isConfirmed) {
      currentUser = null;
      isAdmin = false;
      currentPage = 1;

      document.getElementById('dashboard').classList.remove('active');
      document.getElementById('loginContainer').style.display = 'flex';
      document.getElementById('loginForm').reset();
    }
  });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function renderDashboard() {
  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userPosition').textContent = currentUser.position;
  document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0);

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
  const menu = document.getElementById('sidebarMenu');
  const menuItems = [
    { id: 'homePage', icon: '🏠', label: 'หน้าหลัก', admin: false }
  ];

  if (isAdmin) {
    menuItems.push(
      { id: 'usersPage', icon: '👥', label: 'จัดการผู้ใช้งาน', admin: true },
      { id: 'coursesPage', icon: '📚', label: 'จัดการรายวิชา', admin: true },
      { id: 'coordinatorsPage', icon: '👨‍🏫', label: 'จัดการอาจารย์', admin: true }
    );
  }

  menu.innerHTML = menuItems.map(item => `
    <div class="menu-item ${item.id === 'homePage' ? 'active' : ''}" data-page="${item.id}">
      <span class="menu-icon">${item.icon}</span>
      <span>${item.label}</span>
    </div>
  `).join('');

  menu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      menu.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
      document.getElementById(item.dataset.page).classList.add('active');
    });
  });
}

function renderStats() {
  const selectedYear = document.getElementById('yearSelector').value;
  const courses = allData.filter(item => item.type === 'course' && item.academic_year === selectedYear);

  const totalByYear = {};
  const completedByYear = {};
  const inProgressByYear = {};
  const notStartedByYear = {};

  courses.forEach(course => {
    const year = course.year_level;
    totalByYear[year] = (totalByYear[year] || 0) + 1;

    if (course.status_director) {
      completedByYear[year] = (completedByYear[year] || 0) + 1;
    } else if (course.status_academic || course.status_homeroom) {
      inProgressByYear[year] = (inProgressByYear[year] || 0) + 1;
    } else {
      notStartedByYear[year] = (notStartedByYear[year] || 0) + 1;
    }
  });

  const statsHTML = `
    ${isAdmin ? `
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-title">รายวิชาทั้งหมด</span>
        <span class="stat-icon">📊</span>
      </div>
      <div class="stat-value">${courses.length}</div>
      <div class="stat-breakdown">
        ${Object.entries(totalByYear).map(([year, count]) => 
          `<span class="year-badge">ปี ${year}: ${count}</span>`
        ).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-title">ส่งเสร็จสมบูรณ์</span>
        <span class="stat-icon">✅</span>
      </div>
      <div class="stat-value">${Object.values(completedByYear).reduce((a, b) => a + b, 0)}</div>
      <div class="stat-breakdown">
        ${Object.entries(completedByYear).map(([year, count]) => 
          `<span class="year-badge">ปี ${year}: ${count}</span>`
        ).join('')}
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-title">อยู่ระหว่างดำเนินการ</span>
        <span class="stat-icon">⏳</span>
      </div>
      <div class="stat-value">${Object.values(inProgressByYear).reduce((a, b) => a + b, 0)}</div>
      <div class="stat-breakdown">
        ${Object.entries(inProgressByYear).map(([year, count]) => 
          `<span class="year-badge">ปี ${year}: ${count}</span>`
        ).join('')}
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-title">ยังไม่ส่ง</span>
        <span class="stat-icon">❌</span>
      </div>
      <div class="stat-value">${Object.values(notStartedByYear).reduce((a, b) => a + b, 0)}</div>
      <div class="stat-breakdown">
        ${Object.entries(notStartedByYear).map(([year, count]) => 
          `<span class="year-badge">ปี ${year}: ${count}</span>`
        ).join('')}
      </div>
    </div>
  `;

  document.getElementById('statsGrid').innerHTML = statsHTML;
}

function renderCourseTable() {
  const selectedYear = document.getElementById('yearSelector').value;
  const courses = allData.filter(item => item.type === 'course' && item.academic_year === selectedYear);

  const totalPages = Math.ceil(courses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCourses = courses.slice(startIndex, endIndex);

  const tbody = document.getElementById('courseTableBody');
  tbody.innerHTML = paginatedCourses.map(course => {
    const isOverdue = course.due_date && course.status_director && 
      new Date(course.status_director) > new Date(course.due_date);

    return `
      <tr>
        <td>${course.course_name}</td>
        <td>${course.coordinators || '-'}</td>
        <td>${course.year_level}</td>
        <td>${course.room}</td>
        <td>${course.semester}</td>
        <td>
          <div class="status-step">
            ${course.status_academic ? `<small>✓ งานวิชาการ: ${course.status_academic}</small>` : '<small>○ งานวิชาการ</small>'}
            ${course.status_homeroom ? `<small>✓ อ.ประจำชั้น: ${course.status_homeroom}</small>` : '<small>○ อ.ประจำชั้น</small>'}
            ${course.status_director ? `<small>✓ รองผอ.: ${course.status_director}</small>` : '<small>○ รองผอ.</small>'}
            ${course.file_shared ? '<small>✓ Scan แล้ว</small>' : '<small>○ ยังไม่ Scan</small>'}
          </div>
        </td>
        <td>
          ${course.pdf_url ? 
            `<a href="${course.pdf_url}" target="_blank" rel="noopener noreferrer" style="color: #667eea;">📄 ดูไฟล์</a>` : 
            '-'}
        </td>
        ${isAdmin ? `
        <td>
          <button class="action-btn btn-edit" onclick="editCourse('${course.__backendId}')">✏️</button>
          <button class="action-btn btn-delete" onclick="deleteCourse('${course.__backendId}')">🗑️</button>
        </td>
        ` : ''}
        <td>
          <span class="status-badge ${isOverdue ? 'status-overdue' : 'status-normal'}">
            ${isOverdue ? 'เกินกำหนด' : 'ปกติ'}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('addCourseBtn').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('actionHeader').style.display = isAdmin ? 'table-cell' : 'none';

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById('pagination');

  pagination.innerHTML = `
    <button onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>◀ หน้าแรก</button>
    <button onclick="goToPage(${Math.max(1, currentPage - 10)})" ${currentPage <= 10 ? 'disabled' : ''}>⏮ ย้อนกลับ 10</button>
    <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&lt; ก่อนหน้า</button>
    <span class="page-info">หน้า ${currentPage} / ${totalPages || 1}</span>
    <button onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>ถัดไป &gt;</button>
    <button onclick="goToPage(${Math.min(totalPages, currentPage + 10)})" ${currentPage + 10 > totalPages ? 'disabled' : ''}>ไปข้างหน้า 10 ⏭</button>
    <button onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>หน้าสุดท้าย ▶</button>
  `;
}

function goToPage(page) {
  currentPage = page;
  renderCourseTable();
}

function renderUsersTable() {
  const users = allData.filter(item => item.type === 'user');
  const tbody = document.getElementById('usersTableBody');

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.email}</td>
      <td>${user.full_name}</td>
      <td>${user.position}</td>
      <td>
        <span class="status-badge ${user.active ? 'status-normal' : 'status-overdue'}">
          ${user.active ? 'ใช้งาน' : 'ปิดการใช้งาน'}
        </span>
      </td>
      <td>
        <button class="action-btn btn-edit" onclick="editUser('${user.__backendId}')">✏️</button>
        <button class="action-btn btn-delete" onclick="deleteUser('${user.__backendId}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function renderCoursesTable() {
  const courses = allData.filter(item => item.type === 'course_master');
  const tbody = document.getElementById('coursesTableBody');

  tbody.innerHTML = courses.map(course => `
    <tr>
      <td>${course.course_name}</td>
      <td>${course.coordinators || '-'}</td>
      <td>${course.year_level}</td>
      <td>${course.room}</td>
      <td>${course.semester}</td>
      <td>${course.due_date || '-'}</td>
      <td>
        <button class="action-btn btn-edit" onclick="editCourseMaster('${course.__backendId}')">✏️</button>
        <button class="action-btn btn-delete" onclick="deleteCourseMaster('${course.__backendId}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function renderCoordinatorsTable() {
  const coordinators = allData.filter(item => item.type === 'coordinator');
  const tbody = document.getElementById('coordinatorsTableBody');

  tbody.innerHTML = coordinators.map(coord => `
    <tr>
      <td>${coord.coordinator_name}</td>
      <td>
        <button class="action-btn btn-edit" onclick="editCoordinator('${coord.__backendId}')">✏️</button>
        <button class="action-btn btn-delete" onclick="deleteCoordinator('${coord.__backendId}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openCourseModal(courseId = null) {
  const course = courseId ? allData.find(item => item.__backendId === courseId) : null;

  document.getElementById('modalTitle').textContent = courseId ? 'แก้ไขข้อมูลรายวิชา' : 'เพิ่มรายวิชา';
  document.getElementById('modalBody').innerHTML = `
    <form id="courseForm">
      <div class="form-group">
        <label>ชื่อรายวิชา</label>
        <input type="text" id="courseName" value="${course?.course_name || ''}" required>
      </div>
      <div class="form-group">
        <label>อาจารย์ผู้ประสานงาน</label>
        <input type="text" id="courseCoordinators" value="${course?.coordinators || ''}" placeholder="ระบุชื่ออาจารย์">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ชั้นปี</label>
          <input type="number" id="courseYear" value="${course?.year_level || 1}" min="1" max="6" required>
        </div>
        <div class="form-group">
          <label>ห้อง</label>
          <input type="text" id="courseRoom" value="${course?.room || ''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ภาคการศึกษา</label>
          <select id="courseSemester" required>
            <option value="1" ${course?.semester === '1' ? 'selected' : ''}>1</option>
            <option value="2" ${course?.semester === '2' ? 'selected' : ''}>2</option>
            <option value="ฤดูร้อน" ${course?.semester === 'ฤดูร้อน' ? 'selected' : ''}>ฤดูร้อน</option>
          </select>
        </div>
        <div class="form-group">
          <label>ปีการศึกษา</label>
          <select id="courseAcademicYear" required>
            <option value="2567" ${course?.academic_year === '2567' ? 'selected' : ''}>2567</option>
            <option value="2568" ${course?.academic_year === '2568' ? 'selected' : ''}>2568</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>กำหนดส่ง</label>
        <input type="date" id="courseDueDate" value="${course?.due_date || ''}">
      </div>
      <div class="form-group">
        <label>สถานะการส่ง</label>
        <div class="status-step">
          <div class="step-item">
            <label>งานวิชาการ:</label>
            <input type="date" id="statusAcademic" value="${course?.status_academic || ''}">
          </div>
          <div class="step-item">
            <label>อาจารย์ประจำชั้น:</label>
            <input type="date" id="statusHomeroom" value="${course?.status_homeroom || ''}">
          </div>
          <div class="step-item">
            <label>รองผู้อำนวยการ:</label>
            <input type="date" id="statusDirector" value="${course?.status_director || ''}">
          </div>
        </div>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="fileShared" ${course?.file_shared ? 'checked' : ''}>
        <label for="fileShared">Scan ลง File Sharing แล้ว</label>
      </div>
      <div class="form-group">
        <label>URL ไฟล์ PDF</label>
        <input type="url" id="pdfUrl" value="${course?.pdf_url || ''}" placeholder="https://example.com/file.pdf">
      </div>
      <button type="submit" class="btn-save">บันทึก</button>
    </form>
  `;

  document.getElementById('courseForm').addEventListener('submit', (e) => saveCourse(e, courseId));
  document.getElementById('modal').classList.add('active');
}

async function saveCourse(e, courseId) {
  e.preventDefault();

  if (allData.filter(item => item.type === 'course').length >= 999 && !courseId) {
    Swal.fire({ icon: 'warning', title: 'ถึงขีดจำกัด', text: 'ไม่สามารถเพิ่มรายวิชาได้เกิน 999 รายการ' });
    return;
  }

  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  const courseData = {
    type: 'course',
    course_name: document.getElementById('courseName').value,
    coordinators: document.getElementById('courseCoordinators').value,
    year_level: parseInt(document.getElementById('courseYear').value),
    room: document.getElementById('courseRoom').value,
    semester: document.getElementById('courseSemester').value,
    academic_year: document.getElementById('courseAcademicYear').value,
    due_date: document.getElementById('courseDueDate').value,
    status_academic: document.getElementById('statusAcademic').value,
    status_homeroom: document.getElementById('statusHomeroom').value,
    status_director: document.getElementById('statusDirector').value,
    file_shared: document.getElementById('fileShared').checked,
    pdf_url: document.getElementById('pdfUrl').value,
    created_at: new Date().toISOString()
  };

  let result;
  if (courseId) {
    const existingCourse = allData.find(item => item.__backendId === courseId);
    result = await window.dataSdk.update({ ...existingCourse, ...courseData });
  } else {
    result = await window.dataSdk.create(courseData);
  }

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    closeModal();
  } else {
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
}

function editCourse(courseId) { openCourseModal(courseId); }

async function deleteCourse(courseId) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ?',
    text: 'คุณต้องการลบรายวิชานี้หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ff4757'
  });

  if (result.isConfirmed) {
    Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const course = allData.find(item => item.__backendId === courseId);
    const deleteResult = await window.dataSdk.delete(course);
    if (deleteResult.isOk) {
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถลบข้อมูลได้' });
    }
  }
}

function openUserModal(userId = null) {
  const user = userId ? allData.find(item => item.__backendId === userId) : null;

  document.getElementById('modalTitle').textContent = userId ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน';
  document.getElementById('modalBody').innerHTML = `
    <form id="userForm">
      <div class="form-group">
        <label>อีเมล</label>
        <input type="email" id="userEmail" value="${user?.email || ''}" required>
      </div>
      <div class="form-group">
        <label>รหัสผ่าน</label>
        <input type="password" id="userPassword" placeholder="${userId ? 'เว้นว่างหากไม่ต้องการเปลี่ยน' : 'ระบุรหัสผ่าน'}" ${!userId ? 'required' : ''}>
      </div>
      <div class="form-group">
        <label>ชื่อ-สกุล</label>
        <input type="text" id="userFullName" value="${user?.full_name || ''}" required>
      </div>
      <div class="form-group">
        <label>ตำแหน่ง</label>
        <select id="userPosition" required>
          <option value="ผู้ดูแลระบบ" ${user?.position === 'ผู้ดูแลระบบ' ? 'selected' : ''}>ผู้ดูแลระบบ</option>
          <option value="ผู้ใช้งาน" ${user?.position === 'ผู้ใช้งาน' ? 'selected' : ''}>ผู้ใช้งาน</option>
        </select>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="userActive" ${user?.active !== false ? 'checked' : ''}>
        <label for="userActive">เปิดใช้งาน</label>
      </div>
      <button type="submit" class="btn-save">บันทึก</button>
    </form>
  `;

  document.getElementById('userForm').addEventListener('submit', (e) => saveUser(e, userId));
  document.getElementById('modal').classList.add('active');
}

async function saveUser(e, userId) {
  e.preventDefault();

  if (allData.filter(item => item.type === 'user').length >= 999 && !userId) {
    Swal.fire({ icon: 'warning', title: 'ถึงขีดจำกัด', text: 'ไม่สามารถเพิ่มผู้ใช้งานได้เกิน 999 รายการ' });
    return;
  }

  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

  const password = document.getElementById('userPassword').value;
  const userData = {
    type: 'user',
    email: document.getElementById('userEmail').value,
    full_name: document.getElementById('userFullName').value,
    position: document.getElementById('userPosition').value,
    active: document.getElementById('userActive').checked,
    created_at: new Date().toISOString()
  };

  if (password) userData.password = password;

  let result;
  if (userId) {
    const existingUser = allData.find(item => item.__backendId === userId);
    result = await window.dataSdk.update({ ...existingUser, ...userData });
  } else {
    result = await window.dataSdk.create(userData);
  }

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    closeModal();
  } else {
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
}

function editUser(userId) { openUserModal(userId); }

async function deleteUser(userId) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ?',
    text: 'คุณต้องการลบผู้ใช้งานนี้หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ff4757'
  });

  if (result.isConfirmed) {
    Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const user = allData.find(item => item.__backendId === userId);
    const deleteResult = await window.dataSdk.delete(user);
    if (deleteResult.isOk) {
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถลบข้อมูลได้' });
    }
  }
}

function openCourseManageModal(courseId = null) {
  const course = courseId ? allData.find(item => item.__backendId === courseId) : null;

  document.getElementById('modalTitle').textContent = courseId ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชา';
  document.getElementById('modalBody').innerHTML = `
    <form id="courseMasterForm">
      <div class="form-group">
        <label>ชื่อรายวิชา</label>
        <input type="text" id="courseMasterName" value="${course?.course_name || ''}" required>
      </div>
      <div class="form-group">
        <label>อาจารย์ผู้ประสานงาน</label>
        <input type="text" id="courseMasterCoordinators" value="${course?.coordinators || ''}" placeholder="ระบุชื่ออาจารย์">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ชั้นปี</label>
          <input type="number" id="courseMasterYear" value="${course?.year_level || 1}" min="1" max="6" required>
        </div>
        <div class="form-group">
          <label>ห้อง</label>
          <input type="text" id="courseMasterRoom" value="${course?.room || ''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>ภาคการศึกษา</label>
          <select id="courseMasterSemester" required>
            <option value="1" ${course?.semester === '1' ? 'selected' : ''}>1</option>
            <option value="2" ${course?.semester === '2' ? 'selected' : ''}>2</option>
            <option value="ฤดูร้อน" ${course?.semester === 'ฤดูร้อน' ? 'selected' : ''}>ฤดูร้อน</option>
          </select>
        </div>
        <div class="form-group">
          <label>กำหนดส่ง</label>
          <input type="date" id="courseMasterDueDate" value="${course?.due_date || ''}">
        </div>
      </div>
      <button type="submit" class="btn-save">บันทึก</button>
    </form>
  `;

  document.getElementById('courseMasterForm').addEventListener('submit', (e) => saveCourseMaster(e, courseId));
  document.getElementById('modal').classList.add('active');
}

async function saveCourseMaster(e, courseId) {
  e.preventDefault();

  if (allData.filter(item => item.type === 'course_master').length >= 999 && !courseId) {
    Swal.fire({ icon: 'warning', title: 'ถึงขีดจำกัด', text: 'ไม่สามารถเพิ่มรายวิชาได้เกิน 999 รายการ' });
    return;
  }

  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

  const courseData = {
    type: 'course_master',
    course_name: document.getElementById('courseMasterName').value,
    coordinators: document.getElementById('courseMasterCoordinators').value,
    year_level: parseInt(document.getElementById('courseMasterYear').value),
    room: document.getElementById('courseMasterRoom').value,
    semester: document.getElementById('courseMasterSemester').value,
    due_date: document.getElementById('courseMasterDueDate').value,
    created_at: new Date().toISOString()
  };

  let result;
  if (courseId) {
    const existingCourse = allData.find(item => item.__backendId === courseId);
    result = await window.dataSdk.update({ ...existingCourse, ...courseData });
  } else {
    result = await window.dataSdk.create(courseData);
  }

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    closeModal();
  } else {
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
}

function editCourseMaster(courseId) { openCourseManageModal(courseId); }

async function deleteCourseMaster(courseId) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ?',
    text: 'คุณต้องการลบรายวิชานี้หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ff4757'
  });

  if (result.isConfirmed) {
    Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const course = allData.find(item => item.__backendId === courseId);
    const deleteResult = await window.dataSdk.delete(course);
    if (deleteResult.isOk) {
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถลบข้อมูลได้' });
    }
  }
}

function openCoordinatorModal(coordinatorId = null) {
  const coordinator = coordinatorId ? allData.find(item => item.__backendId === coordinatorId) : null;

  document.getElementById('modalTitle').textContent = coordinatorId ? 'แก้ไขอาจารย์' : 'เพิ่มอาจารย์';
  document.getElementById('modalBody').innerHTML = `
    <form id="coordinatorForm">
      <div class="form-group">
        <label>ชื่อ-สกุล</label>
        <input type="text" id="coordinatorName" value="${coordinator?.coordinator_name || ''}" required>
      </div>
      <button type="submit" class="btn-save">บันทึก</button>
    </form>
  `;

  document.getElementById('coordinatorForm').addEventListener('submit', (e) => saveCoordinator(e, coordinatorId));
  document.getElementById('modal').classList.add('active');
}

async function saveCoordinator(e, coordinatorId) {
  e.preventDefault();

  if (allData.filter(item => item.type === 'coordinator').length >= 999 && !coordinatorId) {
    Swal.fire({ icon: 'warning', title: 'ถึงขีดจำกัด', text: 'ไม่สามารถเพิ่มอาจารย์ได้เกิน 999 รายการ' });
    return;
  }

  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

  const coordinatorData = {
    type: 'coordinator',
    coordinator_name: document.getElementById('coordinatorName').value,
    created_at: new Date().toISOString()
  };

  let result;
  if (coordinatorId) {
    const existingCoordinator = allData.find(item => item.__backendId === coordinatorId);
    result = await window.dataSdk.update({ ...existingCoordinator, ...coordinatorData });
  } else {
    result = await window.dataSdk.create(coordinatorData);
  }

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    closeModal();
  } else {
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
}

function editCoordinator(coordinatorId) { openCoordinatorModal(coordinatorId); }

async function deleteCoordinator(coordinatorId) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ?',
    text: 'คุณต้องการลบอาจารย์นี้หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ff4757'
  });

  if (result.isConfirmed) {
    Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const coordinator = allData.find(item => item.__backendId === coordinatorId);
    const deleteResult = await window.dataSdk.delete(coordinator);
    if (deleteResult.isOk) {
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถลบข้อมูลได้' });
    }
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

window.onclick = function(event) {
  const modal = document.getElementById('modal');
  if (event.target === modal) {
    closeModal();
  }
};

// boot
document.addEventListener('DOMContentLoaded', initApp);
