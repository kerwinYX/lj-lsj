# 班主任班级学生管理系统 — 设计文档

## 1. 项目概述

一个面向班主任个人使用的学生管理工具。核心价值：帮助班主任系统化地记录、观察和理解每一个学生，将零散的印象转化为可追溯、可检索的结构化信息。

**使用者：** 单人（班主任本人），无需账号体系。

**技术方案：** 纯 HTML + CSS + Vanilla JS，PWA（Progressive Web App）形式。可在手机浏览器中"添加到主屏幕"，像原生 APP 一样全屏使用。数据存储使用 sql.js（SQLite 编译为 WebAssembly）+ 浏览器 OPFS（Origin Private File System），实现真正的本地 SQLite 数据库体验。

**设计原则：** 移动端优先。所有交互针对手机触屏优化，桌面端兼容但不是主要使用场景。

**第一版范围：**
- 班级管理（新建、编辑、删除）
- 学生信息录入（姓名、照片、描述、家庭信息）
- 混合标签体系（预设维度 + 自由标签）
- 谈话记录（日期 + 类型 + 内容 + 可选追踪事项）
- 学生时间线视图（全量倒序 + 筛选）

**第一版不做：**
- 提醒功能（生日提醒、群体标签提醒等留待后续版本）
- 多用户/登录体系
- 数据云同步

---

## 2. 文件结构

```
lj-lsj/
├── index.html              # 主页面
├── manifest.json           # PWA 清单（应用名称、图标、主题色等）
├── sw.js                   # Service Worker（离线缓存 + sql.js WASM 文件缓存）
├── icons/                  # PWA 图标（192x192、512x512）
├── lib/
│   ├── sql-wasm.js         # sql.js 库（SQLite WASM 版）
│   └── sql-wasm.wasm       # SQLite WASM 二进制
├── css/
│   └── style.css           # 全局样式（移动端优先）
├── js/
│   ├── app.js              # 应用入口、路由、视图切换
│   ├── db.js               # 数据库层（sql.js 初始化、OPFS 持久化、建表）
│   ├── dao.js              # 数据访问层（每张表的 CRUD 方法，async 接口）
│   ├── views/
│   │   ├── classList.js    # 班级列表视图
│   │   ├── classDetail.js  # 班级详情（学生列表）视图
│   │   └── studentDetail.js# 学生详情视图
│   └── components/
│       ├── modal.js        # 通用模态框（底部弹出式，适配手机）
│       ├── tagPicker.js    # 标签选择/编辑组件
│       ├── timeline.js     # 时间线组件
│       └── photoUpload.js  # 照片上传组件（支持手机拍照）
└── docs/
```

---

## 3. PWA 配置

### 3.1 manifest.json

```json
{
  "name": "班级管理助手",
  "short_name": "班级助手",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4A90D9",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- `display: standalone` 使应用全屏运行，隐藏浏览器地址栏
- 手机端通过"添加到主屏幕"安装后，体验接近原生 APP

### 3.2 Service Worker

- 缓存策略：Cache First — 将 HTML/CSS/JS 等静态资源在首次加载时缓存
- 离线可用：所有功能均不依赖网络，Service Worker 确保断网后仍可正常使用
- 更新机制：每次打开时后台检查新版本，有更新则提示用户刷新

### 3.3 部署方式

只需将文件放到任意静态服务器（GitHub Pages、本地 HTTP 服务器等）即可。PWA 要求 HTTPS 或 localhost。

---

## 4. 页面结构与路由

### 4.1 路由方案

使用 hash 路由，通过 `hashchange` 事件切换视图：

| 路由 | 视图 | 说明 |
|------|------|------|
| `#/` 或 `#/classes` | 班级列表页 | 首页，展示所有班级 |
| `#/class/:classId` | 班级详情页 | 展示该班级的学生列表 |
| `#/student/:studentId` | 学生详情页 | 学生完整信息与时间线 |

### 4.2 视图描述

**班级列表页（首页）**
- 页面顶部：系统标题 + 全局搜索栏（按学生姓名搜索，跨班级）
- 主区域：班级卡片网格布局，每张卡片显示班级名称、学生人数
- 操作：新建班级按钮（打开模态框输入班级名称）、卡片右上角编辑/删除
- 空状态：引导用户创建第一个班级

