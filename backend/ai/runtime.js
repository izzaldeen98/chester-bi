/* Chester artifact runtime — hand-written, shipped with the app, identical
   for every artifact. The LLM never writes or edits this file.

   It owns: querying, filter state, batching, and drawing each component
   type. Everything that used to be improvised per page and broke at runtime.

   The page is sandboxed on an opaque origin, so it cannot call the API. It
   asks the parent app, which is authenticated, over postMessage. */
(function () {
  var CFG = window.__CHESTER_SPEC__ || { components: [], filters: [] };
  var THEME = window.__CHESTER_THEME__ || { colors: ["#f59e0b"], text: "#171614" };
  var pending = {}, seq = 0, filterState = {}, charts = {}, refreshTimer = null;

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.source !== "chester-host") return;
    var p = pending[m.rid];
    if (!p) return;
    delete pending[m.rid];
    if (m.error) p.reject(new Error(m.error)); else p.resolve(m.rows);
  });

  function ask(queryId, filters) {
    var rid = ++seq;
    return new Promise(function (resolve, reject) {
      pending[rid] = { resolve: resolve, reject: reject };
      parent.postMessage({ source: "chester-page", rid: rid, queryId: queryId, filters: filters }, "*");
      setTimeout(function () {
        if (pending[rid]) { delete pending[rid]; reject(new Error("Query timed out")); }
      }, 60000);
    });
  }

  /* Active filters as Cube filter objects. A date_range contributes two
     filters from one control; the operators come from the server-rendered
     config, never from anything typed in the page. */
  function cubeFilters() {
    var out = [];
    CFG.filters.forEach(function (f) {
      var v = filterState[f.id];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return;
      if (f.type === "date_range") {
        if (v.from) out.push({ member: f.member, operator: f.operators[0], values: [v.from] });
        if (v.to) out.push({ member: f.member, operator: f.operators[1], values: [v.to] });
      } else {
        out.push({ member: f.member, operator: f.operators, values: Array.isArray(v) ? v : [String(v)] });
      }
    });
    return out;
  }

  function el(cid) { return document.querySelector('[data-cid="' + cid + '"]'); }
  function slot(cid, name) {
    var host = el(cid);
    return host ? host.querySelector('[data-slot="' + name + '"]') : null;
  }
  function setState(cid, text, isError) {
    var s = slot(cid, "state");
    if (!s) return;
    s.textContent = text || "";
    s.className = "cb-state" + (isError ? " cb-state-error" : "");
  }

  /* Every number the page shows is rounded here. A measure comes back from
     the warehouse as a full float (9136680.179999989); nothing downstream —
     axis, tooltip, table cell or KPI — may print it raw. */
  var fmt = {
    currency: function (n) {
      return n.toLocaleString(undefined, { style: "currency", currency: "USD",
                                           maximumFractionDigits: 0 });
    },
    percent: function (n) { return (n * 100).toFixed(1) + "%"; },
    decimal: function (n) {
      return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    number: function (n) {
      // Whole numbers by default; a genuine fraction keeps two places so a
      // ratio does not collapse to "0".
      var abs = Math.abs(n);
      var places = (abs > 0 && abs < 1) ? 2 : 0;
      return n.toLocaleString(undefined, { minimumFractionDigits: places,
                                           maximumFractionDigits: places });
    },
  };

  var ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}|$)/;

  /* A category label: dates become readable, everything else is text. The
     granularity is inferred from the value itself, so a monthly series reads
     "Jan 2025" and a daily one "1 Jan". */
  function label(v) {
    if (typeof v !== "string" || !ISO.test(v)) return String(v == null ? "" : v);
    var d = new Date(v);
    if (isNaN(d.getTime())) return v;
    var midnight = /T00:00:00/.test(v) || v.length === 10;
    if (!midnight) return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    if (d.getDate() === 1) return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function format(v, kind) {
    if (v == null || v === "") return "—";
    var n = typeof v === "number" ? v : Number(v);
    if (!isFinite(n)) return String(v);
    return (fmt[kind] || fmt.number)(n);
  }
  function num(v) { var n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : 0; }

  var BASE = {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", confine: true },
    textStyle: { fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif", color: THEME.text },
    animationDuration: 260,
  };

  /* A category axis with a hundred bars is unreadable. Keep the largest
     slice and say so — the model chose the query, the runtime owns how it
     is drawn. */
  var MAX_CATEGORIES = (window.__CHESTER_LIMITS__ || {}).categories || 24;
  var MAX_SLICES = (window.__CHESTER_LIMITS__ || {}).slices || 12;

  function trim(c, rows, kind) {
    if (rows.length <= MAX_CATEGORIES) return { rows: rows, note: "" };
    if (kind === "bar") {
      var key = (Array.isArray(c.y) ? c.y[0] : c.y);
      var sorted = rows.slice().sort(function (a, b) { return num(b[key]) - num(a[key]); });
      return { rows: sorted.slice(0, MAX_CATEGORIES),
               note: "Top " + MAX_CATEGORIES + " of " + rows.length };
    }
    // A trend keeps its order; drop the oldest.
    return { rows: rows.slice(-MAX_CATEGORIES),
             note: "Last " + MAX_CATEGORIES + " of " + rows.length };
  }

  function axisOption(c, rows, kind) {
    var ys = Array.isArray(c.y) ? c.y : [c.y];
    var longest = rows.reduce(function (m, r) {
      return Math.max(m, String(r[c.x] == null ? "" : r[c.x]).length);
    }, 0);
    var rotate = rows.length > 8 && longest > 6 ? 35 : 0;
    return Object.assign({}, BASE, {
      color: THEME.colors,
      tooltip: {
        trigger: "axis", confine: true,
        valueFormatter: function (v) { return format(v, c.format); },
      },
      legend: ys.length > 1 ? { top: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10 } : undefined,
      grid: { left: 8, right: 16, top: 24, bottom: rotate ? 28 : 8, containLabel: true },
      xAxis: {
        type: "category",
        data: rows.map(function (r) { return label(r[c.x]); }),
        axisLabel: { hideOverlap: true, rotate: rotate, interval: 0 },
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: "#e7e6e2" } },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#f0efec" } },
        axisLabel: { formatter: function (v) { return format(v, c.format); } },
      },
      series: ys.map(function (key) {
        return {
          name: key, type: kind === "bar" ? "bar" : "line",
          smooth: kind !== "bar", areaStyle: kind === "area" ? { opacity: 0.12 } : undefined,
          showSymbol: false, barMaxWidth: 34,
          data: rows.map(function (r) { return num(r[key]); }),
        };
      }),
    });
  }

  function pieOption(c, rows) {
    return Object.assign({}, BASE, {
      color: THEME.colors,
      tooltip: {
        trigger: "item", confine: true,
        formatter: function (p) {
          return p.name + "<br/>" + format(p.value, c.format) + " (" + p.percent + "%)";
        },
      },
      series: [{
        type: "pie", radius: ["52%", "76%"], itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: { show: false }, data: rows.map(function (r) {
          return { name: label(r[c.category]), value: num(r[c.value]) };
        }),
      }],
    });
  }

  function drawChart(c, rows) {
    var host = slot(c.id, "chart");
    if (!host || !window.echarts) return;
    if (!rows.length) { setState(c.id, "No data for the current filters"); return; }
    var cut = c.type === "pie"
      ? { rows: rows.slice(0, MAX_SLICES),
          note: rows.length > MAX_SLICES ? "Top " + MAX_SLICES + " of " + rows.length : "" }
      : trim(c, rows, c.type);
    var chart = charts[c.id] || (charts[c.id] = echarts.init(host));
    chart.setOption(c.type === "pie" ? pieOption(c, cut.rows) : axisOption(c, cut.rows, c.type), true);
    chart.resize();
    setState(c.id, cut.note);
    return cut.note;
  }

  function drawTable(c, rows) {
    var host = slot(c.id, "table");
    if (!host) return;
    if (!rows.length) { host.innerHTML = ""; setState(c.id, "No data for the current filters"); return; }
    var cols = (c.columns && c.columns.length) ? c.columns : Object.keys(rows[0]);
    var head = cols.map(function (k) { return "<th>" + k + "</th>"; }).join("");
    var body = rows.slice(0, 200).map(function (r) {
      return "<tr>" + cols.map(function (k) {
        var v = r[k];
        var isNum = v !== null && v !== "" && isFinite(Number(v));
        return '<td class="' + (isNum ? "cb-num" : "") + '">' +
          (isNum ? format(v, c.format) : (v == null || v === "" ? "—" : label(v))) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    host.innerHTML = "<table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function drawKpi(c, rows) {
    var target = slot(c.id, "value");
    if (!target) return;
    var v = rows.length ? rows[0][c.value] : null;
    target.textContent = format(v, c.format);
  }

  function draw(c, rows) {
    if (!rows.length) {
      if (c.type === "kpi") drawKpi(c, rows); else if (c.type === "table") drawTable(c, rows);
      setState(c.id, "No data for the current filters");
      return;
    }
    if (c.type === "kpi") { drawKpi(c, rows); setState(c.id, ""); }
    else if (c.type === "table") { drawTable(c, rows); setState(c.id, ""); }
    else drawChart(c, rows);   // owns its own note about trimming
  }

  /* One component's data. Every component re-queries when filters change —
     the server decides which of those actually hit the database. */
  function load(c, filters) {
    setState(c.id, "Loading…");
    return ask(c.query, filters).then(function (rows) {
      draw(c, rows);
    }).catch(function (err) {
      setState(c.id, err.message || "Could not load", true);
    });
  }

  /* Batched: a filter bar that sets five filters must cause ONE refresh, not
     five overlapping ones racing each other. */
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      var filters = cubeFilters();
      CFG.components.forEach(function (c) { load(c, filters); });
    }, 60);
  }

  /* ── Filter controls ──────────────────────────────────────────────── */
  function readControl(f) {
    var nodes = document.querySelectorAll('[data-filter="' + f.id + '"]');
    if (f.type === "date_range") {
      var v = {};
      nodes.forEach(function (n) { if (n.value) v[n.getAttribute("data-bound")] = n.value; });
      return (v.from || v.to) ? v : null;
    }
    var host = nodes[0];
    if (!host) return null;
    var checked = host.querySelectorAll('input[type="checkbox"]:checked');
    return Array.prototype.map.call(checked, function (n) { return n.value; });
  }

  /* ── Multi-select dropdown ──────────────────────────────────────────
     A button that opens a searchable checkbox list. A native
     <select multiple> is a list box needing ctrl-click, which is not what
     anyone means by a filter dropdown. */
  function summarise(host, label) {
    var checked = host.querySelectorAll('input[type="checkbox"]:checked');
    var summary = host.querySelector('[data-slot="summary"]');
    var count = host.querySelector('[data-slot="count"]');
    if (!checked.length) summary.textContent = "All";
    else if (checked.length === 1) summary.textContent = checked[0].value;
    else summary.textContent = checked.length + " selected";
    summary.classList.toggle("cb-ms-on", checked.length > 0);
    if (count) count.textContent = checked.length ? checked.length + " selected" : "";
  }

  function closeAll(except) {
    document.querySelectorAll(".cb-ms").forEach(function (h) {
      if (h === except) return;
      h.querySelector(".cb-ms-panel").hidden = true;
      h.querySelector(".cb-ms-toggle").setAttribute("aria-expanded", "false");
    });
  }

  function wireDropdown(f, host) {
    var toggle = host.querySelector(".cb-ms-toggle");
    var panel = host.querySelector(".cb-ms-panel");
    var search = host.querySelector(".cb-ms-search");

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = panel.hidden;
      closeAll(host);
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) { search.value = ""; filterOptions(host, ""); search.focus(); }
    });

    panel.addEventListener("click", function (e) { e.stopPropagation(); });
    search.addEventListener("input", function () { filterOptions(host, search.value); });

    host.querySelector("[data-ms-clear]").addEventListener("click", function () {
      host.querySelectorAll('input[type="checkbox"]').forEach(function (n) { n.checked = false; });
      summarise(host, f.label);
      apply(f);
    });

    host.addEventListener("change", function (e) {
      if (e.target && e.target.type === "checkbox") {
        summarise(host, f.label);
        apply(f);
      }
    });

    host.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); toggle.focus(); }
    });
  }

  function filterOptions(host, term) {
    var q = term.trim().toLowerCase(), shown = 0;
    host.querySelectorAll(".cb-ms-option").forEach(function (row) {
      row.hidden = Boolean(q) && row.textContent.toLowerCase().indexOf(q) === -1;
      if (!row.hidden) shown++;
    });
    var none = host.querySelector('[data-slot="nomatch"]');
    if (none) none.hidden = shown > 0;
  }

  function apply(f) {
    filterState[f.id] = readControl(f);
    refresh();
  }

  function wireFilters() {
    CFG.filters.forEach(function (f) {
      document.querySelectorAll('[data-filter="' + f.id + '"]').forEach(function (node) {
        if (f.type === "date_range") {
          node.addEventListener("change", function () { apply(f); });
        } else {
          wireDropdown(f, node);
        }
      });
    });
    document.addEventListener("click", function () { closeAll(null); });

    var clear = document.querySelector("[data-clear-all]");
    if (clear) clear.addEventListener("click", function () {
      filterState = {};
      document.querySelectorAll("[data-filter]").forEach(function (n) {
        if (n.classList && n.classList.contains("cb-ms")) {
          n.querySelectorAll('input[type="checkbox"]').forEach(function (c) { c.checked = false; });
          summarise(n, "");
        } else if ("value" in n) {
          n.value = "";
        }
      });
      refresh();
    });
  }

  /* Select options come from the data itself: the distinct values of that
     member in the component that reads it. */
  function fillSelects() {
    CFG.filters.forEach(function (f) {
      if (f.type !== "multiselect") return;
      var field = f.member.split(".").pop();
      var source = CFG.components.filter(function (c) {
        return (c.x === field) || (c.category === field) ||
               (c.columns && c.columns.indexOf(field) !== -1);
      })[0];
      if (!source) return;
      ask(source.query, []).then(function (rows) {
        var seen = {}, values = [];
        rows.forEach(function (r) {
          var v = r[field];
          if (v != null && v !== "" && !seen[v]) { seen[v] = 1; values.push(String(v)); }
        });
        values.sort();
        document.querySelectorAll('[data-filter="' + f.id + '"]').forEach(function (host) {
          var box = host.querySelector('[data-slot="options"]');
          if (!box) return;
          box.innerHTML = "";
          values.forEach(function (v) {
            var row = document.createElement("label");
            row.className = "cb-ms-option";
            var input = document.createElement("input");
            input.type = "checkbox";
            input.value = v;
            row.appendChild(input);
            row.appendChild(document.createTextNode(v));
            box.appendChild(row);
          });
          if (!values.length) {
            box.innerHTML = '<p class="cb-ms-empty">No values</p>';
          }
        });
      }).catch(function () {});
    });
  }

  window.addEventListener("resize", function () {
    Object.keys(charts).forEach(function (k) { charts[k].resize(); });
  });

  function start() {
    wireFilters();
    fillSelects();
    CFG.components.forEach(function (c) { load(c, []); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
