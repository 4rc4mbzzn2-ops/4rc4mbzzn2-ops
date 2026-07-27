/* =========================================================
   我的专属工作台  —  纯本地存储 PWA
   数据全部保存在浏览器 localStorage，离线可用，可安装到 iOS 主屏幕
   ========================================================= */
(function () {
  "use strict";

  const KEY = "workbench_data_v1";

  /* ---------------- 数据层 ---------------- */
  function defaults() {
    return {
      settings: { dailyReset: true, userName: "" },
      plan: { lastReset: "", tasks: [] },
      videos: [],
      ideas: [],
      exercise: [],
      reading: [],
      english: [],
    };
  }

  let DB = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const d = JSON.parse(raw);
      return Object.assign(defaults(), d);
    } catch (e) {
      return defaults();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast("保存失败：存储空间不足"); }
  }

  /* ---------------- 工具 ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmt(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return fmt(new Date()); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function prettyDate(d) {
    const w = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + w;
  }
  function relTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
    return Math.floor(diff / 86400000) + "天前";
  }
  // 连续天数（到今天为止，若无今天记录则从昨天起算）
  function streak(dates) {
    const set = new Set(dates);
    let s = 0;
    const d = new Date();
    if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
    while (set.has(fmt(d))) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }

  let toastTimer;
  function toast(msg) {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
  }

  /* ---------------- 每日计划自动重置 ---------------- */
  function applyDailyReset() {
    const t = today();
    if (DB.settings.dailyReset && DB.plan.lastReset !== t) {
      DB.plan.tasks.forEach((x) => (x.done = false));
      DB.plan.lastReset = t;
      save();
    }
  }

  /* ---------------- 视图路由 ---------------- */
  const VIEWS = {
    plan: renderPlan, video: renderVideo, idea: renderIdea,
    exercise: renderExercise, reading: renderReading, english: renderEnglish, settings: renderSettings,
  };
  const TITLES = {
    plan: "每日计划", video: "爆款视频", idea: "灵感记录",
    exercise: "锻炼身体", reading: "每日阅读", english: "英语学习", settings: "设置",
  };
  let current = "plan";

  function go(name) {
    current = name;
    $$(".view").forEach((v) => (v.hidden = true));
    const el = $("#view-" + name);
    if (el) el.hidden = false;
    $$(".nav-item[data-view]").forEach((b) =>
      b.classList.toggle("active", b.dataset.view === name)
    );
    $("#topbarTitle").textContent = TITLES[name] || "";
    (VIEWS[name] || renderPlan)();
    closeSidebar();
    window.scrollTo(0, 0);
  }

  /* ---------------- 通用区块 ---------------- */
  function head(title, desc) {
    return `<div class="view-head"><h1 class="view-title">${esc(title)}</h1><span class="view-desc">${esc(desc || "")}</span></div>`;
  }
  function empty(text) { return `<div class="empty"><div class="big">📭</div>${esc(text)}</div>`; }

  /* ================= 1. 每日计划 ================= */
  function renderPlan() {
    applyDailyReset();
    const tasks = DB.plan.tasks;
    const done = tasks.filter((t) => t.done).length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

    const list = tasks.length
      ? tasks.map((t) => `
        <div class="item ${t.done ? "done" : ""}" data-id="${t.id}">
          <div class="check ${t.done ? "on" : ""}" data-act="toggle"></div>
          <div class="body"><div class="title">${esc(t.text)}</div>
            <div class="meta">${t.done ? "已完成" : "进行中"} · 添加于 ${prettyDate(new Date(t.createdAt))}</div></div>
          <div class="actions"><button class="btn danger sm" data-act="del">删除</button></div>
        </div>`).join("")
      : empty("还没有计划，先添加今天要做的事吧 ✍️");

    $("#view-plan").innerHTML = head("每日计划", DB.settings.dailyReset ? "每日 0 点自动重置为未完成" : "累积模式：完成状态长期保留") + `
      <div class="grid cols-3" style="margin-bottom:16px">
        <div class="card stat"><div class="num">${done}/${tasks.length}</div><div class="lbl">已完成 / 总数</div></div>
        <div class="card stat"><div class="num green">${pct}%</div><div class="lbl">今日完成度</div></div>
        <div class="card stat"><div class="num ink">${tasks.length ? (100 - pct) + "%" : "0%"}</div><div class="lbl">待完成</div></div>
      </div>
      <div class="card">
        <div class="row">
          <input id="planInput" class="field" placeholder="例如：完成周报、健身 30 分钟…" maxlength="120" />
          <button class="btn" id="planAdd">添加</button>
        </div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>
      <div class="section-title">任务清单</div>
      ${list}
    `;

    const input = $("#planInput");
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      DB.plan.tasks.push({ id: uid(), text: v, done: false, createdAt: Date.now() });
      save(); renderPlan();
    };
    $("#planAdd").onclick = add;
    input.onkeydown = (e) => { if (e.key === "Enter") add(); };

    $$("#view-plan .item").forEach((it) => {
      const id = it.dataset.id;
      it.querySelector('[data-act="toggle"]').onclick = () => {
        const t = DB.plan.tasks.find((x) => x.id === id); t.done = !t.done; save(); renderPlan();
      };
      it.querySelector('[data-act="del"]').onclick = () => {
        DB.plan.tasks = DB.plan.tasks.filter((x) => x.id !== id); save(); renderPlan();
      };
    });
  }

  /* ================= 2. 爆款视频 ================= */
  const PLATFORMS = ["抖音", "小红书", "视频号", "B站", "YouTube", "快手"];
  const VSTATUS = { idea: ["想法", "amber"], shooting: ["拍摄中", "green"], published: ["已发布", ""] };

  function renderVideo() {
    const v = DB.videos;
    const published = v.filter((x) => x.status === "published").length;
    const list = v.length
      ? v.slice().reverse().map((x) => {
          const st = VSTATUS[x.status] || VSTATUS.idea;
          return `<div class="item" data-id="${x.id}">
            <div class="body">
              <div class="title">${esc(x.title)} <span class="tag ${st[1]}">${st[0]}</span> <span class="tag">${esc(x.platform)}</span></div>
              <div class="meta">${esc(x.notes || "无备注")}${x.link ? ' · <a href="' + esc(x.link) + '" target="_blank" rel="noopener">链接</a>' : ""}</div>
            </div>
            <div class="actions"><button class="btn danger sm" data-act="del">删除</button></div>
          </div>`;
        }).join("")
      : empty("还没有视频选题，记录你的下一个爆款灵感 🎬");

    $("#view-video").innerHTML = head("爆款视频", "追踪你的视频选题与发布状态") + `
      <div class="grid cols-3" style="margin-bottom:16px">
        <div class="card stat"><div class="num">${v.length}</div><div class="lbl">选题总数</div></div>
        <div class="card stat"><div class="num green">${published}</div><div class="lbl">已发布</div></div>
        <div class="card stat"><div class="num ink">${v.length - published}</div><div class="lbl">进行中</div></div>
      </div>
      <div class="card">
        <div class="row" style="margin-bottom:10px">
          <input id="vTitle" class="field" placeholder="视频标题 / 选题" maxlength="120" />
          <select id="vPlatform" class="field" style="max-width:150px">
            ${PLATFORMS.map((p) => `<option value="${p}">${p}</option>`).join("")}
          </select>
          <select id="vStatus" class="field" style="max-width:130px">
            <option value="idea">想法</option><option value="shooting">拍摄中</option><option value="published">已发布</option>
          </select>
        </div>
        <div class="row">
          <input id="vNotes" class="field" placeholder="备注 / 创意点（选填）" maxlength="200" />
          <input id="vLink" class="field" placeholder="视频链接（选填）" maxlength="300" />
          <button class="btn" id="vAdd">添加</button>
        </div>
      </div>
      <div class="section-title">选题列表</div>
      ${list}
    `;

    const add = () => {
      const title = $("#vTitle").value.trim();
      if (!title) return toast("请填写视频标题");
      DB.videos.push({
        id: uid(), title, platform: $("#vPlatform").value, status: $("#vStatus").value,
        notes: $("#vNotes").value.trim(), link: $("#vLink").value.trim(), date: today(),
      });
      save(); renderVideo();
    };
    $("#vAdd").onclick = add;
    $$("#view-video .item").forEach((it) => {
      it.querySelector('[data-act="del"]').onclick = () => {
        DB.videos = DB.videos.filter((x) => x.id !== it.dataset.id); save(); renderVideo();
      };
    });
  }

  /* ================= 3. 灵感记录 ================= */
  function renderIdea() {
    const list = DB.ideas.length
      ? DB.ideas.slice().reverse().map((x) => `
        <div class="item" data-id="${x.id}">
          <div class="body">
            <div class="title">${esc(x.text)}</div>
            <div class="meta">${relTime(x.createdAt)}${x.tag ? ' · <span class="tag">' + esc(x.tag) + "</span>" : ""}</div>
          </div>
          <div class="actions"><button class="btn danger sm" data-act="del">删除</button></div>
        </div>`).join("")
      : empty("任何闪过脑海的念头都值得被记下 💡");

    $("#view-idea").innerHTML = head("灵感记录", "随手捕捉每一个好点子") + `
      <div class="card">
        <div class="row">
          <input id="iTag" class="field" style="max-width:130px" placeholder="标签（选填）" maxlength="20" />
          <input id="iText" class="field" placeholder="写下你的灵感…" maxlength="300" />
          <button class="btn" id="iAdd">记录</button>
        </div>
      </div>
      <div class="section-title">共 ${DB.ideas.length} 条灵感</div>
      ${list}
    `;

    const add = () => {
      const text = $("#iText").value.trim();
      if (!text) return;
      DB.ideas.push({ id: uid(), text, tag: $("#iTag").value.trim(), createdAt: Date.now() });
      save(); renderIdea();
    };
    $("#iAdd").onclick = add;
    $("#iText").onkeydown = (e) => { if (e.key === "Enter") add(); };
    $$("#view-idea .item").forEach((it) => {
      it.querySelector('[data-act="del"]').onclick = () => {
        DB.ideas = DB.ideas.filter((x) => x.id !== it.dataset.id); save(); renderIdea();
      };
    });
  }

  /* ================= 4. 锻炼身体 ================= */
  function renderExercise() {
    const t = today();
    const todayRec = DB.exercise.filter((x) => x.date === t);
    const todayMin = todayRec.reduce((s, x) => s + (+x.duration || 0), 0);
    const totalMin = DB.exercise.reduce((s, x) => s + (+x.duration || 0), 0);
    const days = DB.exercise.map((x) => x.date);
    const st = streak(days);

    const list = DB.exercise.length
      ? DB.exercise.slice().reverse().map((x) => `
        <div class="item" data-id="${x.id}">
          <div class="body">
            <div class="title">${esc(x.type)} <span class="tag green">${x.duration} 分钟</span>${x.calories ? ' <span class="tag amber">' + x.calories + " kcal</span>" : ""}</div>
            <div class="meta">${prettyDate(new Date(x.date + "T00:00:00"))}</div>
          </div>
          <div class="actions"><button class="btn danger sm" data-act="del">删除</button></div>
        </div>`).join("")
      : empty("今天动一动了吗？记录你的锻炼 🏃");

    $("#view-exercise").innerHTML = head("锻炼身体", "累积记录每一次运动") + `
      <div class="grid cols-4" style="margin-bottom:16px">
        <div class="card stat"><div class="num">${todayMin}</div><div class="lbl">今日分钟</div></div>
        <div class="card stat"><div class="num green">${st}</div><div class="lbl">连续天数</div></div>
        <div class="card stat"><div class="num ink">${totalMin}</div><div class="lbl">累计分钟</div></div>
        <div class="card stat"><div class="num ink">${DB.exercise.length}</div><div class="lbl">总次数</div></div>
      </div>
      <div class="card">
        <div class="row">
          <input id="eType" class="field" placeholder="项目：跑步 / 健身 / 瑜伽…" maxlength="40" />
          <input id="eDur" class="field" type="number" min="0" placeholder="分钟" style="max-width:110px" />
          <input id="eCal" class="field" type="number" min="0" placeholder="卡路里(选填)" style="max-width:130px" />
          <button class="btn" id="eAdd">记录</button>
        </div>
      </div>
      <div class="section-title">锻炼记录</div>
      ${list}
    `;

    const add = () => {
      const type = $("#eType").value.trim();
      const dur = +$("#eDur").value;
      if (!type || !dur) return toast("请填写项目和时长");
      DB.exercise.push({ id: uid(), type, duration: dur, calories: +$("#eCal").value || 0, date: t });
      save(); renderExercise();
    };
    $("#eAdd").onclick = add;
    $$("#view-exercise .item").forEach((it) => {
      it.querySelector('[data-act="del"]').onclick = () => {
        DB.exercise = DB.exercise.filter((x) => x.id !== it.dataset.id); save(); renderExercise();
      };
    });
  }

  /* ================= 5. 每日阅读 ================= */
  function renderReading() {
    const t = today();
    const todayRec = DB.reading.filter((x) => x.date === t);
    const todayPages = todayRec.reduce((s, x) => s + (+x.pages || 0), 0);
    const totalPages = DB.reading.reduce((s, x) => s + (+x.pages || 0), 0);
    const st = streak(DB.reading.map((x) => x.date));

    const list = DB.reading.length
      ? DB.reading.slice().reverse().map((x) => `
        <div class="item" data-id="${x.id}">
          <div class="body">
            <div class="title">${esc(x.book)} <span class="tag">${x.pages} 页</span>${x.minutes ? ' <span class="tag green">' + x.minutes + " 分钟</span>" : ""}</div>
            <div class="meta">${prettyDate(new Date(x.date + "T00:00:00"))}</div>
          </div>
          <div class="actions"><button class="btn danger sm" data-act="del">删除</button></div>
        </div>`).join("")
      : empty("读一本好书，从今天开始 📚");

    $("#view-reading").innerHTML = head("每日阅读", "累积你的阅读量") + `
      <div class="grid cols-4" style="margin-bottom:16px">
        <div class="card stat"><div class="num">${todayPages}</div><div class="lbl">今日页数</div></div>
        <div class="card stat"><div class="num green">${st}</div><div class="lbl">连续天数</div></div>
        <div class="card stat"><div class="num ink">${totalPages}</div><div class="lbl">累计页数</div></div>
        <div class="card stat"><div class="num ink">${DB.reading.length}</div><div class="lbl">总记录</div></div>
      </div>
      <div class="card">
        <div class="row">
          <input id="rBook" class="field" placeholder="书名" maxlength="80" />
          <input id="rPages" class="field" type="number" min="0" placeholder="页数" style="max-width:110px" />
          <input id="rMin" class="field" type="number" min="0" placeholder="分钟(选填)" style="max-width:130px" />
          <button class="btn" id="rAdd">记录</button>
        </div>
      </div>
      <div class="section-title">阅读记录</div>
      ${list}
    `;

    const add = () => {
      const book = $("#rBook").value.trim();
      const pages = +$("#rPages").value;
      if (!book || !pages) return toast("请填写书名和页数");
      DB.reading.push({ id: uid(), book, pages, minutes: +$("#rMin").value || 0, date: t });
      save(); renderReading();
    };
    $("#rAdd").onclick = add;
    $$("#view-reading .item").forEach((it) => {
      it.querySelector('[data-act="del"]').onclick = () => {
        DB.reading = DB.reading.filter((x) => x.id !== it.dataset.id); save(); renderReading();
      };
    });
  }

  /* ================= 6. 英语学习 ================= */
  function renderEnglish() {
    const mastered = DB.english.filter((x) => x.mastered).length;
    const list = DB.english.length
      ? DB.english.slice().reverse().map((x) => `
        <div class="item ${x.mastered ? "done" : ""}" data-id="${x.id}">
          <div class="check ${x.mastered ? "on" : ""}" data-act="master"></div>
          <div class="body">
            <div class="title">${esc(x.word)} <span class="tag">${esc(x.meaning)}</span></div>
            <div class="meta">${esc(x.example || "")}</div>
          </div>
          <div class="actions"><button class="btn danger sm" data-act="del">删除</button></div>
        </div>`).join("")
      : empty("每天背几个单词，悄悄变强 🔤");

    $("#view-english").innerHTML = head("英语学习", "积累你的词汇量") + `
      <div class="grid cols-3" style="margin-bottom:16px">
        <div class="card stat"><div class="num">${DB.english.length}</div><div class="lbl">总单词</div></div>
        <div class="card stat"><div class="num green">${mastered}</div><div class="lbl">已掌握</div></div>
        <div class="card stat"><div class="num ink">${DB.english.length - mastered}</div><div class="lbl">学习中</div></div>
      </div>
      <div class="card">
        <div class="row" style="margin-bottom:10px">
          <input id="eWord" class="field" placeholder="单词 / 短语" maxlength="60" />
          <input id="eMean" class="field" placeholder="中文释义" maxlength="60" />
        </div>
        <div class="row">
          <input id="eEx" class="field" placeholder="例句（选填）" maxlength="200" />
          <button class="btn" id="eAdd">添加</button>
        </div>
      </div>
      <div class="section-title">单词本</div>
      ${list}
    `;

    const add = () => {
      const word = $("#eWord").value.trim();
      const mean = $("#eMean").value.trim();
      if (!word || !mean) return toast("请填写单词和释义");
      DB.english.push({ id: uid(), word, meaning: mean, example: $("#eEx").value.trim(), mastered: false, createdAt: Date.now() });
      save(); renderEnglish();
    };
    $("#eAdd").onclick = add;
    $$("#view-english .item").forEach((it) => {
      const id = it.dataset.id;
      it.querySelector('[data-act="master"]').onclick = () => {
        const w = DB.english.find((x) => x.id === id); w.mastered = !w.mastered; save(); renderEnglish();
      };
      it.querySelector('[data-act="del"]').onclick = () => {
        DB.english = DB.english.filter((x) => x.id !== id); save(); renderEnglish();
      };
    });
  }

  /* ================= 设置 ================= */
  function renderSettings() {
    $("#view-settings").innerHTML = head("设置", "数据全部保存在本机，不会上传") + `
      <div class="card" style="margin-bottom:16px">
        <div class="row">
          <div class="field" style="flex:1">
            <label class="fld">你的昵称（显示在侧边栏）</label>
            <input id="setName" placeholder="例如：小明" maxlength="20" value="${esc(DB.settings.userName)}" />
          </div>
          <button class="btn" id="setSave" style="align-self:flex-end">保存</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px; display:flex; align-items:center; justify-content:space-between">
        <div>
          <div style="font-weight:700">每日计划自动重置</div>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:2px">开启后，每天 0 点把任务恢复为「未完成」；关闭则为累积模式。</div>
        </div>
        <label class="switch"><input type="checkbox" id="setReset" ${DB.settings.dailyReset ? "checked" : ""}><span class="track"></span></label>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div style="font-weight:700;margin-bottom:10px">数据备份</div>
          <div class="row">
            <button class="btn plain" id="exportBtn">导出 JSON</button>
            <button class="btn plain" id="importBtn">导入 JSON</button>
            <input type="file" id="importFile" accept="application/json" style="display:none" />
          </div>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:8px">导出可备份到 iCloud / 微信，换手机时导入恢复。</div>
        </div>
        <div class="card">
          <div style="font-weight:700;margin-bottom:10px">清空数据</div>
          <button class="btn danger" id="clearBtn">清空全部数据</button>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:8px">将删除所有模块的记录，且不可恢复。</div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div style="font-weight:700;margin-bottom:8px">📱 安装到 iPhone / iPad</div>
        <ol style="margin:0;padding-left:18px;font-size:13px;color:var(--ink-soft);line-height:1.9">
          <li>用 <b>Safari</b> 打开本应用（需通过 https 链接访问）。</li>
          <li>点击底部工具栏的 <b>分享</b> 按钮（方框加箭头图标）。</li>
          <li>下滑选择 <b>“添加到主屏幕”</b>。</li>
          <li>点击右上角 <b>添加</b>，即可像 App 一样从主屏幕打开，数据本地留存、可离线使用。</li>
        </ol>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:8px">提示：iOS 仅支持通过 Safari「添加到主屏幕」安装，暂不支持 Android 式的一键弹窗安装。</div>
      </div>
    `;

    $("#setSave").onclick = () => { DB.settings.userName = $("#setName").value.trim(); save(); updateBrand(); toast("已保存"); };
    $("#setReset").onchange = (e) => {
      DB.settings.dailyReset = e.target.checked;
      DB.plan.lastReset = today(); save(); toast(e.target.checked ? "已开启每日重置" : "已切换为累积模式");
    };
    $("#exportBtn").onclick = exportData;
    $("#importBtn").onclick = () => $("#importFile").click();
    $("#importFile").onchange = importData;
    $("#clearBtn").onclick = () => {
      if (confirm("确定清空全部数据？此操作不可恢复。")) {
        DB = defaults(); save(); updateBrand(); toast("已清空"); go("plan");
      }
    };
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "workbench-backup-" + today() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("已导出备份");
  }
  function importData(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        DB = Object.assign(defaults(), d);
        save(); updateBrand(); toast("导入成功"); go(current);
      } catch (err) { toast("文件格式不正确"); }
    };
    reader.readAsText(f);
  }

  /* ---------------- 侧边栏品牌 ---------------- */
  function updateBrand() {
    const name = DB.settings.userName || "我的工作台";
    $(".brand-name").textContent = name;
    $("#brandDate").textContent = prettyDate(new Date());
  }

  /* ---------------- 移动端抽屉 ---------------- */
  function openSidebar() { $("#sidebar").classList.add("open"); $("#scrim").classList.add("show"); }
  function closeSidebar() { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); }

  /* ---------------- 安装提示 ---------------- */
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferredPrompt = e;
    $("#installBtn").style.display = "";
  });
  $("#installBtn").onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null; $("#installBtn").style.display = "none";
  };

  /* ---------------- 启动 ---------------- */
  function init() {
    updateBrand();
    $$(".nav-item[data-view]").forEach((b) => (b.onclick = () => go(b.dataset.view)));
    $("#menuToggle").onclick = openSidebar;
    $("#scrim").onclick = closeSidebar;
    go("plan");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
