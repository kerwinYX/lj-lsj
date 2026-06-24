import { getTagDimensions, getFreeTags, getStudentTags, setStudentTags, createTag } from '../dao.js';
import { showModal, hideModal } from './modal.js';

function renderChip(tag, color, isActive) {
  const cls = isActive ? 'tag-chip active' : 'tag-chip';
  const bg = isActive ? color : 'transparent';
  const fg = isActive ? '#fff' : color;
  const shadow = isActive ? `box-shadow:0 2px 8px ${color}40;` : '';
  return `<label class="${cls}" data-tag-id="${tag.id}"
    style="border:1.5px solid ${color};background:${bg};color:${fg};${shadow}
           min-height:36px;padding:4px 14px;border-radius:9999px;
           display:inline-flex;align-items:center;cursor:pointer;
           transition:all .2s;margin:4px;font-size:14px;user-select:none;font-weight:500">
    <input type="checkbox" style="display:none" ${isActive ? 'checked' : ''}>
    ${tag.label}
  </label>`;
}

function buildHTML(dimensions, freeTags, selectedSet) {
  let html = '';

  for (const dim of dimensions) {
    html += `<div class="tag-dimension" style="margin-bottom:20px">
      <div style="font-weight:700;margin-bottom:8px;color:${dim.color};font-size:14px;letter-spacing:0.02em">${dim.name}</div>
      <div style="display:flex;flex-wrap:wrap">
        ${dim.tags.map(t => renderChip(t, dim.color, selectedSet.has(t.id))).join('')}
      </div>
    </div>`;
  }

  html += `<div class="tag-dimension" style="margin-bottom:20px">
    <div style="font-weight:700;margin-bottom:8px;color:#94A3B8;font-size:14px;letter-spacing:0.02em">自由标签</div>
    <div id="free-tags-wrap" style="display:flex;flex-wrap:wrap">
      ${freeTags.map(t => renderChip(t, '#94A3B8', selectedSet.has(t.id))).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <input id="new-free-tag" type="text" placeholder="输入新标签..."
        class="form-input" style="height:40px;flex:1">
      <button id="add-free-tag" type="button" class="btn btn-primary"
        style="width:40px;height:40px;padding:0;border-radius:var(--radius-md);font-size:20px;flex-shrink:0">+</button>
    </div>
  </div>`;

  html += `<button id="tag-confirm-btn" class="btn btn-primary btn-block"
    style="margin-top:12px">确定</button>`;

  return html;
}

export async function showTagPicker(studentId) {
  const [dimensions, freeTags, studentTags] = await Promise.all([
    getTagDimensions(),
    getFreeTags(),
    getStudentTags(studentId)
  ]);

  const selectedSet = new Set(studentTags.map(t => t.id));

  const html = buildHTML(dimensions, freeTags, selectedSet);
  const modalBody = showModal({ title: '编辑标签', content: html });

  return new Promise((resolve) => {
    function handleChipClick(e) {
      const chip = e.target.closest('.tag-chip');
      if (!chip) return;
      e.preventDefault();
      e.stopPropagation();
      const tagId = chip.dataset.tagId;

      if (selectedSet.has(tagId)) {
        selectedSet.delete(tagId);
        chip.classList.remove('active');
        const color = chip.style.borderColor;
        chip.style.background = 'transparent';
        chip.style.color = color;
        chip.style.boxShadow = '';
      } else {
        selectedSet.add(tagId);
        chip.classList.add('active');
        const color = chip.style.borderColor;
        chip.style.background = color;
        chip.style.color = '#fff';
        chip.style.boxShadow = `0 2px 8px ${color}40`;
      }
    }

    modalBody.querySelectorAll('.tag-chip').forEach((chip) => {
      chip.addEventListener('click', handleChipClick);
    });

    const addBtn = document.getElementById('add-free-tag');
    const input = document.getElementById('new-free-tag');

    addBtn.addEventListener('click', async () => {
      const value = input.value.trim();
      if (!value) return;
      const newId = await createTag({ dimensionId: null, label: value });
      input.value = '';
      selectedSet.add(newId);
      const wrap = document.getElementById('free-tags-wrap');
      const temp = document.createElement('div');
      temp.innerHTML = renderChip({ id: newId, label: value }, '#94A3B8', true);
      const newChip = temp.firstElementChild;
      newChip.addEventListener('click', handleChipClick);
      wrap.appendChild(newChip);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addBtn.click();
      }
    });

    document.getElementById('tag-confirm-btn').addEventListener('click', async () => {
      await setStudentTags(studentId, [...selectedSet]);
      hideModal();
      resolve();
    });
  });
}
