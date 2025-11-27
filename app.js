// === URL Web App ของ Google Apps Script ===
const API_URL = 'hhttps://script.google.com/macros/s/AKfycbyNkg3e-K1rEBX67YtwYTZynNJb9NDYAQEOwhzhrdSynkkDkeJr6L7mV7fQx_CKoDPc/exec';
// ↑ อย่าลืมเปลี่ยนเป็น URL Web App จริง ๆ แบบเต็ม ๆ (ห้ามมี ...)


// === dataSdk: ใช้งานได้ทั้งในหน้า HTML ของ Apps Script และหน้าเว็บทั่วไป (เช่น GitHub Pages) ===
window.dataSdk = {
  // โหลดข้อมูลทั้งหมด
  init(handler) {
    // ถ้ามี google.script.run แสดงว่าอยู่ในหน้า HTML Service ของ Apps Script
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(res => {
          if (res && res.isOk) {
            handler.onDataChanged(res.data || []);
          } else {
            console.error(res ? res.error : 'unknown error');
            handler.onDataChanged([]);
          }
        })
        .withFailureHandler(err => {
          console.error(err);
          handler.onDataChanged([]);
        })
        .getAll();
      return;
    }

    // โหมด REST API : เรียกผ่าน URL ของ Web App (ใช้กับ GitHub Pages / เว็บอื่น)
    fetch(API_URL + '?action=getAll')
      .then(r => r.json())
      .then(res => {
        if (res && res.isOk) {
          handler.onDataChanged(res.data || []);
        } else {
          console.error(res ? res.error : 'unknown error');
          handler.onDataChanged([]);
        }
      })
      .catch(err => {
        console.error(err);
        handler.onDataChanged([]);
      });
  },

  // สร้างข้อมูล
  create(obj) {
    // HTML Service
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return new Promise(resolve => {
        google.script.run
          .withSuccessHandler(res => resolve(res))
          .withFailureHandler(err => resolve({ isOk: false, error: String(err) }))
          .createItem(obj);
      });
    }

    // REST API
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', payload: obj })
    })
      .then(r => r.json())
      .catch(err => ({ isOk: false, error: String(err) }));
  },

  // แก้ไขข้อมูล
  update(obj) {
    // HTML Service
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return new Promise(resolve => {
        google.script.run
          .withSuccessHandler(res => resolve(res))
          .withFailureHandler(err => resolve({ isOk: false, error: String(err) }))
          .updateItem(obj);
      });
    }

    // REST API
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', payload: obj })
    })
      .then(r => r.json())
      .catch(err => ({ isOk: false, error: String(err) }));
  },

  // ลบข้อมูล
  delete(obj) {
    // HTML Service
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      return new Promise(resolve => {
        google.script.run
          .withSuccessHandler(res => resolve(res))
          .withFailureHandler(err => resolve({ isOk: false, error: String(err) }))
          .deleteItem(obj);
      });
    }

    // REST API
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', payload: obj })
    })
      .then(r => r.json())
      .catch(err => ({ isOk: false, error: String(err) }));
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
  document.getElementById('systemTitle').textContent = defaultConfig.system_title;
  document.getElementById('institutionName').textContent = defaultConfig.institution_name;

  window.dataSdk.init(dataHandler);
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

  await new Promise(resolve => setTimeout(resolve, 500));

  const users = allData.filter(d => d.type === 'user');
  const user  = users.find(u =>
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

// ... (ส่วนที่เหลือของไฟล์ app.js เดิม เช่น renderDashboard, renderStats, CRUD ต่าง ๆ ใช้ต่อจากนี้ได้เลยเหมือนไฟล์เดิมของปอย)
