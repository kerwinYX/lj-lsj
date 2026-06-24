import { initDB } from './db.js';
import { renderClassList } from './views/classList.js';
import { renderClassDetail } from './views/classDetail.js';
import { renderStudentDetail } from './views/studentDetail.js';

function router() {
  const hash = location.hash || '#/classes';
  const container = document.getElementById('main-content');

  if (hash === '#/' || hash === '#/classes') {
    renderClassList(container);
  } else if (hash.startsWith('#/class/')) {
    const classId = hash.split('/')[2];
    renderClassDetail(container, classId);
  } else if (hash.startsWith('#/student/')) {
    const studentId = hash.split('/')[2];
    renderStudentDetail(container, studentId);
  } else {
    renderClassList(container);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initDB();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  window.addEventListener('hashchange', router);
  router();
});

export function navigate(hash) {
  location.hash = hash;
}

export function setNavbar({ title = '', showBack = false, actions = '' } = {}) {
  const navTitle = document.getElementById('nav-title');
  const navBack = document.getElementById('nav-back');
  const navActions = document.getElementById('nav-actions');

  if (navTitle) navTitle.textContent = title;

  if (navBack) {
    navBack.style.display = showBack ? '' : 'none';
    navBack.onclick = showBack ? () => history.back() : null;
  }

  if (navActions) navActions.innerHTML = actions || '';
}
