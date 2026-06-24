import { getClasses, createClass, updateClass, deleteClass, searchStudents } from '../dao.js';
import { showModal, hideModal, showConfirm } from '../components/modal.js';
import { navigate, setNavbar } from '../app.js';
import { exportDB, importDB, saveToOPFS } from '../db.js';

let debounceTimer = null;

export async function renderClassList(container) {
  setNavbar({
    title: '班级管理助手',
    showBack: false,
    actions: `
      <button class="nav-btn" id="btn-data-manage" title="数据管理" aria-label="数据管理">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="nav-btn" id="btn-tag-manage" title="标签管理">⚙</button>
    `,
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

  const btnDataManage = document.getElementById('btn-data-manage');
  if (btnDataManage) {
    btnDataManage.addEventListener('click', () => {
      showModal({
        title: '数据管理',
        content: `
          <div class="action-menu">
            <button class="action-menu-item" id="btn-backup-export">
              <span class="action-menu-icon">💾</span>
              <div class="action-menu-text">
                <strong>备份数据</strong>
                <small>导出全部数据，可用于换手机后恢复</small>
              </div>
            </button>
            <button class="action-menu-item" id="btn-backup-import">
              <span class="action-menu-icon">📂</span>
              <div class="action-menu-text">
                <strong>恢复数据</strong>
                <small>从备份文件恢复所有数据</small>
              </div>
            </button>
          </div>
          <p style="font-size:12px;color:var(--text-tertiary);text-align:center;margin-top:16px;line-height:1.5">
            备份文件包含所有班级、学生、标签、谈话记录等完整数据
          </p>
        `,
      });

      document.getElementById('btn-backup-export').addEventListener('click', async () => {
        hideModal();
        try {
          const data = exportDB();
          const blob = new Blob([data], { type: 'application/octet-stream' });
          const now = new Date();
          const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
          const fileName = `班级管理助手_备份_${ts}.db`;

          if (navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: 'application/octet-stream' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: '班级管理助手数据备份' });
              showToast('备份完成');
              return;
            }
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
          showToast('备份文件已下载');
        } catch (err) {
          if (err.name !== 'AbortError') showToast('备份失败: ' + err.message, 'error');
        }
      });

      document.getElementById('btn-backup-import').addEventListener('click', () => {
        hideModal();
        showModal({
          title: '恢复数据',
          content: `
            <div class="import-area">
              <div class="import-hint">
                <p style="color:var(--danger);font-weight:600">⚠️ 恢复将覆盖当前所有数据</p>
                <p>请选择之前导出的备份文件（.db）</p>
              </div>
              <label class="import-file-label">
                <input type="file" id="backup-file-input" accept=".db" hidden>
                <span class="btn btn-primary btn-block">选择备份文件</span>
              </label>
              <div id="backup-status" class="import-status hidden"></div>
            </div>
          `,
        });

        document.getElementById('backup-file-input').addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const statusEl = document.getElementById('backup-status');
          statusEl.classList.remove('hidden');
          statusEl.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto"></div><p>正在恢复...</p>';

          try {
            const buf = await file.arrayBuffer();
            await importDB(new Uint8Array(buf));
            statusEl.innerHTML = '<div class="import-result import-result-success"><p>数据恢复成功！</p></div>';
            setTimeout(() => {
              hideModal();
              location.reload();
            }, 1200);
          } catch (err) {
            statusEl.innerHTML = `<div class="import-result import-result-error"><p>恢复失败: ${err.message}</p></div>`;
          }
        });
      });
    });
  }
}

function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-msg toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
