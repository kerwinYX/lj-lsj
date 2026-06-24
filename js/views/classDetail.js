import { getClass, getStudentsByClass, createStudent } from '../dao.js';
import { showModal, hideModal } from '../components/modal.js';
import { navigate, setNavbar } from '../app.js';
import { importStudentsFromExcel, exportStudentsToExcel, generateImportTemplate } from '../components/excelIO.js';

export async function renderClassDetail(container, classId) {
  const cls = await getClass(classId);

  if (!cls) {
    container.innerHTML = '<div class="empty-state"><p>班级不存在或已被删除</p></div>';
    setNavbar({ title: '错误', showBack: true });
    return;
  }

  setNavbar({
    title: cls.name,
    showBack: true,
    actions: `
      <button class="nav-btn" id="btn-more-actions" aria-label="更多操作">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    `,
  });

  const students = await getStudentsByClass(classId);

  const studentsHTML = students.length === 0
    ? '<div class="empty-state"><div class="empty-icon">👤</div><p>这个班级还没有学生<br>点击右下角按钮添加</p></div>'
    : `<div class="card-grid">
        ${students.map(s => {
          const avatar = s.photo
            ? `<img class="student-avatar" src="${s.photo}" alt="${s.name}">`
            : `<div class="student-avatar-default">${s.name.charAt(0)}</div>`;

          const tags = (s.tags || []).slice(0, 3).map(t => {
            const bg = t.dimension_color || '#94A3B8';
            return `<span class="tag" style="background:${bg}15;color:${bg}">${t.label}</span>`;
          }).join('');

          const extra = (s.tags || []).length > 3
            ? `<span class="tag tag-more">+${s.tags.length - 3}</span>`
            : '';

          return `
            <div class="card student-card" data-id="${s.id}">
              ${avatar}
              <p class="student-name">${s.name}</p>
              ${s.gender ? `<span style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${s.gender}</span>` : ''}
              <div class="student-tags">${tags}${extra}</div>
            </div>
          `;
        }).join('')}
      </div>`;

  container.innerHTML = `
    <div class="breadcrumb">
      <a href="#/classes">首页</a>
      <span class="sep">›</span>
      <span>${cls.name}</span>
    </div>
    ${studentsHTML}
    <button class="fab">+</button>
  `;

  container.querySelectorAll('.student-card').forEach(card => {
    card.addEventListener('click', () => {
      navigate(`#/student/${card.dataset.id}`);
    });
  });

  container.querySelector('.fab').addEventListener('click', () => {
    showModal({
      title: '新增学生',
      content: `
        <form id="form-create-student" class="modal-form">
          <div class="form-group">
            <label>姓名</label>
            <input type="text" name="name" class="form-input" required placeholder="请输入学生姓名" autofocus>
          </div>
          <div class="form-group">
            <label>性别</label>
            <select name="gender" class="form-input">
              <option value="">请选择</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div class="form-group">
            <label>生日</label>
            <input type="date" name="birthday" class="form-input">
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea name="description" class="form-textarea" rows="3" placeholder="选填"></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">添加</button>
        </form>
      `,
    });

    document.getElementById('form-create-student').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = fd.get('name').trim();
      if (!name) return;

      await createStudent({
        classId,
        name,
        gender: fd.get('gender') || null,
        birthday: fd.get('birthday') || null,
        description: fd.get('description')?.trim() || null,
      });
      hideModal();
      renderClassDetail(container, classId);
    });
  });

  // More actions menu
  document.getElementById('btn-more-actions')?.addEventListener('click', () => {
    showModal({
      title: '更多操作',
      content: `
        <div class="action-menu">
          <button class="action-menu-item" id="btn-import-excel">
            <span class="action-menu-icon">📥</span>
            <div class="action-menu-text">
              <strong>导入学生</strong>
              <small>从 Excel 文件批量导入学生</small>
            </div>
          </button>
          <button class="action-menu-item" id="btn-export-excel">
            <span class="action-menu-icon">📤</span>
            <div class="action-menu-text">
              <strong>导出学生</strong>
              <small>导出本班学生信息为 Excel</small>
            </div>
          </button>
          <button class="action-menu-item" id="btn-download-template">
            <span class="action-menu-icon">📋</span>
            <div class="action-menu-text">
              <strong>下载导入模板</strong>
              <small>下载 Excel 模板文件，按格式填写后导入</small>
            </div>
          </button>
        </div>
      `,
    });

    document.getElementById('btn-import-excel').addEventListener('click', () => {
      hideModal();
      showImportModal(container, classId);
    });

    document.getElementById('btn-export-excel').addEventListener('click', async () => {
      hideModal();
      try {
        const result = await exportStudentsToExcel(classId, cls.name);
        showToast(`已导出 ${result.count} 名学生`);
      } catch (err) {
        if (err.name !== 'AbortError') showToast('导出失败: ' + err.message, 'error');
      }
    });

    document.getElementById('btn-download-template').addEventListener('click', async () => {
      hideModal();
      try {
        await generateImportTemplate();
        showToast('模板已下载');
      } catch (e) {
        if (e.name !== 'AbortError') showToast('下载失败', 'error');
      }
    });
  });
}

function showImportModal(container, classId) {
  showModal({
    title: '导入学生',
    content: `
      <div class="import-area">
        <div class="import-hint">
          <p>请选择 Excel 文件（.xlsx / .xls）</p>
          <p class="import-hint-sub">表头需包含：<strong>姓名</strong>、性别、是否寄宿生</p>
        </div>
        <label class="import-file-label">
          <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" hidden>
          <span class="btn btn-primary btn-block">选择文件</span>
        </label>
        <div id="import-status" class="import-status hidden"></div>
      </div>
    `,
  });

  const fileInput = document.getElementById('import-file-input');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = document.getElementById('import-status');
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto"></div><p>正在导入...</p>';

    try {
      const result = await importStudentsFromExcel(classId, file);
      statusEl.innerHTML = `
        <div class="import-result import-result-success">
          <p>导入完成</p>
          <p>成功导入 <strong>${result.imported}</strong> 名学生${result.skipped > 0 ? `，跳过 ${result.skipped} 条无效数据` : ''}</p>
        </div>
      `;
      setTimeout(() => {
        hideModal();
        renderClassDetail(container, classId);
      }, 1500);
    } catch (err) {
      statusEl.innerHTML = `<div class="import-result import-result-error"><p>导入失败: ${err.message}</p></div>`;
    }
  });
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
