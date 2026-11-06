"""Chester artifact dashboards in Streamlit.

A thin client over the existing API: the artifact's spec comes from
/artifacts/get, and every component asks /artifacts/query for its own rows
with the applied filters — exactly what the HTML runtime did. The LLM still
only writes the spec; nothing here is generated.

    pip install streamlit requests pandas
    CHESTER_API=http://localhost:8989 streamlit run dashboard/app.py
"""
import json
import os

import pandas as pd
import requests
import streamlit as st

API = os.getenv("CHESTER_API", "http://localhost:8989").rstrip("/")
SPANS = {"full": 12, "half": 6, "third": 4, "quarter": 3}

st.set_page_config(page_title="Chester dashboards", layout="wide")


def api(method, path, **kw):
    r = requests.request(method, f"{API}{path}", timeout=60,
                         headers={"Authorization": f"Bearer {st.session_state.token}"}, **kw)
    if r.status_code == 401:
        st.session_state.pop("token", None)
        st.rerun()
    if not r.ok:
        raise RuntimeError(r.json().get("detail", r.text) if r.headers.get("content-type", "").startswith("application/json") else r.text)
    return r.json()


@st.cache_data(ttl=300, show_spinner=False)
def run_query(token, artifact_id, query_id, filters_json, version=None):
    # token is in the key so one user's cached rows never serve another's.
    return api("POST", f"/api/v1/artifacts/query/{artifact_id}", params={"version": version},
               json={"query_id": query_id, "filters": json.loads(filters_json) or None})["rows"]


@st.cache_data(ttl=300, show_spinner=False)
def filter_options(token, artifact_id, filter_id, version=None):
    return api("GET", f"/api/v1/artifacts/options/{artifact_id}",
               params={"filter_id": filter_id, "version": version})["values"]


def login():
    with st.form("login"):
        user = st.text_input("Username or email")
        pw = st.text_input("Password", type="password")
        if st.form_submit_button("Sign in"):
            r = requests.post(f"{API}/api/v1/auth/login", data={"username": user, "password": pw}, timeout=30)
            if r.ok:
                st.session_state.token = r.json()["access_token"]
                st.rerun()
            st.error("Sign in failed")


def fmt(v, kind):
    if v is None:
        return "—"
    n = float(v)
    # ponytail: older specs tag a 0-100 measure as percent; past 1 it is taken as
    # already in points, so a genuine ratio above 100% (1.5) would read as 1.5%.
    pct = n * 100 if abs(n) <= 1 else n
    if kind != "percent" and abs(n) >= 1e6:  # a KPI tile is narrow: $29.4M, not $29,356,…
        short = next(f"{n / d:,.1f}{u}" for d, u in ((1e12, "T"), (1e9, "B"), (1e6, "M")) if abs(n) >= d)
        return f"${short}" if kind == "currency" else short
    return {"currency": f"${n:,.0f}", "percent": f"{pct:.1f}%", "decimal": f"{n:,.2f}"}.get(
        kind, f"{n:,.2f}" if 0 < abs(n) < 1 else f"{n:,.0f}")


def human(col):
    """Axis title from a column name: total_sales_amount -> Total sales amount."""
    return col.replace("_", " ").strip().capitalize()


def grains(spec):
    """query id -> time columns, so dates sort and label as dates."""
    return {q["id"]: [td["dimension"].split(".")[-1]
                      for td in (q.get("cube_query") or {}).get("timeDimensions") or [] if td.get("granularity")]
            for q in spec.get("queries") or []}


def rows_for(c, artifact_id, filters, time_cols, version):
    rows = run_query(st.session_state.token, artifact_id, c["query"], json.dumps(filters, sort_keys=True), version)
    df = pd.DataFrame(rows)
    for col in time_cols.get(c["query"], []):
        if col in df:
            df[col] = pd.to_datetime(df[col])
    for col in df:
        if col not in time_cols.get(c["query"], []):
            try:
                df[col] = pd.to_numeric(df[col])
            except (ValueError, TypeError):
                pass  # a real text column
    return df


