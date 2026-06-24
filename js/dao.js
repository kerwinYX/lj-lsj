import { runSQL, querySQL, queryOne, genId } from './db.js';

// ─── Classes ────────────────────────────────────────────
export async function getClasses() {
  return querySQL(`
    SELECT c.*, (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count
    FROM classes c ORDER BY c.created_at DESC
  `);
}

export async function getClass(id) {
  return queryOne('SELECT * FROM classes WHERE id = ?', [id]);
}

export async function createClass(name) {
  const id = genId('cls');
  runSQL('INSERT INTO classes (id, name) VALUES (?, ?)', [id, name]);
  return id;
}

export async function updateClass(id, name) {
  runSQL("UPDATE classes SET name = ?, updated_at = datetime('now','localtime') WHERE id = ?", [name, id]);
}

export async function deleteClass(id) {
  runSQL('DELETE FROM classes WHERE id = ?', [id]);
}

// ─── Students ───────────────────────────────────────────
export async function getStudentsByClass(classId) {
  const students = querySQL('SELECT * FROM students WHERE class_id = ? ORDER BY created_at DESC', [classId]);
  for (const stu of students) {
    stu.tags = querySQL(`
      SELECT t.*, td.name AS dimension_name, td.color AS dimension_color
      FROM student_tags st
      JOIN tags t ON st.tag_id = t.id
      LEFT JOIN tag_dimensions td ON t.dimension_id = td.id
      WHERE st.student_id = ?
    `, [stu.id]);
  }
  return students;
}

export async function getStudent(id) {
  const stu = queryOne('SELECT * FROM students WHERE id = ?', [id]);
  if (!stu) return null;
  stu.tags = querySQL(`
    SELECT t.*, td.name AS dimension_name, td.color AS dimension_color
    FROM student_tags st
    JOIN tags t ON st.tag_id = t.id
    LEFT JOIN tag_dimensions td ON t.dimension_id = td.id
    WHERE st.student_id = ?
  `, [id]);
  stu.family = querySQL('SELECT * FROM family_members WHERE student_id = ? ORDER BY created_at', [id]);
  return stu;
}

export async function createStudent({ classId, name, gender, photo, description, birthday }) {
  const id = genId('stu');
  runSQL(
    'INSERT INTO students (id, class_id, name, gender, photo, description, birthday) VALUES (?,?,?,?,?,?,?)',
    [id, classId, name, gender || null, photo || null, description || null, birthday || null]
  );
  return id;
}

