import { querySQL, runSQL, genId } from '../db.js';
import { createStudent, getStudentsByClass, setStudentTags, getStudentTags } from '../dao.js';

const BOARDING_TAG_ID = 'tag_boarding';

export async function importStudentsFromExcel(classId, file) {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('Excel 文件中没有数据');
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = (row['姓名'] || '').toString().trim();
    if (!name) {
      skipped++;
      continue;
    }

    const gender = normalizeGender(row['性别']);
    const isBoarding = normalizeBoarding(row['是否寄宿生']);

    const studentId = await createStudent({
      classId,
      name,
      gender,
      photo: null,
      description: null,
      birthday: null,
    });

    if (isBoarding) {
      runSQL('INSERT OR IGNORE INTO student_tags (student_id, tag_id) VALUES (?,?)', [studentId, BOARDING_TAG_ID]);
    }

    imported++;
  }

  return { imported, skipped, total: rows.length };
}

export async function exportStudentsToExcel(classId, className) {
  const students = await getStudentsByClass(classId);

  const rows = students.map((stu, index) => {
    const tags = (stu.tags || []).map(t => t.label);
    const isBoarding = tags.includes('寄宿生') ? '是' : '否';
    const allTags = tags.filter(t => t !== '寄宿生').join('、');

    return {
      '序号': index + 1,
      '姓名': stu.name || '',
      '性别': stu.gender || '',
      '是否寄宿生': isBoarding,
      '描述': stu.description || '',
      '所有标签': allTags,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 6 },
    { wch: 10 },
    { wch: 30 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, className || '学生信息');

  const fileName = `${className || '学生信息'}_${formatDate(new Date())}.xlsx`;
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  await saveFileToDevice(blob, fileName);
  return { count: rows.length, fileName };
}

export async function generateImportTemplate() {
  const rows = [
    { '姓名': '张三', '性别': '男', '是否寄宿生': '是' },
    { '姓名': '李四', '性别': '女', '是否寄宿生': '否' },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 10 }, { wch: 6 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '导入模板');

  const fileName = '学生导入模板.xlsx';
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  await saveFileToDevice(blob, fileName);
}

/**
 * Mobile-friendly file save: tries Web Share API first (shows system share sheet
 * where user can choose "Save to Files" etc.), falls back to showing a download
 * dialog with explicit save button and guidance.
 */
export async function saveFileToDevice(blob, fileName) {
  // 1. Try File System Access API (lets user pick save location directly)
  if (window.showSaveFilePicker) {
    try {
      const ext = fileName.split('.').pop();
      const types = ext === 'xlsx' ? [{
        description: 'Excel 文件',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
      }] : [{
        description: '数据文件',
        accept: { 'application/octet-stream': [`.${ext}`] },
      }];
      const handle = await window.showSaveFilePicker({ suggestedName: fileName, types });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
  }

  // 2. Try Web Share API (shows system share sheet on mobile)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
  }

  // 3. Fallback: show a modal with explicit download action + guidance
  const url = URL.createObjectURL(blob);
  await showDownloadModal(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function showDownloadModal(url, fileName) {
  return new Promise((resolve) => {
    let overlay = document.getElementById('download-modal-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'download-modal-overlay';
    overlay.className = 'modal-overlay';

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const tip = isIOS
      ? '点击下方按钮后，在浏览器弹出的菜单中选择「下载」或「存储到"文件"」'
      : '点击下方按钮后，文件将保存到手机「下载」文件夹中';

    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <h2 class="modal-title">保存文件</h2>
        <div class="modal-body">
          <div style="text-align:center;padding:1rem 0">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5" style="margin-bottom:0.75rem">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <p style="font-size:0.95rem;color:var(--text-secondary);margin:0.5rem 0">${fileName}</p>
            <p style="font-size:0.85rem;color:var(--text-muted);margin:0.75rem 0">${tip}</p>
            <a id="download-modal-btn" href="${url}" download="${fileName}" target="_blank" rel="noopener"
               class="btn btn-primary btn-block" style="display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;margin-top:0.75rem;text-decoration:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              保存文件
            </a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.classList.remove('active');
      setTimeout(() => { overlay.remove(); resolve(); }, 300);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    overlay.querySelector('#download-modal-btn').addEventListener('click', () => {
      setTimeout(closeModal, 500);
    });

    requestAnimationFrame(() => overlay.classList.add('active'));
  });
}

function normalizeGender(val) {
  const s = (val || '').toString().trim();
  if (s === '男' || s === '女') return s;
  if (/^[Mm]/.test(s)) return '男';
  if (/^[Ff]/.test(s)) return '女';
  return null;
}

function normalizeBoarding(val) {
  const s = (val || '').toString().trim().toLowerCase();
  return s === '是' || s === '1' || s === 'yes' || s === 'true' || s === '寄宿' || s === '寄宿生';
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
