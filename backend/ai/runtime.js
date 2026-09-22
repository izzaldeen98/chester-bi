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

  var fmt = {
    currency: function (n) { return n == null ? "—" : Number(n).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }); },
    percent:  function (n) { return n == null ? "—" : (Number(n) * 100).toFixed(1) + "%"; },
    decimal:  function (n) { return n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }); },
    number:   function (n) { return n == null ? "—" : Number(n).toLocaleString(); },
  };
  function format(v, kind) { return (fmt[kind] || fmt.number)(v); }
  function num(v) { var n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : 0; }

  var BASE = {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", confine: true },
    textStyle: { fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif", color: THEME.text },
    animationDuration: 260,
  };

  function axisOption(c, rows, kind) {
    var ys = Array.isArray(c.y) ? c.y : [c.y];
    return Object.assign({}, BASE, {
      color: THEME.colors,
      legend: ys.length > 1 ? { top: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10 } : undefined,
      xAxis: {
        type: "category",
        data: rows.map(function (r) { return r[c.x]; }),
        axisLabel: { hideOverlap: true },
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
      tooltip: { trigger: "item", confine: true },
      series: [{
        type: "pie", radius: ["52%", "76%"], itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: { show: false }, data: rows.map(function (r) {
          return { name: String(r[c.category]), value: num(r[c.value]) };
        }),
      }],
    });
  }

  function drawChart(c, rows) {
    var host = slot(c.id, "chart");
    if (!host || !window.echarts) return;
    if (!rows.length) { setState(c.id, "No data for the current filters"); return; }
    var chart = charts[c.id] || (charts[c.id] = echarts.init(host));
    var option = c.type === "pie" ? pieOption(c, rows) : axisOption(c, rows, c.type);
    chart.setOption(option, true);
    chart.resize();
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
          (isNum ? format(Number(v), c.format) : (v == null ? "" : String(v))) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    host.innerHTML = "<table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function drawKpi(c, rows) {
    var target = slot(c.id, "value");
    if (!target) return;
    var v = rows.length ? rows[0][c.value] : null;
    target.textContent = v == null ? "—" : format(Number(v), c.format);
  }

  function draw(c, rows) {
    if (c.type === "kpi") drawKpi(c, rows);
    else if (c.type === "table") drawTable(c, rows);
    else drawChart(c, rows);
    setState(c.id, rows.length ? "" : "No data for the current filters");
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
    var node = nodes[0];
    if (!node) return null;
    if (f.type === "multiselect") {
      return Array.prototype.filter.call(node.options, function (o) { return o.selected && o.value; })
        .map(function (o) { return o.value; });
    }
    return node.value || null;
  }

  function wireFilters() {
    CFG.filters.forEach(function (f) {
      document.querySelectorAll('[data-filter="' + f.id + '"]').forEach(function (node) {
        var evt = (f.type === "search") ? "input" : "change";
        var debounce = null;
        node.addEventListener(evt, function () {
          clearTimeout(debounce);
          debounce = setTimeout(function () {
            filterState[f.id] = readControl(f);
            refresh();
          }, f.type === "search" ? 350 : 0);
        });
      });
    });

    var clear = document.querySelector("[data-clear-all]");
    if (clear) clear.addEventListener("click", function () {
      filterState = {};
      document.querySelectorAll("[data-filter]").forEach(function (n) {
        if (n.tagName === "SELECT") { Array.prototype.forEach.call(n.options, function (o) { o.selected = false; }); n.value = ""; }
        else n.value = "";
      });
      refresh();
    });
  }

  /* Select options come from the data itself: the distinct values of that
     member in the component that reads it. */
  function fillSelects() {
    CFG.filters.forEach(function (f) {
      if (f.type !== "select" && f.type !== "multiselect") return;
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
        document.querySelectorAll('[data-filter="' + f.id + '"]').forEach(function (node) {
          if (node.tagName !== "SELECT") return;
          values.forEach(function (v) {
            var o = document.createElement("option");
            o.value = v; o.textContent = v;
            node.appendChild(o);
          });
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
