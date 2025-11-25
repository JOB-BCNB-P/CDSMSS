// === URL Web App ของ Google Apps Script ===
const API_URL = 'https://script.google.com/macros/s/AKfycbyNkg3e-K1rEBX67YtwYTZynNJb9NDYAQEOwhzhrdSynkkDkeJr6L7mV7fQx_CKoDPc/exec';

// === dataSdk: เลียนแบบของเดิม แต่ไปเรียก Apps Script แทน ===
window.dataSdk = {
  async init(handler) {
    try {
      const res = await fetch(`${API_URL}?action=getAll`);
      const json = await res.json();
      if (json.isOk) {
        handler.onDataChanged(json.data || []);
        return { isOk: true };
      } else {
        console.error(json.error);
        handler.onDataChanged([]);
        return { isOk: false, error: json.error };
      }
    } catch (err) {
      console.error(err);
      handler.onDataChanged([]);
      return { isOk: false, error: err.toString() };
    }
  },

  async create(obj) {
    const params = new URLSearchParams();
    params.append('action', 'create');
    params.append('entity', obj.type);  // user, course, teacher
    params.append('payload', JSON.stringify(obj));

    const res = await fetch(API_URL, {
      method: 'POST',
      body: params
    });
    const json = await res.json();

    if (json.isOk && json.record) {
      Object.assign(obj, json.record); // เอา __backendId กลับมาเก็บไว้
    }
    return json;
  },

  async update(obj) {
    const params = new URLSearchParams();
    params.append('action', 'update');
    params.append('entity', obj.type);
    params.append('payload', JSON.stringify(obj));

    const res = await fetch(API_URL, {
      method: 'POST',
      body: params
    });
    return res.json();
  },

  async delete(obj) {
    const params = new URLSearchParams();
    params.append('action', 'delete');
    params.append('entity', obj.type);
    params.append('payload', JSON.stringify({ __backendId: obj.__backendId }));

    const res = await fetch(API_URL, {
      method: 'POST',
      body: params
    });
    return res.json();
  }
};

// === ตัวแปรหลัก ===
const defaultConfig = {
  system_title: "ระบบกำกับติดตามการส่งรายละเอียดรายวิชา",
  institution_name: "โรงเรียน/มหาวิทยาลัย"
};

let currentUser = null;
let allData = [];
let currentPage = 1;
const itemsPerPage = 5;

const dataHandler = {
  onDataChanged(data) {
    allData = data;
    if (currentUser) {
      renderDashboard();
    }
  }
};

// === Init เริ่มต้น ===
async function init() {
  // set ชื่อระบบ/สถานศึกษา
  document.getElementById('systemTitle').textContent = defaultConfig.system_title;
  document.getElementById('institutionName').textContent = defaultConfig.institution_name;

  const initResult = await window.dataSdk.init(dataHandler);
  if (!initResult.isOk) {
    console.error("Failed to initialize data SDK");
  }
}

// === Login / Logout ===
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  Swal.fire({
    title: 'กำลังเข้าสู่ระบบ...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  const users = allData.filter(d => d.type === 'user');
  const user = users.find(
  u =>
    u.email === email &&
    u.password === password &&
    String(u.active).toLowerCase() === 'true'
  );

  if (user) {
    currentUser = user;
    Swal.fire({
      icon: 'success',
      title: 'เข้าสู่ระบบสำเร็จ',
      text: `ยินดีต้อนรับ ${user.full_name}`,
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      showDashboard();
    });
  } else {
    Swal.fire({
      icon: 'error',
      title: 'เข้าสู่ระบบไม่สำเร็จ',
      text: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือผู้ใช้งานถูกปิดการใช้งาน'
    });
  }
}

function loginAsGuest() {
  currentUser = { position: 'guest', full_name: 'ผู้ใช้งานทั่วไป' };
  showDashboard();
}

function showDashboard() {
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
  renderDashboard();
}

function logout() {
  currentUser = null;
  document.getElementById('dashboard').classList.remove('active');
  document.getElementById('loginContainer').style.display = 'flex';
  document.getElementById('loginForm').reset();
}

// === Render ส่วนต่าง ๆ ===
function renderDashboard() {
  const isAdmin = currentUser.position === 'admin';

  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userPosition').textContent =
    currentUser.position === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งานทั่วไป';
  document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0);

  renderSidebar(isAdmin);
  renderStats();
  renderHomeTable(isAdmin);

  if (isAdmin) {
    renderUsersTable();
    renderCoursesTable();
    renderTeachersTable();
  }
}

