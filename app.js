// ====== CONFIG (External API) ======
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzPq1Bkg1-OTK1mnoWNgO1jRu8OZ-0FFYYL7iRQWmPYZH5EE0o-k6PBFK8xVArm_mBvZA/exec";

// ====== dataSdk Adapter (hybrid: google.script.run or fetch) ======
(function () {
  if (window.dataSdk && window.dataSdk.__wired) return;

  const isAppsScript = (typeof google !== 'undefined' && google.script && google.script.run);
  const state = { handler: null };

  async function refresh_via_fetch() {
    const res = await fetch(`${SCRIPT_URL}?action=getAllData`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'omit'
    });
    const data = await res.json();
    if (state.handler && typeof state.handler.onDataChanged === 'function') {
      state.handler.onDataChanged(Array.isArray(data) ? data : []);
    }
  }

  function refresh_via_gas() {
    google.script.run
      .withSuccessHandler(function (data) {
        if (state.handler && typeof state.handler.onDataChanged === 'function') {
          state.handler.onDataChanged(data || []);
        }
      })
      .getAllData();
  }

  async function postJSON(action, payload) {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ action, data: payload })
    });
    return res.json();
  }

  window.dataSdk = {
    __wired: true,
    async init(handler) {
      state.handler = handler || null;
      if (isAppsScript) {
        refresh_via_gas();
      } else {
        await refresh_via_fetch();
      }
      return { isOk: true };
    },
    async create(obj) {
      if (isAppsScript) {
        return new Promise(resolve => {
          google.script.run
            .withSuccessHandler(res => { refresh_via_gas(); resolve({ isOk: !!(res && res.success) }); })
            .createRecord(obj);
        });
      } else {
        const res = await postJSON('createRecord', obj);
        await refresh_via_fetch();
        return { isOk: !!(res && res.success) };
      }
    },
    async update(obj) {
      if (isAppsScript) {
        return new Promise(resolve => {
          google.script.run
            .withSuccessHandler(res => { refresh_via_gas(); resolve({ isOk: !!(res && res.success) }); })
            .updateRecord(obj);
        });
      } else {
        const res = await postJSON('updateRecord', obj);
        await refresh_via_fetch();
        return { isOk: !!(res && res.success) };
      }
    },
    async delete(obj) {
      if (isAppsScript) {
        return new Promise(resolve => {
          google.script.run
            .withSuccessHandler(res => { refresh_via_gas(); resolve({ isOk: !!(res && res.success) }); })
            .deleteRecord(obj);
        });
      } else {
        const res = await postJSON('deleteRecord', obj);
        await refresh_via_fetch();
        return { isOk: !!(res && res.success) };
      }
    }
  };
})();

// Boot if DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.initApp) window.initApp();
});