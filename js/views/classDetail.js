import { getClass, getStudentsByClass, createStudent } from '../dao.js';
import { showModal, hideModal } from '../components/modal.js';
import { navigate, setNavbar } from '../app.js';

export async function renderClassDetail(container, classId) {
  const cls = await getClass(classId);

  if (!cls) {
    container.innerHTML = '<div class="empty-state"><p>班级不存在或已被删除</p></div>';
    setNavbar({ title: '错误', showBack: true });
    return;
  }

  setNavbar({ title: cls.name, showBack: true, actions: '' });

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
}