function renderSidebar(isAdmin) {
  const menu = document.getElementById('sidebarMenu');
  const items = [
    { id: 'homePage',   icon: '🏠', text: 'หน้าหลัก' }
  ];

  if (isAdmin) {
    items.push(
      { id: 'usersPage',   icon: '👥', text: 'จัดการผู้ใช้งาน' },
      { id: 'coursesPage', icon: '📚', text: 'จัดการรายวิชา' },
      { id: 'teachersPage',icon: '👨‍🏫', text: 'จัดการอาจารย์' }
    );
  }

  menu.innerHTML = items.map(item => `
    <div class="menu-item ${item.id === 'homePage' ? 'active' : ''}" onclick="switchPage('${item.id}', event)">
      <span style="font-size: 20px;">${item.icon}</span>
      <span>${item.text}</span>
    </div>
  `).join('');
}

function switchPage(pageId, ev) {
  document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

  document.getElementById(pageId).classList.add('active');
  if (ev && ev.currentTarget) {
    ev.currentTarget.classList.add('active');
  }

  currentPage = 1;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// === สถิติ ===
function renderStats() {
  const year    = document.getElementById('yearFilter').value;
  const courses = allData.filter(d => d.type === 'course' && String(d.academic_year) === String(year));

  const statsByYear = {};
  for (let i = 1; i <= 6; i++) {
    const yearCourses = courses.filter(c => String(c.year_level) === String(i));
    statsByYear[i] = {
      total: yearCourses.length,
      completed: yearCourses.filter(c => c.status_director).length,
      inProgress: yearCourses.filter(c => !c.status_director && (c.status_academic || c.status_homeroom)).length,
      notStarted: yearCourses.filter(c => !c.status_academic && !c.status_homeroom && !c.status_director).length
    };
  }

  const isAdmin = currentUser.position === 'admin';
  let statsHTML = '';

  if (isAdmin) {
    let totalAll = 0;
    for (let i = 1; i <= 6; i++) totalAll += statsByYear[i].total;
    statsHTML += `
      <div class="stat-card">
        <h3>รายวิชาทั้งหมด</h3>
        <div class="stat-value">${totalAll}</div>
        <div class="stat-label">
          ${Object.keys(statsByYear).map(y => `ปี ${y}: ${statsByYear[y].total}`).join(' | ')}
        </div>
      </div>
    `;
  }

  let completedAll = 0, inProgressAll = 0, notStartedAll = 0;
  for (let i = 1; i <= 6; i++) {
    completedAll  += statsByYear[i].completed;
    inProgressAll += statsByYear[i].inProgress;
    notStartedAll += statsByYear[i].notStarted;
  }

  statsHTML += `
    <div class="stat-card">
      <h3>ส่งเสร็จสมบูรณ์</h3>
      <div class="stat-value" style="color: #2e7d32;">${completedAll}</div>
      <div class="stat-label">
        ${Object.keys(statsByYear).map(y => `ปี ${y}: ${statsByYear[y].completed}`).join(' | ')}
      </div>
    </div>
    <div class="stat-card">
      <h3>อยู่ระหว่างดำเนินการ</h3>
      <div class="stat-value" style="color: #f57c00;">${inProgressAll}</div>
      <div class="stat-label">
        ${Object.keys(statsByYear).map(y => `ปี ${y}: ${statsByYear[y].inProgress}`).join(' | ')}
      </div>
    </div>
    <div class="stat-card">
      <h3>ยังไม่ส่ง</h3>
      <div class="stat-value" style="color: #d32f2f;">${notStartedAll}</div>
      <div class="stat-label">
        ${Object.keys(statsByYear).map(y => `ปี ${y}: ${statsByYear[y].notStarted}`).join(' | ')}
      </div>
    </div>
  `;

  document.getElementById('statsGrid').innerHTML = statsHTML;
}

// ตารางหน้า Home
function renderHomeTable(isAdmin) {
  const year    = document.getElementById('yearFilter').value;
  const courses = allData.filter(d => d.type === 'course' && String(d.academic_year) === String(year));

  const start = (currentPage - 1) * itemsPerPage;
  const end   = start + itemsPerPage;
  const paginatedCourses = courses.slice(start, end);

  let tableHTML = `
    <table>
      <thead>
        <tr>
          <th>ชื่อรายวิชา</th>
          <th>อาจารย์ผู้ประสานงาน</th>
          <th>ชั้นปี</th>
          <th>ห้อง</th>
          <th>ภาคเรียน</th>
          <th>สถานะการส่ง</th>
          ${isAdmin ? '<th>ไฟล์ PDF</th>' : '<th>ดาวน์โหลด PDF</th>'}
          ${isAdmin ? '<th>จัดการ</th>' : ''}
          <th>สถานะ</th>
        </tr>
      </thead>
      <tbody>
  `;

  paginatedCourses.forEach(course => {
    const isOverdue = course.due_date && course.status_director &&
      new Date(course.status_director) > new Date(course.due_date);

    tableHTML += `
      <tr>
        <td>${course.course_name || ''}</td>
        <td>${course.coordinators || ''}</td>
        <td>${course.year_level || ''}</td>
        <td>${course.room || ''}</td>
        <td>${course.semester || ''}</td>
        <td>
          <div class="status-steps">
            <div class="status-step">
              ${isAdmin ? `<input type="checkbox" ${course.status_academic ? 'checked' : ''} onchange="updateStatus('${course.__backendId}', 'academic', this.checked)">` : ''}
              ${course.status_academic ? '✅' : '⬜'} งานวิชาการ ${course.status_academic || ''}
            </div>
            <div class="status-step">
              ${isAdmin ? `<input type="checkbox" ${course.status_homeroom ? 'checked' : ''} onchange="updateStatus('${course.__backendId}', 'homeroom', this.checked)">` : ''}
              ${course.status_homeroom ? '✅' : '⬜'} อาจารย์ประจำชั้น ${course.status_homeroom || ''}
            </div>
            <div class="status-step">
              ${isAdmin ? `<input type="checkbox" ${course.status_director ? 'checked' : ''} onchange="updateStatus('${course.__backendId}', 'director', this.checked)">` : ''}
              ${course.status_director ? '✅' : '⬜'} รองผอ.วิชาการ ${course.status_director || ''}
            </div>
            <div class="status-step">
              ${isAdmin ? `<input type="checkbox" ${course.scanned ? 'checked' : ''} onchange="updateScanned('${course.__backendId}', this.checked)">` : ''}
              ${course.scanned ? '✅' : '⬜'} Scan ลง File Sharing
            </div>
          </div>
        </td>
        <td>
          ${
            isAdmin
              ? `<input type="file" accept=".pdf" onchange="uploadPDF('${course.__backendId}', this.files[0])">`
              : (course.pdf_url
                  ? `<a href="${course.pdf_url}" target="_blank" style="color: #667eea;">📥 ดาวน์โหลด</a>`
                  : 'ไม่มีไฟล์')
          }
        </td>
        ${isAdmin ? `
          <td>
            <button class="btn-icon" onclick="editCourse('${course.__backendId}')">✏️</button>
            <button class="btn-icon" onclick="deleteCourse('${course.__backendId}')">🗑️</button>
          </td>
        ` : ''}
        <td>
          <span class="status-badge ${isOverdue ? 'status-overdue' : 'status-normal'}">
            ${isOverdue ? 'เกินกำหนด' : 'ปกติ'}
          </span>
        </td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
    ${renderPagination(courses.length)}
  `;

  document.getElementById('homeTableContainer').innerHTML = tableHTML;
}

function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  return `
    <div class="pagination">
      <button onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>◀ หน้าแรก</button>
      <button onclick="goToPage(${currentPage - 10})" ${currentPage <= 10 ? 'disabled' : ''}>⏮ -10</button>
      <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&lt; ก่อนหน้า</button>
      <span class="current-page">หน้า ${currentPage} / ${totalPages}</span>
      <button onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>ถัดไป &gt;</button>
      <button onclick="goToPage(${currentPage + 10})" ${currentPage + 10 > totalPages ? 'disabled' : ''}>+10 ⏭</button>
      <button onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>หน้าสุดท้าย ▶</button>
    </div>
  `;
}

function goToPage(page) {
  const year    = document.getElementById('yearFilter').value;
  const courses = allData.filter(d => d.type === 'course' && String(d.academic_year) === String(year));
  const totalPages = Math.ceil(courses.length / itemsPerPage) || 1;

  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    renderHomeTable(currentUser.position === 'admin');
  }
}

function filterByYear() {
  currentPage = 1;
  renderStats();
  renderHomeTable(currentUser.position === 'admin');
}

// === Update status / scanned ===
async function updateStatus(courseId, statusType, checked) {
  const course = allData.find(d => d.__backendId === courseId);
  if (!course) return;

  const date = checked ? new Date().toLocaleDateString('th-TH') : '';
  const updates = {};

  if (statusType === 'academic') updates.status_academic = date;
  if (statusType === 'homeroom') updates.status_homeroom = date;
  if (statusType === 'director') updates.status_director = date;

  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const result = await window.dataSdk.update({ ...course, ...updates });

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    // reload data
    await window.dataSdk.init(dataHandler);
  } else {
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
}

async function updateScanned(courseId, checked) {
  const course = allData.find(d => d.__backendId === courseId);
  if (!course) return;

  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const result = await window.dataSdk.update({ ...course, scanned: checked });

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    await window.dataSdk.init(dataHandler);
  }
}