**班级详情页**
- 顶部面包屑导航：首页 > 班级名称
- 学生卡片网格：每张卡片展示照片（或默认头像）、姓名、关键标签（最多显示 3 个）
- 操作：新增学生按钮、卡片点击进入学生详情
- 支持按标签筛选学生列表

**学生详情页**
- 顶部面包屑：首页 > 班级名称 > 学生姓名
- 左侧/上方：学生基本信息卡（照片、姓名、描述、家庭信息、标签区）
- 右侧/下方：时间线区域
- 操作按钮：编辑基本信息、添加谈话记录、添加描述笔记、编辑标签

---

## 5. 数据存储方案

### 5.1 技术选型：sql.js + OPFS

- **sql.js**：SQLite 编译为 WebAssembly，在浏览器中运行完整的 SQLite 引擎（约 1MB）
- **OPFS（Origin Private File System）**：浏览器提供的私有文件系统 API，数据持久化在本地，不会被常规的"清除浏览数据"清除
- 每次写操作后，将 SQLite 数据库的二进制内容写入 OPFS 中的 `class-manager.db` 文件
- 应用启动时，从 OPFS 读取 `.db` 文件并加载到 sql.js 中

### 5.2 架构分层

```
视图层 (views/)
    ↓ 调用
DAO 层 (dao.js)        ← 每张表一组 async CRUD 方法，模拟"请求数据库"
    ↓ 执行 SQL
数据库层 (db.js)        ← sql.js 实例管理、建表、OPFS 读写
    ↓ 持久化
OPFS                    ← 浏览器私有文件系统中的 class-manager.db
```

DAO 层所有方法均为 `async`，返回 Promise。视图层调用时使用 `await`，模拟网络请求数据库的体验。后续如果迁移为真正的后端 API，只需替换 DAO 层实现，视图层无需改动。

### 5.3 数据库初始化流程

1. 加载 sql.js WASM 模块
2. 尝试从 OPFS 读取 `class-manager.db`
3. 如果存在，用该文件初始化 SQLite 实例
4. 如果不存在（首次使用），创建新数据库并执行建表 SQL + 插入预设数据
5. 注册 `beforeunload` 事件，确保关闭前数据已持久化

---

## 5A. 数据模型（SQL 表结构）

### 5A.1 班级表（classes）

