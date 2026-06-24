import { getClasses, createClass, updateClass, deleteClass, searchStudents } from '../dao.js';
import { showModal, hideModal, showConfirm } from '../components/modal.js';
import { navigate, setNavbar } from '../app.js';

let debounceTimer = null;

export async function renderClassList(container) {
  setNavbar({
    title: '班级管理助手',
    showBack: false,
    actions: '<button class="nav-btn" id="btn-tag-manage" title="标签管理">⚙</button>',
  });

  const classes = await getClasses();

  const cardsHTML = classes.length === 0
    ? `<div class="empty-state">
        <div class="empty-icon">📚</div>
        <p>还没有班级<br>点击右下角按钮创建第一个班级</p>
      </div>`
    : `<div class="card-grid">
        ${classes.map(c => `
          <div class="card class-card" data-id="${c.id}">
            <div class="class-card-body">
              <h3>${c.name}</h3>
              <div class="class-card-count">
                <span class="count-num">${c.student_count}</span>
                <span>名学生</span>
              </div>
              <div class="card-actions">
                <button class="btn-icon btn-edit" data-id="${c.id}" title="编辑">✏</button>
                <button class="btn-icon btn-delete" data-id="${c.id}" title="删除">🗑</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;

  container.innerHTML = `
    <div class="search-bar">
      <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input class="search-input" type="text" placeholder="搜索学生姓名...">
      <div class="search-results" style="display:none"></div>
    </div>
    ${cardsHTML}
    <button class="fab">+</button>
  `;

  container.querySelector('.fab').addEventListener('click', () => {
    showModal({
      title: '新建班级',
      content: `
        <form id="form-create-class" class="modal-form">
          <div class="form-group">
            <label>班级名称</label>
            <input type="text" name="name" class="form-input" required placeholder="请输入班级名称" autofocus>
          </div>
          <button type="submit" class="btn btn-primary btn-block">创建</button>
        </form>
      `,
    });
    document.getElementById('form-create-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = e.target.name.value.trim();
      if (!name) return;
      await createClass(name);
      hideModal();
      renderClassList(container);
    });
  });

  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const cls = classes.find(c => c.id === id);
      if (!cls) return;

      showModal({
        title: '编辑班级',
        content: `
          <form id="form-edit-class" class="modal-form">
            <div class="form-group">
              <label>班级名称</label>
              <input type="text" name="name" class="form-input" required value="${cls.name}" autofocus>
            </div>
            <button type="submit" class="btn btn-primary btn-block">保存</button>
          </form>
        `,
      });
      document.getElementById('form-edit-class').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const name = ev.target.name.value.trim();
        if (!name) return;
        await updateClass(id, name);
        hideModal();
        renderClassList(container);
      });
    });
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const confirmed = await showConfirm({
        title: '删除班级',
        message: '删除班级将同时删除该班级下所有学生数据',
        confirmText: '删除',
      });
      if (confirmed) {
        await deleteClass(id);
        renderClassList(container);
      }
    });
  });

  container.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('click', () => {
      navigate(`#/class/${card.dataset.id}`);
    });
  });

  const searchInput = container.querySelector('.search-input');
  const searchResults = container.querySelector('.search-results');

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const keyword = searchInput.value.trim();

    if (!keyword) {
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      const results = await searchStudents(keyword);
      if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-empty">未找到匹配的学生</div>';
      } else {
        searchResults.innerHTML = results.map(s => `
          <div class="search-item" data-id="${s.id}">
            <span class="search-item-name">${s.name}</span>
            <span class="search-item-class">${s.class_name}</span>
          </div>
        `).join('');
      }
      searchResults.style.display = '';

      searchResults.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          navigate(`#/student/${item.dataset.id}`);
        });
      });
    }, 300);
  });

  const btnTagManage = document.getElementById('btn-tag-manage');
  if (btnTagManage) {
    btnTagManage.addEventListener('click', () => {
      navigate('#/tags');
    });
  }
}