// Upload PDF (ตัวอย่าง แสดงข้อความเฉย ๆ)
function uploadPDF(courseId, file) {
  if (!file) return;

  Swal.fire({
    icon: 'info',
    title: 'การอัพโหลดไฟล์',
    text: 'ฟีเจอร์การอัพโหลดไฟล์จริงจะต้องเชื่อมต่อกับ Google Drive API ซึ่งต้องมีการตั้งค่าเพิ่มเติม',
    confirmButtonText: 'ตกลง'
  });
}

// === ตาราง Users / Courses / Teachers (admin) ===
function renderUsersTable() {
  const users = allData.filter(d => d.type === 'user');
  const tbody = document.getElementById('usersTableBody');

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.email || ''}</td>
      <td>${user.full_name || ''}</td>
      <td>${user.position === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</td>
      <td>${String(user.active) === 'true' ? '✅ ใช้งาน' : '❌ ปิดการใช้งาน'}</td>
      <td>
        <button class="btn-icon" onclick="editUser('${user.__backendId}')">✏️</button>
        <button class="btn-icon" onclick="toggleUserActive('${user.__backendId}')">
          ${String(user.active) === 'true' ? '🔒' : '🔓'}
        </button>
        <button class="btn-icon" onclick="resetPassword('${user.__backendId}')">🔑</button>
      </td>
    </tr>
  `).join('');
}

function renderCoursesTable() {
  const courses = allData.filter(d => d.type === 'course');
  const tbody = document.getElementById('coursesTableBody');

  tbody.innerHTML = courses.map(course => `
    <tr>
      <td>${course.course_name || ''}</td>
      <td>${course.coordinators || ''}</td>
      <td>${course.year_level || ''}</td>
      <td>${course.room || ''}</td>
      <td>${course.semester || ''}</td>
      <td>${course.due_date || ''}</td>
      <td>
        <button class="btn-icon" onclick="editCourse('${course.__backendId}')">✏️</button>
        <button class="btn-icon" onclick="deleteCourse('${course.__backendId}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function renderTeachersTable() {
  const teachers = allData.filter(d => d.type === 'teacher');
  const tbody = document.getElementById('teachersTableBody');

  tbody.innerHTML = teachers.map(teacher => `
    <tr>
      <td>${teacher.full_name || ''}</td>
      <td>
        <button class="btn-icon" onclick="editTeacher('${teacher.__backendId}')">✏️</button>
        <button class="btn-icon" onclick="deleteTeacher('${teacher.__backendId}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// === Modal helper ===
function showModal(title, content) {
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="btn-close" onclick="closeModal()">×</button>
      </div>
      ${content}
    </div>
  `;
  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('modalContainer').classList.remove('active');
}

// === Add / Edit User ===
function showAddUserModal() {
  showModal('เพิ่มผู้ใช้งาน', `
    <div class="form-row">
      <label>อีเมล</label>
      <input type="email" id="modalEmail" required>
    </div>
    <div class="form-row">
      <label>รหัสผ่าน</label>
      <input type="password" id="modalPassword" required>
    </div>
    <div class="form-row">
      <label>ชื่อ-สกุล</label>
      <input type="text" id="modalFullName" required>
    </div>
    <div class="form-row">
      <label>ตำแหน่ง</label>
      <select id="modalPosition">
        <option value="admin">ผู้ดูแลระบบ</option>
        <option value="user">ผู้ใช้งาน</option>
      </select>
    </div>
    <button class="btn-save" onclick="saveUser()">บันทึก</button>
  `);
}

async function saveUser(userId = null) {
  const email    = document.getElementById('modalEmail').value;
  const password = document.getElementById('modalPassword').value;
  const fullName = document.getElementById('modalFullName').value;
  const position = document.getElementById('modalPosition').value;

  if (!email || !password || !fullName) {
    Swal.fire('กรุณากรอกข้อมูลให้ครบ', '', 'warning');
    return;
  }

  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const userData = {
    type: 'user',
    email,
    password,
    full_name: fullName,
    position,
    active: true,
    created_at: new Date().toISOString()
  };

  let result;
  if (userId) {
    const user = allData.find(d => d.__backendId === userId);
    result = await window.dataSdk.update({ ...user, ...userData });
  } else {
    result = await window.dataSdk.create({ id: Date.now().toString(), ...userData });
  }

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    closeModal();
    await window.dataSdk.init(dataHandler);
  } else {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
  }
}