export async function updateStudent(id, fields) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    sets.push(`${col} = ?`);
    params.push(v);
  }
  sets.push("updated_at = datetime('now','localtime')");
  params.push(id);
  runSQL(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteStudent(id) {
  runSQL('DELETE FROM students WHERE id = ?', [id]);
}

// ─── Family Members ─────────────────────────────────────
export async function getFamilyMembers(studentId) {
  return querySQL('SELECT * FROM family_members WHERE student_id = ? ORDER BY created_at', [studentId]);
}

export async function createFamilyMember({ studentId, relation, name, phone, occupation, note }) {
  const id = genId('fm');
  runSQL(
    'INSERT INTO family_members (id, student_id, relation, name, phone, occupation, note) VALUES (?,?,?,?,?,?,?)',
    [id, studentId, relation, name || null, phone || null, occupation || null, note || null]
  );
  return id;
}

export async function updateFamilyMember(id, fields) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    params.push(v);
  }
  params.push(id);
  runSQL(`UPDATE family_members SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteFamilyMember(id) {
  runSQL('DELETE FROM family_members WHERE id = ?', [id]);
}

// ─── Tag Dimensions & Tags ──────────────────────────────
export async function getTagDimensions() {
  const dims = querySQL('SELECT * FROM tag_dimensions ORDER BY sort');
  for (const dim of dims) {
    dim.tags = querySQL('SELECT * FROM tags WHERE dimension_id = ? ORDER BY created_at', [dim.id]);
  }
  return dims;
}

export async function getFreeTags() {
  return querySQL('SELECT * FROM tags WHERE dimension_id IS NULL ORDER BY created_at');
}

export async function createTagDimension({ name, color }) {
  const id = genId('dim');
  const maxSort = queryOne('SELECT MAX(sort) AS ms FROM tag_dimensions');
  runSQL('INSERT INTO tag_dimensions (id, name, color, sort) VALUES (?,?,?,?)',
    [id, name, color, (maxSort?.ms || 0) + 1]);
  return id;
}

export async function updateTagDimension(id, fields) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) { sets.push(`${k} = ?`); params.push(v); }
  params.push(id);
  runSQL(`UPDATE tag_dimensions SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteTagDimension(id) {
  runSQL('DELETE FROM tag_dimensions WHERE id = ?', [id]);
}

export async function createTag({ dimensionId, label }) {
  const id = genId('tag');
  runSQL('INSERT INTO tags (id, dimension_id, label) VALUES (?,?,?)', [id, dimensionId || null, label]);
  return id;
}

export async function deleteTag(id) {
  runSQL('DELETE FROM tags WHERE id = ?', [id]);
}

// ─── Student Tags ───────────────────────────────────────
export async function getStudentTags(studentId) {
  return querySQL(`
    SELECT t.*, td.name AS dimension_name, td.color AS dimension_color
    FROM student_tags st
    JOIN tags t ON st.tag_id = t.id
    LEFT JOIN tag_dimensions td ON t.dimension_id = td.id
    WHERE st.student_id = ?
  `, [studentId]);
}

export async function setStudentTags(studentId, tagIds) {
  const oldTags = querySQL('SELECT tag_id FROM student_tags WHERE student_id = ?', [studentId]);
  const oldSet = new Set(oldTags.map((r) => r.tag_id));
  const newSet = new Set(tagIds);

  const added = tagIds.filter((id) => !oldSet.has(id));
  const removed = [...oldSet].filter((id) => !newSet.has(id));

  for (const tagId of removed) {
    runSQL('DELETE FROM student_tags WHERE student_id = ? AND tag_id = ?', [studentId, tagId]);
  }
  for (const tagId of added) {
    runSQL('INSERT OR IGNORE INTO student_tags (student_id, tag_id) VALUES (?,?)', [studentId, tagId]);
  }

  if (added.length || removed.length) {
    const parts = [];
    if (added.length) {
      const labels = added.map((id) => {
        const t = queryOne('SELECT label FROM tags WHERE id = ?', [id]);
        return t ? `「${t.label}」` : id;
      });
      parts.push(`添加标签 ${labels.join('、')}`);
    }
    if (removed.length) {
      const labels = removed.map((id) => {
        const t = queryOne('SELECT label FROM tags WHERE id = ?', [id]);
        return t ? `「${t.label}」` : id;
      });
      parts.push(`移除标签 ${labels.join('、')}`);
    }
    runSQL('INSERT INTO timeline_events (id, student_id, type, detail) VALUES (?,?,?,?)',
      [genId('evt'), studentId, 'tag_change', parts.join('；')]);
  }
}

// ─── Talk Records ───────────────────────────────────────
export async function getTalkRecords(studentId) {
  return querySQL('SELECT * FROM talk_records WHERE student_id = ? ORDER BY created_at DESC', [studentId]);
}

export async function createTalkRecord({ studentId, date, type, content, followUp }) {
  const id = genId('talk');
  runSQL(
    'INSERT INTO talk_records (id, student_id, date, type, content, follow_up) VALUES (?,?,?,?,?,?)',
    [id, studentId, date, type, content, followUp || null]
  );
  return id;
}

export async function deleteTalkRecord(id) {
  runSQL('DELETE FROM talk_records WHERE id = ?', [id]);
}

// ─── Notes ──────────────────────────────────────────────
export async function getNotes(studentId) {
  return querySQL('SELECT * FROM notes WHERE student_id = ? ORDER BY created_at DESC', [studentId]);
}

export async function createNote({ studentId, content }) {
  const id = genId('note');
  runSQL('INSERT INTO notes (id, student_id, content) VALUES (?,?,?)', [id, studentId, content]);
  return id;
}

export async function deleteNote(id) {
  runSQL('DELETE FROM notes WHERE id = ?', [id]);
}

// ─── Timeline ───────────────────────────────────────────
export async function getTimeline(studentId, typeFilter = null) {
  let sql = `
    SELECT id, student_id, 'talk' AS type, content AS detail, date AS event_date, type AS sub_type, follow_up, created_at FROM talk_records WHERE student_id = ?
    UNION ALL
    SELECT id, student_id, 'note' AS type, content AS detail, NULL AS event_date, NULL AS sub_type, NULL AS follow_up, created_at FROM notes WHERE student_id = ?
    UNION ALL
    SELECT id, student_id, type, detail, NULL AS event_date, NULL AS sub_type, NULL AS follow_up, created_at FROM timeline_events WHERE student_id = ?
    ORDER BY created_at DESC
  `;
  let rows = querySQL(sql, [studentId, studentId, studentId]);
  if (typeFilter && typeFilter.length > 0) {
    rows = rows.filter((r) => typeFilter.includes(r.type));
  }
  return rows;
}

// ─── Search ─────────────────────────────────────────────
export async function searchStudents(keyword) {
  return querySQL(`
    SELECT s.*, c.name AS class_name
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.name LIKE ?
    ORDER BY s.name
  `, [`%${keyword}%`]);
}

// ─── AI Context (reserved) ──────────────────────────────
export async function getStudentFullContext(studentId) {
  const student = await getStudent(studentId);
  if (!student) return null;
  const talks = await getTalkRecords(studentId);
  const notesList = await getNotes(studentId);
  return { student, talks, notes: notesList };
}

// ─── Export all data as JSON ────────────────────────────
export async function exportAllAsJSON() {
  return {
    classes: querySQL('SELECT * FROM classes'),
    students: querySQL('SELECT * FROM students'),
    family_members: querySQL('SELECT * FROM family_members'),
    tag_dimensions: querySQL('SELECT * FROM tag_dimensions'),
    tags: querySQL('SELECT * FROM tags'),
    student_tags: querySQL('SELECT * FROM student_tags'),
    talk_records: querySQL('SELECT * FROM talk_records'),
    notes: querySQL('SELECT * FROM notes'),
    timeline_events: querySQL('SELECT * FROM timeline_events'),
  };
}
