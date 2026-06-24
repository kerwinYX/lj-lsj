import { getStudent, getClass, updateStudent, deleteStudent, createTalkRecord, createNote, getTimeline, getFamilyMembers, createFamilyMember, deleteFamilyMember, updateFamilyMember } from '../dao.js';
import { showModal, hideModal, showConfirm } from '../components/modal.js';
import { navigate, setNavbar } from '../app.js';
import { showTagPicker } from '../components/tagPicker.js';
import { renderTimeline } from '../components/timeline.js';
import { compressPhoto } from '../components/photoUpload.js';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const RELATION_ICONS = {
  '父亲': '👨', '母亲': '👩', '祖父': '👴', '祖母': '👵', '其他': '👤'
};

export async function renderStudentDetail(container, studentId) {
  const student = await getStudent(studentId);
  if (!student) {
    container.innerHTML = '<div class="empty-state"><p>找不到该学生信息</p></div>';
    return;
  }

  const cls = await getClass(student.class_id);
  const className = cls ? cls.name : '未知班级';

  setNavbar({
    title: student.name,
    showBack: true,
    actions: '<button class="nav-btn" id="btn-edit-student" title="编辑">✏️</button><button class="nav-btn" id="btn-delete-student" title="删除">🗑️</button>'
  });

  const avatarHTML = student.photo
    ? `<img class="profile-avatar" src="${student.photo}" alt="${escapeHTML(student.name)}">`
    : `<div class="profile-avatar-placeholder">${escapeHTML(student.name.charAt(0))}</div>`;

  const tagsHTML = student.tags && student.tags.length > 0
    ? student.tags.map(t =>
        `<span class="tag" style="background:${t.dimension_color || '#94A3B8'}18;color:${t.dimension_color || '#64748B'}">${escapeHTML(t.label)}</span>`
      ).join('')
    : '<span style="color:var(--text-tertiary);font-size:13px">暂无标签，点击右侧按钮添加</span>';

  const familyHTML = student.family && student.family.length > 0
    ? student.family.map(fm => `
        <div class="family-card" data-fm-id="${fm.id}">
          <div class="family-avatar">${RELATION_ICONS[fm.relation] || '👤'}</div>
          <div class="family-info">
            <div class="family-relation">${escapeHTML(fm.relation)}</div>
            <div class="family-name">${escapeHTML(fm.name || '未填写')}</div>
            <div class="family-detail">
              ${fm.phone ? `📞 ${escapeHTML(fm.phone)}` : ''}
              ${fm.occupation ? `${fm.phone ? ' · ' : ''}💼 ${escapeHTML(fm.occupation)}` : ''}
            </div>
          </div>
          <button class="btn-fm-delete btn-icon" data-fm-id="${fm.id}" title="删除">✕</button>
        </div>
      `).join('')
    : '<div style="padding:16px;text-align:center;color:var(--text-tertiary);font-size:13px">暂无家庭信息</div>';

  const metaBadges = [];
  if (student.gender) metaBadges.push(`<span class="profile-meta-badge">${student.gender}</span>`);
  if (student.birthday) metaBadges.push(`<span class="profile-meta-badge">🎂 ${formatDate(student.birthday)}</span>`);

  container.innerHTML = `
    <div class="breadcrumb">
      <a href="#/classes">班级列表</a>
      <span class="sep">›</span>
      <a href="#/class/${student.class_id}">${escapeHTML(className)}</a>
      <span class="sep">›</span>
      <span>${escapeHTML(student.name)}</span>
    </div>

    <div class="student-profile">
      <div id="avatar-area" style="cursor:pointer;position:relative;z-index:1">
        ${avatarHTML}
        <input type="file" id="photo-input" accept="image/*" capture="environment" style="display:none">
      </div>
      <h2 class="profile-name">${escapeHTML(student.name)}</h2>
      ${metaBadges.length > 0 ? `<div class="profile-meta">${metaBadges.join('')}</div>` : ''}
      <p class="profile-desc">${student.description ? escapeHTML(student.description) : ''}</p>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between" class="section-title">
      <span>🏷️ 标签</span>
      <button id="btn-edit-tags" class="btn-icon" style="color:var(--primary)" title="编辑标签">✏️</button>
    </div>
    <div class="page-section" style="margin-top:0">
      <div class="tags-container" style="padding:12px 14px">${tagsHTML}</div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between" class="section-title">
      <span>👨‍👩‍👧‍👦 家庭信息</span>
      <button id="btn-add-family" class="btn-icon" style="color:var(--primary);font-size:20px" title="添加家庭成员">+</button>
    </div>
    <div class="page-section" style="margin-top:0">
      <div id="family-list">${familyHTML}</div>
    </div>

    <div class="action-bar">
      <button class="action-btn action-btn-primary" id="btn-add-talk">💬 谈话记录</button>
      <button class="action-btn action-btn-primary" id="btn-add-note">📝 添加笔记</button>
      <button class="action-btn action-btn-disabled" disabled>🤖 AI总结</button>
    </div>

    <div class="section-title">📋 动态记录</div>
    <div id="timeline-filters" class="filter-bar">
      <button class="filter-chip active" data-filter="">全部</button>
      <button class="filter-chip" data-filter="talk">谈话</button>
      <button class="filter-chip" data-filter="note">笔记</button>
      <button class="filter-chip" data-filter="tag_change">标签变更</button>
      <button class="filter-chip" data-filter="info_change">信息变更</button>
    </div>
    <div id="timeline-container" style="padding:0 16px 80px"></div>
  `;

  // ── Edit student ──
  document.getElementById('btn-edit-student').addEventListener('click', () => {
    const body = showModal({
      title: '编辑学生信息',
      content: `
        <form id="form-edit-student">
          <div class="form-group">
            <label class="form-label">姓名</label>
            <input class="form-input" name="name" value="${escapeHTML(student.name)}" required>
          </div>
          <div class="form-group">
            <label class="form-label">性别</label>
            <select class="form-input" name="gender">
              <option value="">请选择</option>
              <option value="男" ${student.gender === '男' ? 'selected' : ''}>男</option>
              <option value="女" ${student.gender === '女' ? 'selected' : ''}>女</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">描述</label>
            <textarea class="form-textarea" name="description">${escapeHTML(student.description || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">生日</label>
            <input class="form-input" type="date" name="birthday" value="${student.birthday || ''}">
          </div>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px">保存</button>
        </form>
      `
    });
    body.querySelector('#form-edit-student').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await updateStudent(studentId, {
        name: fd.get('name'),
        gender: fd.get('gender') || null,
        description: fd.get('description'),
        birthday: fd.get('birthday') || null
      });
      hideModal();
      renderStudentDetail(container, studentId);
    });
  });

  // ── Delete student ──
  document.getElementById('btn-delete-student').addEventListener('click', async () => {
    const confirmed = await showConfirm({
      title: '删除学生',
      message: '确定删除该学生？所有相关记录将被一并删除'
    });
    if (confirmed) {
      await deleteStudent(studentId);
      navigate('#/class/' + student.class_id);
    }
  });

  // ── Photo upload ──
  const avatarArea = document.getElementById('avatar-area');
  const photoInput = document.getElementById('photo-input');
  avatarArea.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    const base64 = await compressPhoto(file);
    await updateStudent(studentId, { photo: base64 });
    renderStudentDetail(container, studentId);
  });

  // ── Tag editing ──
  document.getElementById('btn-edit-tags').addEventListener('click', async () => {
    await showTagPicker(studentId);
    renderStudentDetail(container, studentId);
  });

  // ── Add family member ──
  document.getElementById('btn-add-family').addEventListener('click', () => {
    const body = showModal({
      title: '添加家庭成员',
      content: `
        <form id="form-add-family">
          <div class="form-group">
            <label class="form-label">关系</label>
            <select class="form-input" name="relation" required>
              <option value="父亲">父亲</option>
              <option value="母亲">母亲</option>
              <option value="祖父">祖父</option>
              <option value="祖母">祖母</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">姓名</label>
            <input class="form-input" name="name">
          </div>
          <div class="form-group">
            <label class="form-label">联系电话</label>
            <input class="form-input" name="phone" type="tel">
          </div>
          <div class="form-group">
            <label class="form-label">职业</label>
            <input class="form-input" name="occupation">
          </div>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px">保存</button>
        </form>
      `
    });
    body.querySelector('#form-add-family').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await createFamilyMember({
        studentId,
        relation: fd.get('relation'),
        name: fd.get('name'),
        phone: fd.get('phone'),
        occupation: fd.get('occupation')
      });
      hideModal();
      renderStudentDetail(container, studentId);
    });
  });

  // ── Delete family member ──
  document.getElementById('family-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-fm-delete');
    if (!btn) return;
    const fmId = btn.dataset.fmId;
    const confirmed = await showConfirm({ message: '确定删除该家庭成员？' });
    if (confirmed) {
      await deleteFamilyMember(fmId);
      renderStudentDetail(container, studentId);
    }
  });

  // ── Add talk record ──
  document.getElementById('btn-add-talk').addEventListener('click', () => {
    const body = showModal({
      title: '添加谈话记录',
      content: `
        <form id="form-add-talk">
          <div class="form-group">
            <label class="form-label">日期</label>
            <input class="form-input" type="date" name="date" value="${today()}" required>
          </div>
          <div class="form-group">
            <label class="form-label">类型</label>
            <select class="form-input" name="type" required>
              <option value="学习辅导">学习辅导</option>
              <option value="行为纠正">行为纠正</option>
              <option value="心理疏导">心理疏导</option>
              <option value="家校沟通">家校沟通</option>
              <option value="日常交流">日常交流</option>
              <option value="表扬鼓励">表扬鼓励</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">内容</label>
            <textarea class="form-textarea" name="content" required placeholder="请输入谈话内容…"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">追踪事项</label>
            <textarea class="form-textarea" name="followUp" placeholder="可选，需要后续跟进的事项"></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px">保存</button>
        </form>
      `
    });
    body.querySelector('#form-add-talk').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await createTalkRecord({
        studentId,
        date: fd.get('date'),
        type: fd.get('type'),
        content: fd.get('content'),
        followUp: fd.get('followUp')
      });
      hideModal();
      renderStudentDetail(container, studentId);
    });
  });

  // ── Add note ──
  document.getElementById('btn-add-note').addEventListener('click', () => {
    const body = showModal({
      title: '添加笔记',
      content: `
        <form id="form-add-note">
          <div class="form-group">
            <label class="form-label">内容</label>
            <textarea class="form-textarea" name="content" required placeholder="请输入笔记内容…"></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px">保存</button>
        </form>
      `
    });
    body.querySelector('#form-add-note').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await createNote({ studentId, content: fd.get('content') });
      hideModal();
      renderStudentDetail(container, studentId);
    });
  });

  // ── Timeline filters ──
  const filtersContainer = document.getElementById('timeline-filters');
  const timelineContainer = document.getElementById('timeline-container');

  async function loadTimeline(typeFilter) {
    const filters = typeFilter ? [typeFilter] : null;
    const items = await getTimeline(studentId, filters);
    renderTimeline(timelineContainer, items);
  }

  filtersContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    filtersContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    loadTimeline(chip.dataset.filter);
  });

  const items = await getTimeline(studentId);
  renderTimeline(timelineContainer, items);
}