function editUser(userId) {
  const user = allData.find(d => d.__backendId === userId);
  if (!user) return;

  showModal('แก้ไขผู้ใช้งาน', `
    <div class="form-row">
      <label>อีเมล</label>
      <input type="email" id="modalEmail" value="${user.email}" required>
    </div>
    <div class="form-row">
      <label>รหัสผ่าน</label>
      <input type="password" id="modalPassword" value="${user.password}" required>
    </div>
    <div class="form-row">
      <label>ชื่อ-สกุล</label>
      <input type="text" id="modalFullName" value="${user.full_name}" required>
    </div>
    <div class="form-row">
      <label>ตำแหน่ง</label>
      <select id="modalPosition">
        <option value="admin" ${user.position === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option>
        <option value="user"  ${user.position === 'user'  ? 'selected' : ''}>ผู้ใช้งาน</option>
      </select>
    </div>
    <button class="btn-save" onclick="saveUser('${userId}')">บันทึก</button>
  `);
}

async function toggleUserActive(userId) {
  const user = allData.find(d => d.__backendId === userId);
  if (!user) return;

  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const result = await window.dataSdk.update({ ...user, active: !(String(user.active) === 'true') });

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    await window.dataSdk.init(dataHandler);
  }
}

async function resetPassword(userId) {
  const newPassword = '123456';

  const result = await Swal.fire({
    title: 'รีเซ็ตรหัสผ่าน',
    text: `รหัสผ่านใหม่จะเป็น: ${newPassword}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    const user = allData.find(d => d.__backendId === userId);
    if (!user) return;

    Swal.fire({
      title: 'กำลังบันทึก...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const updateResult = await window.dataSdk.update({ ...user, password: newPassword });

    if (updateResult.isOk) {
      Swal.fire({ icon: 'success', title: 'รีเซ็ตรหัสผ่านสำเร็จ', timer: 1500, showConfirmButton: false });
      await window.dataSdk.init(dataHandler);
    }
  }
}

// === Add / Edit Course ===
function showAddCourseModal() {
  const teachers = allData.filter(d => d.type === 'teacher');
  const teacherOptions = teachers
    .map(t => `<option value="${t.full_name}">${t.full_name}</option>`)
    .join('');

  showModal('เพิ่มรายวิชา', `
    <div class="form-row">
      <label>ชื่อรายวิชา</label>
      <input type="text" id="modalCourseName" required>
    </div>
    <div class="form-row">
      <label>อาจารย์ผู้ประสานงาน</label>
      <select id="modalCoordinators" multiple style="height: 100px;">
        ${teacherOptions}
      </select>
    </div>
    <div class="form-row">
      <label>ชั้นปี</label>
      <select id="modalYearLevel">
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
      </select>
    </div>
    <div class="form-row">
      <label>ห้อง</label>
      <input type="text" id="modalRoom" required>
    </div>
    <div class="form-row">
      <label>ภาคเรียน</label>
      <select id="modalSemester">
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="ฤดูร้อน">ฤดูร้อน</option>
      </select>
    </div>
    <div class="form-row">
      <label>วันที่กำหนดส่ง</label>
      <input type="date" id="modalDueDate" required>
    </div>
    <button class="btn-save" onclick="saveCourse()">บันทึก</button>
  `);
}

async function saveCourse(courseId = null) {
  const courseName  = document.getElementById('modalCourseName').value;
  const coordinators = Array.from(document.getElementById('modalCoordinators').selectedOptions)
    .map(o => o.value).join(', ');
  const yearLevel = document.getElementById('modalYearLevel').value;
  const room      = document.getElementById('modalRoom').value;
  const semester  = document.getElementById('modalSemester').value;
  const dueDate   = document.getElementById('modalDueDate').value;

  if (!courseName || !coordinators || !room || !dueDate) {
    Swal.fire('กรุณากรอกข้อมูลให้ครบ', '', 'warning');
    return;
  }

  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const courseData = {
    type: 'course',
    course_name: courseName,
    coordinators,
    year_level: yearLevel,
    room,
    semester,
    due_date: dueDate,
    academic_year: document.getElementById('yearFilter').value,
    status_academic: '',
    status_homeroom: '',
    status_director: '',
    scanned: false,
    pdf_url: '',
    created_at: new Date().toISOString()
  };

  let result;
  if (courseId) {
    const course = allData.find(d => d.__backendId === courseId);
    result = await window.dataSdk.update({ ...course, ...courseData });
  } else {
    result = await window.dataSdk.create({ id: Date.now().toString(), ...courseData });
  }

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    closeModal();
    await window.dataSdk.init(dataHandler);
  } else {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
  }
}

function editCourse(courseId) {
  const course = allData.find(d => d.__backendId === courseId);
  if (!course) return;

  const teachers = allData.filter(d => d.type === 'teacher');
  const teacherOptions = teachers.map(t =>
    `<option value="${t.full_name}" ${String(course.coordinators).includes(t.full_name) ? 'selected' : ''}>${t.full_name}</option>`
  ).join('');

  showModal('แก้ไขรายวิชา', `
    <div class="form-row">
      <label>ชื่อรายวิชา</label>
      <input type="text" id="modalCourseName" value="${course.course_name}" required>
    </div>
    <div class="form-row">
      <label>อาจารย์ผู้ประสานงาน</label>
      <select id="modalCoordinators" multiple style="height: 100px;">
        ${teacherOptions}
      </select>
    </div>
    <div class="form-row">
      <label>ชั้นปี</label>
      <select id="modalYearLevel">
        <option value="1" ${course.year_level === '1' ? 'selected' : ''}>1</option>
        <option value="2" ${course.year_level === '2' ? 'selected' : ''}>2</option>
        <option value="3" ${course.year_level === '3' ? 'selected' : ''}>3</option>
        <option value="4" ${course.year_level === '4' ? 'selected' : ''}>4</option>
        <option value="5" ${course.year_level === '5' ? 'selected' : ''}>5</option>
        <option value="6" ${course.year_level === '6' ? 'selected' : ''}>6</option>
      </select>
    </div>
    <div class="form-row">
      <label>ห้อง</label>
      <input type="text" id="modalRoom" value="${course.room}" required>
    </div>
    <div class="form-row">
      <label>ภาคเรียน</label>
      <select id="modalSemester">
        <option value="1" ${course.semester === '1' ? 'selected' : ''}>1</option>
        <option value="2" ${course.semester === '2' ? 'selected' : ''}>2</option>
        <option value="ฤดูร้อน" ${course.semester === 'ฤดูร้อน' ? 'selected' : ''}>ฤดูร้อน</option>
      </select>
    </div>
    <div class="form-row">
      <label>วันที่กำหนดส่ง</label>
      <input type="date" id="modalDueDate" value="${course.due_date}" required>
    </div>
    <button class="btn-save" onclick="saveCourse('${courseId}')">บันทึก</button>
  `);
}

async function deleteCourse(courseId) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ',
    text: 'คุณต้องการลบรายวิชานี้หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#d32f2f'
  });

  if (result.isConfirmed) {
    const course = allData.find(d => d.__backendId === courseId);
    if (!course) return;

    Swal.fire({
      title: 'กำลังลบ...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const delResult = await window.dataSdk.delete(course);

    if (delResult.isOk) {
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
      await window.dataSdk.init(dataHandler);
    }
  }
}

// === Add / Edit Teacher ===
function showAddTeacherModal() {
  showModal('เพิ่มอาจารย์', `
    <div class="form-row">
      <label>ชื่อ-สกุล</label>
      <input type="text" id="modalTeacherName" required>
    </div>
    <button class="btn-save" onclick="saveTeacher()">บันทึก</button>
  `);
}

async function saveTeacher(teacherId = null) {
  const teacherName = document.getElementById('modalTeacherName').value;

  if (!teacherName) {
    Swal.fire('กรุณากรอกชื่อ-สกุล', '', 'warning');
    return;
  }

  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const teacherData = {
    type: 'teacher',
    full_name: teacherName,
    created_at: new Date().toISOString()
  };

  let result;
  if (teacherId) {
    const teacher = allData.find(d => d.__backendId === teacherId);
    result = await window.dataSdk.update({ ...teacher, ...teacherData });
  } else {
    result = await window.dataSdk.create({ id: Date.now().toString(), ...teacherData });
  }

  if (result.isOk) {
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
    closeModal();
    await window.dataSdk.init(dataHandler);
  } else {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
  }
}

function editTeacher(teacherId) {
  const teacher = allData.find(d => d.__backendId === teacherId);
  if (!teacher) return;

  showModal('แก้ไขอาจารย์', `
    <div class="form-row">
      <label>ชื่อ-สกุล</label>
      <input type="text" id="modalTeacherName" value="${teacher.full_name}" required>
    </div>
    <button class="btn-save" onclick="saveTeacher('${teacherId}')">บันทึก</button>
  `);
}

async function deleteTeacher(teacherId) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ',
    text: 'คุณต้องการลบอาจารย์ท่านนี้หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#d32f2f'
  });

  if (result.isConfirmed) {
    const teacher = allData.find(d => d.__backendId === teacherId);
    if (!teacher) return;

    Swal.fire({
      title: 'กำลังลบ...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const delResult = await window.dataSdk.delete(teacher);

    if (delResult.isOk) {
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
      await window.dataSdk.init(dataHandler);
    }
  }
}

// === Event listeners เริ่มต้น ===
document.getElementById('loginForm').addEventListener('submit', handleLogin);

// run init
init();

