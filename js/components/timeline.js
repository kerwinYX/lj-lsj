const TYPE_CONFIG = {
  talk:        { color: '#6366F1', icon: '💬', label: '谈话' },
  note:        { color: '#10B981', icon: '📝', label: '笔记' },
  tag_change:  { color: '#F59E0B', icon: '🏷️', label: '标签变更' },
  info_change: { color: '#8B5CF6', icon: '📋', label: '信息变更' },
};

export function formatDateTime(sqliteDateStr) {
  if (!sqliteDateStr) return '';
  const trimmed = sqliteDateStr.trim();
  if (trimmed.length <= 10) return trimmed;
  return trimmed.slice(0, 16);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildTypeBadge(item) {
  const cfg = TYPE_CONFIG[item.type] || { color: '#94A3B8', icon: '•', label: item.type };
  const text = item.type === 'talk' && item.sub_type
    ? `${cfg.label}·${item.sub_type}`
    : cfg.label;
  return `<span class="timeline-badge" style="background:${cfg.color}12;color:${cfg.color}">${cfg.icon} ${text}</span>`;
}

function buildContent(item) {
  if (item.type === 'talk') {
    const detail = item.detail || '';
    const truncated = detail.length > 60;
    const display = truncated ? escapeHTML(detail.slice(0, 60)) + '…' : escapeHTML(detail);

    let html = `<div class="timeline-content${truncated ? ' timeline-expandable' : ''}">
      <span class="timeline-short">${display}</span>
      ${truncated ? `<span class="timeline-full" style="display:none">${escapeHTML(detail)}</span>` : ''}
    </div>`;

    if (item.follow_up) {
      html += `<div class="timeline-followup">📌 追踪：${escapeHTML(item.follow_up)}</div>`;
    }
    return html;
  }

  return `<div class="timeline-content">${escapeHTML(item.detail)}</div>`;
}

function renderItem(item) {
  const cfg = TYPE_CONFIG[item.type] || { color: '#94A3B8' };

  return `<div class="timeline-item">
    <div class="timeline-dot" style="background:${cfg.color}"></div>
    <div class="timeline-card">
      <div class="timeline-header">
        <span class="timeline-time">${formatDateTime(item.created_at)}</span>
        ${buildTypeBadge(item)}
      </div>
      ${buildContent(item)}
    </div>
  </div>`;
}

export function renderTimeline(container, items) {
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="timeline-empty">
      <div style="font-size:40px;margin-bottom:12px;opacity:0.4">📋</div>
      还没有记录<br>开始添加谈话记录或笔记吧
    </div>`;
    return;
  }

  container.innerHTML = items.map(renderItem).join('');

  container.addEventListener('click', (e) => {
    const expandable = e.target.closest('.timeline-expandable');
    if (!expandable) return;

    expandable.classList.toggle('expanded');
    const short = expandable.querySelector('.timeline-short');
    const full = expandable.querySelector('.timeline-full');
    if (!short || !full) return;

    if (expandable.classList.contains('expanded')) {
      short.style.display = 'none';
      full.style.display = '';
    } else {
      short.style.display = '';
      full.style.display = 'none';
    }
  });
}