def draw(c, df):
    t = c["type"]
    if c.get("title") and t != "kpi":
        st.markdown(f"**{c['title']}**")
    if df.empty:
        st.caption("No rows")
    elif t == "kpi":
        st.metric(c.get("label") or c.get("title") or c["value"], fmt(df[c["value"]].iloc[0], c.get("format")))
    elif t in ("bar", "line", "area"):
        y = c["y"] if isinstance(c["y"], str) else None  # several series are named by the legend
        getattr(st, f"{t}_chart")(df, x=c["x"], y=c["y"], x_label=human(c["x"]), y_label=human(y) if y else "")
    elif t == "pie":
        st.vega_lite_chart(df, {"mark": {"type": "arc", "tooltip": True}, "encoding": {
            "theta": {"field": c["value"], "type": "quantitative"},
            "color": {"field": c["category"], "type": "nominal"}}}, width="stretch")
    elif t == "table":
        st.dataframe(df[c["columns"]] if c.get("columns") else df, hide_index=True, width="stretch")


def filter_bar(spec, artifact_id, version):
    """Widgets -> Cube filters, same operators the HTML runtime used."""
    out, specs = [], spec.get("filters") or []
    if not specs:
        return out
    cols = st.columns(min(len(specs), 4))
    for i, f in enumerate(specs):
        with cols[i % len(cols)]:
            if f.get("type") == "date_range":
                picked = st.date_input(f["label"], value=(), key=f"f_{f['id']}")
                if len(picked) == 2:
                    out += [{"member": f["member"], "operator": "afterOrOnDate", "values": [str(picked[0])]},
                            {"member": f["member"], "operator": "beforeOrOnDate", "values": [str(picked[1])]}]
                continue
            options = filter_options(st.session_state.token, artifact_id, f["id"], version)
            picked = st.multiselect(f["label"], options, key=f"f_{f['id']}")
            if picked:
                out.append({"member": f["member"], "operator": "equals", "values": picked})
    return out


def packed(components):
    """Greedy 12-column rows, as the HTML grid laid them out."""
    row, used = [], 0
    for c in components:
        span = SPANS.get(c.get("size", "half"), 6)
        if used + span > 12:
            yield row
            row, used = [], 0
        row.append((c, span))
        used += span
    if row:
        yield row


def dashboard(artifact_id, version=None, embedded=False):
    row = api("GET", f"/api/v1/artifacts/get/{artifact_id}")
    old = [p.get("spec") for p in row.get("prompts") or [] if version and p.get("version") == version]
    spec = (old and old[0]) or row.get("spec") or {}
    if not embedded:  # the host app already shows the name and summary
        st.title(spec.get("title") or "Artifact")
    if spec.get("summary") and not embedded:
        st.caption(spec["summary"])

    time_cols = grains(spec)
    filters = filter_bar(spec, artifact_id, version)

    def cell(c):
        if c["type"] == "text":
            if c.get("title"):
                st.markdown(f"**{c['title']}**")
            st.write(c["body"])
            return
        try:
            draw(c, rows_for(c, artifact_id, filters, time_cols, version))
        except Exception as exc:
            st.error(str(exc))

    kpis = [c for c in spec.get("components", []) if c["type"] == "kpi"]
    if kpis:
        for col, c in zip(st.columns(len(kpis)), kpis):
            with col, st.container(border=True):
                cell(c)
    for row in packed([c for c in spec.get("components", []) if c["type"] != "kpi"]):
        for col, (c, _) in zip(st.columns([s for _, s in row]), row):
            with col, st.container(border=True):
                cell(c)


# Embedded in the React app (same origin via the Vite proxy), which hands over
# its session in the URL; drop it from the address once it is in the session.
# ponytail: token rides the iframe URL; move it to a postMessage handshake if
# these URLs ever reach logs you don't own.
if st.query_params.get("token"):
    st.session_state.token = st.query_params.pop("token")
if "token" not in st.session_state:
    login()
    st.stop()

# Streamlit hides its own ?embed from query_params, so the host also sends ?host=chester.
if st.query_params.get("host") == "chester" and st.query_params.get("artifact"):
    v = st.query_params.get("version")
    dashboard(st.query_params["artifact"], int(v) if v else None, embedded=True)
    st.stop()

artifacts = api("GET", "/api/v1/artifacts/list")
if not artifacts:
    st.info("No artifacts yet — create one in Chester first.")
    st.stop()
names = {a["id"]: a["name"] for a in artifacts}
wanted = st.query_params.get("artifact")
chosen = st.sidebar.selectbox("Artifact", list(names), format_func=names.get,
                              index=list(names).index(wanted) if wanted in names else 0)
st.query_params["artifact"] = chosen
if st.sidebar.button("Refresh data"):
    run_query.clear()
dashboard(chosen)
