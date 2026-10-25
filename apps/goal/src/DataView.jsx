import { useRef, useState } from "react";
import { useApp } from "./ctx.js";
import { isWorkspace, seed } from "./store.js";

export default function DataView() {
  const { t, lang, data, replaceData } = useApp();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState("");
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `goallift-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!isWorkspace(d)) throw new Error("bad");
      replaceData(d);
      setMsg(t("data_imported"));
    } catch { setMsg(t("data_bad")); }
  };
  return (
    <section className="panel datav">
      <h2 className="h2">{t("data_title")}</h2>
      <p className="muted">{t("data_hint")}</p>
      <div className="btnrow">
        <button className="btn primary" onClick={exportJson}>{t("data_export")}</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>{t("data_import")}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} data-import />
        <button className="btn danger" onClick={() => { if (confirm(t("data_resetConfirm"))) { replaceData(seed(lang)); setMsg(""); } }}>{t("data_reset")}</button>
      </div>
      {msg && <p className="msg" role="status">{msg}</p>}
    </section>
  );
}
