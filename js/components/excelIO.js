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

  // Use Web Share API on mobile for better UX
  if (navigator.share && navigator.canShare) {
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName });
      return { count: rows.length, fileName };
    }
  }

  // Fallback: blob download
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
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

  if (navigator.share && navigator.canShare) {
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName });
      return;
    }
  }

  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
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