```sql
CREATE TABLE classes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 5A.2 学生表（students）

```sql
CREATE TABLE students (
  id          TEXT PRIMARY KEY,
  class_id    TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  photo       TEXT,              -- Base64 编码图片，可为空（使用默认头像）
  description TEXT,
  birthday    TEXT,              -- 格式 YYYY-MM-DD，第一版仅记录不提醒
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_students_class ON students(class_id);
```

### 5A.3 家庭成员表（family_members）

与前一版的 JSON 嵌套不同，家庭信息独立为表，支持灵活增减成员。

```sql
CREATE TABLE family_members (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relation   TEXT NOT NULL,      -- 关系：父亲、母亲、祖父、其他...
  name       TEXT,
  phone      TEXT,
  occupation TEXT,
  note       TEXT,               -- 备注（如"主要监护人"）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_family_student ON family_members(student_id);
```

### 5A.4 标签维度表（tag_dimensions）

```sql
CREATE TABLE tag_dimensions (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  color TEXT NOT NULL,           -- 十六进制颜色如 #4A90D9
  sort  INTEGER NOT NULL DEFAULT 0
);
```

系统预设维度（用户可修改和扩展）：
| 维度 | 颜色 |
|------|------|
| 学习能力 | #4A90D9（蓝） |
| 行为习惯 | #52C41A（绿） |
| 社交能力 | #FA8C16（橙） |
| 心理状态 | #722ED1（紫） |
| 特长爱好 | #F5222D（红） |

### 5A.5 标签表（tags）

```sql
CREATE TABLE tags (
  id           TEXT PRIMARY KEY,
  dimension_id TEXT REFERENCES tag_dimensions(id) ON DELETE SET NULL,  -- NULL 表示自由标签
  label        TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tags_dimension ON tags(dimension_id);
```

自由标签：`dimension_id` 为 NULL，用统一灰色展示。

### 5A.6 学生-标签关联表（student_tags）

```sql
CREATE TABLE student_tags (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tag_id     TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, tag_id)
);
```

### 5A.7 谈话记录表（talk_records）

```sql
CREATE TABLE talk_records (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,      -- 谈话日期 YYYY-MM-DD
  type       TEXT NOT NULL,      -- 谈话类型
  content    TEXT NOT NULL,
  follow_up  TEXT,               -- 可选追踪事项
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_talks_student ON talk_records(student_id);
CREATE INDEX idx_talks_date ON talk_records(date);
```

预设谈话类型：学习辅导、行为纠正、心理疏导、家校沟通、日常交流、表扬鼓励。

### 5A.8 描述笔记表（notes）

```sql
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notes_student ON notes(student_id);
```

### 5A.9 时间线事件表（timeline_events）

标签变更和基本信息变更由系统自动生成。

```sql
CREATE TABLE timeline_events (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,      -- tag_change | info_change
  detail     TEXT NOT NULL,      -- 变更描述文字
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_student ON timeline_events(student_id);
```

谈话记录和笔记不重复存为事件。时间线渲染时用 SQL UNION 合并四种来源并按时间排序：

```sql
SELECT id, student_id, 'talk' AS type, content AS detail, created_at FROM talk_records WHERE student_id = ?
UNION ALL
SELECT id, student_id, 'note' AS type, content AS detail, created_at FROM notes WHERE student_id = ?
UNION ALL
SELECT id, student_id, type, detail, created_at FROM timeline_events WHERE student_id = ?
ORDER BY created_at DESC;
```

### 5A.10 ID 生成规则

所有实体 ID 格式为 `前缀_时间戳`，如 `cls_1719100000000`。前缀：`cls`（班级）、`stu`（学生）、`fm`（家庭成员）、`dim`（维度）、`tag`（标签）、`talk`（谈话）、`note`（笔记）、`evt`（事件）。时间戳使用 `Date.now()`。

---

## 6. 标签体系

### 6.1 标签管理

- 标签维度和标签在全局层面管理（所有班级共享同一套标签体系）
- 在班级列表页提供"标签管理"入口，可增删改维度及其下属标签
- 每个维度有一个关联颜色，该维度下所有标签用此颜色展示

### 6.2 给学生打标

- 在学生详情页的标签区域操作
- 点击"编辑标签"打开标签选择器（tagPicker 组件）
- 标签选择器分两部分：上方按维度分组展示预设标签（复选），下方为自由标签输入框
- 标签变更会生成一条时间线事件（记录添加/移除了什么标签）

### 6.3 按标签筛选

- 班级详情页支持按标签筛选学生
- 点击任意标签可快速筛选出拥有该标签的所有学生

---

## 7. 时间线

### 7.1 时间线事件类型

时间线混合展示以下类型的事件，每种类型有不同的图标和颜色：

| 类型 | 图标含义 | 来源 |
|------|----------|------|
| 谈话记录 | 对话气泡 | 用户手动添加 |
| 描述笔记 | 笔记本 | 用户手动添加 |
| 标签变更 | 标签 | 编辑标签时自动生成 |
| 基本信息变更 | 编辑 | 编辑学生信息时自动生成 |

### 7.2 展示与筛选

- 默认：全量事件按时间倒序排列
- 筛选栏：按事件类型筛选（多选复选框），如"只看谈话记录"
- 每条事件显示：类型图标 + 日期时间 + 摘要内容
- 谈话记录条目可展开查看完整内容和追踪事项

---

## 8. UI/UX 设计（移动端优先）

### 8.1 整体风格

- 简洁清爽的教育工具风格，白底 + 浅灰背景
- 主色调：柔和蓝色（#4A90D9），用于导航栏、按钮、强调元素
- 卡片式布局，圆角 + 轻微阴影
- 移动端优先：默认单栏布局，桌面端（≥768px）自动适配为多栏网格

### 8.2 移动端交互适配

- **底部弹出式面板（Bottom Sheet）** 替代传统模态框，新建/编辑操作从底部滑出，符合手机单手操作习惯
- **触摸友好**：按钮最小点击区域 44x44px，列表项间距充足
- **手机拍照**：照片上传组件 `<input accept="image/*" capture="environment">`，支持直接调用手机摄像头
- **顶部固定导航栏**：返回按钮 + 页面标题 + 操作按钮，参考原生 APP 导航栏
- **底部悬浮操作按钮（FAB）**：在班级详情页和学生详情页，右下角悬浮"+"按钮用于快速新增
- 删除操作需要二次确认
- 表单验证：必填字段即时提示

### 8.3 学生详情页移动端布局

在手机上，学生详情页采用单栏纵向排列：
1. 顶部导航栏（返回 + 学生姓名）
2. 学生信息卡（照片、姓名、描述、家庭信息）— 可折叠
3. 标签区
4. 操作按钮组（添加谈话记录 / 添加笔记 / 编辑标签）
5. 时间线（筛选栏 + 事件列表，无限滚动）

### 8.4 空状态处理

每个列表视图都需要友好的空状态提示：
- 班级列表为空："还没有班级，点击创建第一个班级"
- 学生列表为空："这个班级还没有学生，点击添加第一个学生"
- 时间线为空："还没有记录，开始添加谈话记录或笔记吧"

---

## 9. 数据安全

### 9.1 导出/导入

- **导出 .db 文件**：将 SQLite 数据库的完整二进制导出为 `.db` 文件下载，可用任意 SQLite 工具打开查看
- **导出 JSON**：将所有表数据序列化为 JSON 文件下载，便于阅读和二次处理
- **导入 .db 文件**：选择 `.db` 文件导入，替换当前数据库（需二次确认）
- 导出文件命名格式：`class-manager-backup-2026-06-23.db` 或 `.json`

### 9.2 存储限制与持久化

- OPFS 存储容量远大于 localStorage，通常为可用磁盘空间的较大比例，存储几百个学生的数据完全没有压力
- 照片使用 Base64 存储在 SQLite 的 TEXT 字段中
- 上传照片时自动压缩：限制最大宽度 400px，JPEG 质量 0.7，控制单张图片在 50KB 以内
- 每次数据写入操作后，自动将 SQLite 数据库持久化到 OPFS（使用防抖，避免频繁写入）
- OPFS 数据不会被浏览器常规的"清除缓存"清除，但"清除所有网站数据"会影响，因此建议用户定期导出备份

---

## 10. AI 总结能力（预留接口，第一版不实现）

### 10.1 设计意图

后续接入 AI（如 OpenAI / 国产大模型 API），基于学生的标签、谈话记录、笔记等数据，自动生成学生画像总结、发展趋势分析、关注建议等。

### 10.2 第一版预留

- **数据结构已就绪**：学生的标签、谈话记录、笔记均为结构化数据，可直接拼接为 prompt
- **UI 预留入口**：学生详情页预留一个"AI 总结"按钮位置（第一版显示为灰色/即将上线状态）
- **dao.js 预留**：导出一个 `getStudentFullContext(studentId)` 方法，通过 SQL JOIN 将某学生的所有信息（基本信息 + 家庭 + 标签 + 谈话记录 + 笔记）整合为一个结构化对象，方便后续直接传给 AI API

### 10.3 后续实现方向

- 用户配置自己的 API Key（存储在 localStorage 中，不上传）
- 点击"AI 总结"后，将学生上下文发送给 AI，流式返回总结文本
- 总结结果可保存为一条特殊类型的笔记，纳入时间线

---

## 11. 后续版本规划（不在第一版范围内）

以下功能明确排除在第一版之外，记录于此供后续参考：

- **AI 总结：** 接入大模型 API，自动生成学生画像和发展建议（见第 10 节）
- **提醒系统：** 生日提醒（进入系统时显示近期生日名单）、自定义提醒规则
- **群体分析：** 按标签组合筛选学生群体，批量操作
- **数据统计：** 班级标签分布图、谈话记录频次统计
- **照片存储优化：** 大量照片场景下可将 Base64 改为 Blob 存储在 OPFS 独立文件中
- **多端同步：** 通过文件导出/导入或云存储实现数据同步
- **打印支持：** 学生档案卡打印输出
