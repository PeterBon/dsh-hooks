import './style.css';
import { createRequire } from "node:module";
import { useCallback, useEffect, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region src/client/api.ts
var import_client = (/* @__PURE__ */ __commonJSMin(((exports) => {
	var m = __require("react-dom");
	if (process.env.NODE_ENV === "production") {
		exports.createRoot = m.createRoot;
		exports.hydrateRoot = m.hydrateRoot;
	} else {
		var i = m.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
		exports.createRoot = function(c, o) {
			i.usingClientEntryPoint = true;
			try {
				return m.createRoot(c, o);
			} finally {
				i.usingClientEntryPoint = false;
			}
		};
		exports.hydrateRoot = function(c, h, o) {
			i.usingClientEntryPoint = true;
			try {
				return m.hydrateRoot(c, h, o);
			} finally {
				i.usingClientEntryPoint = false;
			}
		};
	}
})))();
async function getJson(path, fetchFn) {
	try {
		const response = await fetchFn(path, { headers: { accept: "application/json" } });
		if (!response.ok) {
			console.warn(`[dsh-hooks-ui] GET ${path} → HTTP ${response.status}`);
			return null;
		}
		const envelope = await response.json();
		if (!envelope.ok) {
			console.warn(`[dsh-hooks-ui] GET ${path} → ${envelope.error?.message ?? "unknown error"}`);
			return null;
		}
		return envelope.value ?? null;
	} catch (error) {
		console.warn(`[dsh-hooks-ui] GET ${path} failed: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}
async function fetchStatus(fetchFn = fetch) {
	return getJson("/dsh-hooks/status", fetchFn);
}
async function fetchHistory(n = 50, fetchFn = fetch) {
	return getJson(`/dsh-hooks/history?n=${Math.max(1, Math.min(500, Math.floor(n)))}`, fetchFn);
}
async function postTest(body, fetchFn = fetch) {
	try {
		const response = await fetchFn("/dsh-hooks/test", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json"
			},
			body: JSON.stringify(body)
		});
		const envelope = await response.json();
		if (!response.ok || !envelope.ok) {
			console.warn(`[dsh-hooks-ui] POST /dsh-hooks/test → ${envelope.error?.message ?? `HTTP ${response.status}`}`);
			return null;
		}
		return envelope.value ?? null;
	} catch (error) {
		console.warn(`[dsh-hooks-ui] POST /dsh-hooks/test failed: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}
/** `HH:MM:SS` local time for a timestamp. */
function formatTime(ts) {
	const date = new Date(ts);
	const p = (value) => String(value).padStart(2, "0");
	return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}
/** Chinese outcome labels. */
const OUTCOME_LABELS = {
	spawned: "已启动",
	"spawn-failed": "启动失败",
	timeout: "超时",
	"exit-0": "成功",
	"exit-nonzero": "失败",
	sent: "已发送",
	"send-failed": "发送失败"
};
function outcomeLabel(outcome) {
	return OUTCOME_LABELS[outcome] ?? outcome;
}
const OUTCOME_TONES = {
	"exit-0": "ok",
	sent: "ok",
	"exit-nonzero": "bad",
	"spawn-failed": "bad",
	"send-failed": "bad",
	timeout: "warn",
	spawned: "neutral"
};
function outcomeTone(outcome) {
	return OUTCOME_TONES[outcome] ?? "neutral";
}
//#endregion
//#region src/client/panel.module.css
var panel_module_default$1 = {
	"badge": "orxP8a_badge",
	"badges": "orxP8a_badges",
	"body": "orxP8a_body",
	"button": "orxP8a_button",
	"buttonPrimary": "orxP8a_buttonPrimary",
	"buttons": "orxP8a_buttons",
	"close": "orxP8a_close",
	"empty": "orxP8a_empty",
	"errorBanner": "orxP8a_errorBanner",
	"field": "orxP8a_field",
	"fieldLabel": "orxP8a_fieldLabel",
	"header": "orxP8a_header",
	"input": "orxP8a_input",
	"outcome": "orxP8a_outcome",
	"outcomeBad": "orxP8a_outcomeBad",
	"outcomeNeutral": "orxP8a_outcomeNeutral",
	"outcomeOk": "orxP8a_outcomeOk",
	"outcomeWarn": "orxP8a_outcomeWarn",
	"panel": "orxP8a_panel",
	"record": "orxP8a_record",
	"recordCommand": "orxP8a_recordCommand",
	"recordError": "orxP8a_recordError",
	"recordEvent": "orxP8a_recordEvent",
	"recordMain": "orxP8a_recordMain",
	"recordTime": "orxP8a_recordTime",
	"recordTop": "orxP8a_recordTop",
	"sectionTitle": "orxP8a_sectionTitle",
	"select": "orxP8a_select",
	"testForm": "orxP8a_testForm",
	"testLine": "orxP8a_testLine",
	"testLineMatch": "orxP8a_testLineMatch",
	"testLineSkip": "orxP8a_testLineSkip",
	"testResults": "orxP8a_testResults",
	"testRow": "orxP8a_testRow",
	"timeline": "orxP8a_timeline",
	"title": "orxP8a_title"
};
//#endregion
//#region src/client/panel.tsx
/**
* Hooks drawer dashboard: execution-history timeline, status badges, and a
* manual event tester — all served by the core plugin's /dsh-hooks/* routes.
* Degrades gracefully: every fetch failure shows an inline notice, never a
* crash.
*/
const EVENTS = [
	"turn/start",
	"turn/end",
	"step/end",
	"tool/call",
	"tool/result",
	"user/message",
	"approval/asked",
	"session/title",
	"session/created",
	"session/disposed",
	"agent/created",
	"agent/disposed",
	"agent/error",
	"agent/status"
];
function HooksPanel({ onClose }) {
	const [status, setStatus] = useState(null);
	const [history, setHistory] = useState(null);
	const [loadError, setLoadError] = useState(false);
	const [event, setEvent] = useState("turn/end");
	const [reason, setReason] = useState("completed");
	const [tool, setTool] = useState("");
	const [testResult, setTestResult] = useState(null);
	const refresh = useCallback(async () => {
		const [statusInfo, records] = await Promise.all([fetchStatus(), fetchHistory(50)]);
		setStatus(statusInfo);
		setHistory(records);
		setLoadError(statusInfo === null && records === null);
	}, []);
	useEffect(() => {
		refresh();
		const timer = setInterval(() => void refresh(), 5e3);
		return () => clearInterval(timer);
	}, [refresh]);
	const runTest = async (execute) => {
		const result = await postTest({
			event,
			reason: event === "turn/end" && reason !== "" ? reason : void 0,
			tool: tool !== "" ? tool : void 0,
			execute
		});
		setTestResult(result);
		if (execute) refresh();
	};
	return /* @__PURE__ */ jsxs("aside", {
		className: panel_module_default$1.panel,
		"aria-label": "dsh-hooks 面板",
		children: [/* @__PURE__ */ jsxs("header", {
			className: panel_module_default$1.header,
			children: [
				/* @__PURE__ */ jsx("h1", {
					className: panel_module_default$1.title,
					children: "dsh-hooks"
				}),
				/* @__PURE__ */ jsx("span", {
					className: panel_module_default$1.badges,
					children: status !== null && /* @__PURE__ */ jsxs(Fragment, { children: [
						/* @__PURE__ */ jsxs("span", {
							className: panel_module_default$1.badge,
							children: ["v", status.version]
						}),
						/* @__PURE__ */ jsxs("span", {
							className: panel_module_default$1.badge,
							children: [status.hookCount, " hooks"]
						}),
						/* @__PURE__ */ jsxs("span", {
							className: panel_module_default$1.badge,
							children: [status.historyCount, " 记录"]
						})
					] })
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: panel_module_default$1.close,
					onClick: onClose,
					"aria-label": "关闭面板",
					children: "✕"
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: panel_module_default$1.body,
			children: [
				loadError && /* @__PURE__ */ jsx("div", {
					className: panel_module_default$1.errorBanner,
					children: "无法访问 /dsh-hooks/* 路由：请确认 dsh-hooks 核心插件已安装且 dsh web 已重启。"
				}),
				/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
					className: panel_module_default$1.sectionTitle,
					children: "执行历史（最近 50 条）"
				}), history === null || history.length === 0 ? /* @__PURE__ */ jsx("div", {
					className: panel_module_default$1.empty,
					children: history === null ? "加载中…" : "暂无记录"
				}) : /* @__PURE__ */ jsx("div", {
					className: panel_module_default$1.timeline,
					children: [...history].reverse().map((record, index) => /* @__PURE__ */ jsx("div", {
						className: panel_module_default$1.record,
						children: /* @__PURE__ */ jsxs("div", {
							className: panel_module_default$1.recordMain,
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: panel_module_default$1.recordTop,
									children: [
										/* @__PURE__ */ jsx("span", {
											className: panel_module_default$1.recordTime,
											children: formatTime(record.ts)
										}),
										/* @__PURE__ */ jsx("span", {
											className: panel_module_default$1.recordEvent,
											children: record.event
										}),
										/* @__PURE__ */ jsx("span", {
											className: `${panel_module_default$1.outcome} ${outcomeClass(record.outcome)}`,
											children: outcomeLabel(record.outcome)
										})
									]
								}),
								/* @__PURE__ */ jsx("div", {
									className: panel_module_default$1.recordCommand,
									title: record.command,
									children: record.command
								}),
								record.error !== void 0 && record.error !== "" && /* @__PURE__ */ jsx("div", {
									className: panel_module_default$1.recordError,
									children: record.error.slice(0, 200)
								})
							]
						})
					}, `${record.ts}-${index}`))
				})] }),
				/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
					className: panel_module_default$1.sectionTitle,
					children: "手动测试"
				}), /* @__PURE__ */ jsxs("div", {
					className: panel_module_default$1.testForm,
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: panel_module_default$1.testRow,
							children: [
								/* @__PURE__ */ jsxs("label", {
									className: panel_module_default$1.field,
									children: [/* @__PURE__ */ jsx("span", {
										className: panel_module_default$1.fieldLabel,
										children: "事件"
									}), /* @__PURE__ */ jsx("select", {
										className: panel_module_default$1.select,
										value: event,
										onChange: (e) => setEvent(e.target.value),
										children: EVENTS.map((name) => /* @__PURE__ */ jsx("option", {
											value: name,
											children: name
										}, name))
									})]
								}),
								event === "turn/end" && /* @__PURE__ */ jsxs("label", {
									className: panel_module_default$1.field,
									children: [/* @__PURE__ */ jsx("span", {
										className: panel_module_default$1.fieldLabel,
										children: "reason"
									}), /* @__PURE__ */ jsx("input", {
										className: panel_module_default$1.input,
										value: reason,
										onChange: (e) => setReason(e.target.value),
										placeholder: "completed"
									})]
								}),
								/* @__PURE__ */ jsxs("label", {
									className: panel_module_default$1.field,
									children: [/* @__PURE__ */ jsx("span", {
										className: panel_module_default$1.fieldLabel,
										children: "tool（可选）"
									}), /* @__PURE__ */ jsx("input", {
										className: panel_module_default$1.input,
										value: tool,
										onChange: (e) => setTool(e.target.value),
										placeholder: "pwsh"
									})]
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: panel_module_default$1.buttons,
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								className: panel_module_default$1.button,
								onClick: () => void runTest(false),
								children: "模拟（看匹配）"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								className: `${panel_module_default$1.button} ${panel_module_default$1.buttonPrimary}`,
								onClick: () => void runTest(true),
								children: "执行（真实触发）"
							})]
						}),
						testResult !== null && /* @__PURE__ */ jsxs("div", {
							className: panel_module_default$1.testResults,
							children: [/* @__PURE__ */ jsxs("div", {
								className: panel_module_default$1.testLine,
								children: [
									testResult.event,
									"：",
									testResult.matched,
									"/",
									testResult.total,
									" 个 hook 触发",
									testResult.executed ? "（已执行）" : ""
								]
							}, "head"), testResult.lines.map((line) => /* @__PURE__ */ jsxs("div", {
								className: `${panel_module_default$1.testLine} ${line.matched ? panel_module_default$1.testLineMatch : panel_module_default$1.testLineSkip}`,
								children: [
									line.matched ? "✅" : "⏭",
									" [",
									line.index,
									"] ",
									line.summary,
									!line.matched && line.why !== "" ? ` —— ${line.why}` : ""
								]
							}, line.index))]
						})
					]
				})] })
			]
		})]
	});
}
function outcomeClass(outcome) {
	switch (outcomeTone(outcome)) {
		case "ok": return panel_module_default$1.outcomeOk;
		case "bad": return panel_module_default$1.outcomeBad;
		case "warn": return panel_module_default$1.outcomeWarn;
		default: return panel_module_default$1.outcomeNeutral;
	}
}
//#endregion
//#region src/client/panel.module.css?inline
var panel_module_default = ":root {\n  --dsh-hooks-panel-bg: #181a1ef7;\n  --dsh-hooks-panel-border: #ffffff14;\n  --dsh-hooks-text: #e6e6e6;\n  --dsh-hooks-muted: #9aa0a8;\n  --dsh-hooks-accent: #4d8df7;\n  --dsh-hooks-ok: #3fb56b;\n  --dsh-hooks-bad: #e5534b;\n  --dsh-hooks-warn: #d9a13c;\n}\n\n@media (prefers-color-scheme: light) {\n  :root {\n    --dsh-hooks-panel-bg: #fafafcfa;\n    --dsh-hooks-panel-border: #00000014;\n    --dsh-hooks-text: #26282c;\n    --dsh-hooks-muted: #767c85;\n  }\n}\n\n.panel {\n  z-index: 9998;\n  background: var(--dsh-hooks-panel-bg);\n  border-left: 1px solid var(--dsh-hooks-panel-border);\n  width: 380px;\n  max-width: 92vw;\n  color: var(--dsh-hooks-text);\n  flex-direction: column;\n  font-size: 13px;\n  line-height: 1.5;\n  display: flex;\n  position: fixed;\n  top: 0;\n  bottom: 0;\n  right: 0;\n  box-shadow: -8px 0 24px #0000002e;\n}\n\n.header {\n  border-bottom: 1px solid var(--dsh-hooks-panel-border);\n  align-items: center;\n  gap: 8px;\n  padding: 12px 14px;\n  display: flex;\n}\n\n.title {\n  flex: 1;\n  margin: 0;\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.badges {\n  gap: 6px;\n  display: flex;\n}\n\n.badge {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  background: #80849029;\n  border-radius: 9px;\n  padding: 1px 7px;\n  font-size: 11px;\n}\n\n.close {\n  color: var(--dsh-hooks-muted);\n  cursor: pointer;\n  background: none;\n  border: none;\n  border-radius: 4px;\n  padding: 2px 6px;\n  font-size: 16px;\n}\n\n.close:hover {\n  color: var(--dsh-hooks-text);\n  background: #8084902e;\n}\n\n.body {\n  flex-direction: column;\n  flex: 1;\n  gap: 14px;\n  padding: 12px 14px;\n  display: flex;\n  overflow-y: auto;\n}\n\n.sectionTitle {\n  color: var(--dsh-hooks-muted);\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  margin: 0 0 8px;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.timeline {\n  flex-direction: column;\n  gap: 6px;\n  display: flex;\n}\n\n.record {\n  border: 1px solid var(--dsh-hooks-panel-border);\n  border-radius: 6px;\n  gap: 8px;\n  padding: 7px 9px;\n  display: flex;\n}\n\n.recordMain {\n  flex: 1;\n  min-width: 0;\n}\n\n.recordTop {\n  align-items: baseline;\n  gap: 6px;\n  display: flex;\n}\n\n.recordTime {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.recordEvent {\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.recordCommand {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  text-align: left;\n  direction: rtl;\n  font-size: 12px;\n  overflow: hidden;\n}\n\n.outcome {\n  white-space: nowrap;\n  border-radius: 9px;\n  align-self: flex-start;\n  padding: 1px 7px;\n  font-size: 11px;\n}\n\n.outcomeOk {\n  color: var(--dsh-hooks-ok);\n  background: #3fb56b29;\n}\n\n.outcomeBad {\n  color: var(--dsh-hooks-bad);\n  background: #e5534b29;\n}\n\n.outcomeWarn {\n  color: var(--dsh-hooks-warn);\n  background: #d9a13c29;\n}\n\n.outcomeNeutral {\n  color: var(--dsh-hooks-muted);\n  background: #80849029;\n}\n\n.recordError {\n  color: var(--dsh-hooks-bad);\n  white-space: pre-wrap;\n  word-break: break-all;\n  margin-top: 4px;\n  font-size: 11px;\n}\n\n.empty {\n  color: var(--dsh-hooks-muted);\n  padding: 6px 2px;\n  font-size: 12px;\n}\n\n.testForm {\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.testRow {\n  gap: 8px;\n  display: flex;\n}\n\n.field {\n  flex-direction: column;\n  flex: 1;\n  gap: 3px;\n  display: flex;\n}\n\n.fieldLabel {\n  color: var(--dsh-hooks-muted);\n  font-size: 11px;\n}\n\n.input, .select {\n  border: 1px solid var(--dsh-hooks-panel-border);\n  color: var(--dsh-hooks-text);\n  background: #8084901f;\n  border-radius: 5px;\n  outline: none;\n  padding: 5px 8px;\n  font-size: 12px;\n}\n\n.input:focus, .select:focus {\n  border-color: var(--dsh-hooks-accent);\n}\n\n.buttons {\n  gap: 8px;\n  display: flex;\n}\n\n.button {\n  border: 1px solid var(--dsh-hooks-panel-border);\n  color: var(--dsh-hooks-text);\n  cursor: pointer;\n  background: #8084901f;\n  border-radius: 5px;\n  padding: 5px 12px;\n  font-size: 12px;\n}\n\n.button:hover {\n  background: #80849038;\n}\n\n.buttonPrimary {\n  background: var(--dsh-hooks-accent);\n  border-color: var(--dsh-hooks-accent);\n  color: #fff;\n}\n\n.buttonPrimary:hover {\n  background: #3c7de8;\n}\n\n.testResults {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.testLine {\n  border-radius: 5px;\n  padding: 4px 8px;\n  font-size: 12px;\n}\n\n.testLineMatch {\n  color: var(--dsh-hooks-ok);\n  background: #3fb56b24;\n}\n\n.testLineSkip {\n  color: var(--dsh-hooks-muted);\n  background: #8084901a;\n}\n\n.errorBanner {\n  color: var(--dsh-hooks-bad);\n  background: #e5534b1f;\n  border: 1px solid #e5534b66;\n  border-radius: 6px;\n  padding: 8px 10px;\n  font-size: 12px;\n}\n";
//#endregion
//#region src/client/panel-mount.tsx
/**
* Drawer panel mounting: one lazily-created React root in a fixed-position
* host. The stylesheet is bundled as a string (`.css?inline`) and injected
* once as a <style> tag — no separate CSS asset for the shell to load.
*/
const STYLE_ID = "dsh-hooks-ui-style";
let root;
let host;
function injectStyle() {
	if (document.getElementById(STYLE_ID) !== null) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = panel_module_default;
	document.head.appendChild(style);
}
function ensureHost() {
	if (host === void 0 || !host.isConnected) {
		host = document.createElement("div");
		host.dataset.dshHooksPanelHost = "";
		document.body.appendChild(host);
	}
	return host;
}
function show() {
	injectStyle();
	const target = ensureHost();
	if (root === void 0) {
		root = (0, import_client.createRoot)(target);
		root.render(/* @__PURE__ */ jsx(HooksPanel, { onClose: hide }));
	}
}
function hide() {
	root?.unmount();
	root = void 0;
	host?.remove();
	host = void 0;
	document.getElementById(STYLE_ID)?.remove();
}
/** Create the panel controller the sidebar entry toggles. */
function mountPanel() {
	return {
		toggle: () => {
			if (root !== void 0) hide();
			else show();
		},
		dispose: () => hide()
	};
}
//#endregion
//#region src/client/sidebar-entry.ts
/**
* Sidebar entry injection (dsh-task-board precedent, simplified).
*
* dsh's sidebar shell exposes no slot an external plugin can register into,
* so the entry row is injected next to the New Session button and self-heals
* through MutationObservers whenever a React re-render displaces it. The row
* is plain DOM — it can never disturb the shell's reconciliation.
*/
/** Stable data attribute identifying the injected entry row. */
const ENTRY_SELECTOR = "[data-dsh-hooks-entry]";
const ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 2.5v3a2 2 0 0 0 2 2h1\"/><path d=\"M12 13.5v-3a2 2 0 0 0-2-2H9\"/><path d=\"M9.5 5.5 12 8l-2.5 2.5\"/><circle cx=\"7\" cy=\"8\" r=\"0.8\" fill=\"currentColor\" stroke=\"none\"/></svg>";
function sidebarRoot() {
	const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
	if (column === null) return void 0;
	return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
}
function newSessionButton(root) {
	const nested = root.querySelector("button[class*=\"newSession\"]");
	if (nested !== null) return nested;
	for (const child of root.children) if (child.tagName === "BUTTON") return child;
}
/**
* Mount the sidebar entry row. Idempotent per page: a duplicated apply (or
* stale HMR module) never mounts a second row.
*/
function mountSidebarEntry(controller) {
	if (typeof document === "undefined") return () => {};
	if (document.querySelector(ENTRY_SELECTOR) !== null) return () => {};
	const entry = document.createElement("button");
	entry.type = "button";
	entry.dataset.dshHooksEntry = "";
	entry.setAttribute("aria-label", "Hooks");
	entry.style.cssText = "display:flex;align-items:center;gap:6px;width:100%;padding:7px 10px;border:none;background:transparent;color:inherit;font-size:13px;cursor:pointer;border-radius:6px;";
	entry.innerHTML = `<span>${ICON}</span><span>Hooks</span>`;
	entry.addEventListener("mouseenter", () => {
		entry.style.background = "rgba(128,132,144,0.14)";
	});
	entry.addEventListener("mouseleave", () => {
		entry.style.background = "transparent";
	});
	entry.addEventListener("click", () => controller.toggle());
	let root;
	let placed = false;
	const place = () => {
		if (root !== void 0 && !root.isConnected) {
			rootObserver.disconnect();
			root = void 0;
			placed = false;
		}
		if (placed) {
			if (document.body.contains(entry)) return;
			rootObserver.disconnect();
			root = void 0;
			placed = false;
		}
		root ??= sidebarRoot();
		if (root === void 0) return;
		const button = newSessionButton(root);
		if (button === void 0) return;
		const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches("[data-dsh-hooks-entry], [data-dsh-taskboard-entry], [data-dsh-ssh-entry]"));
		const row = button.closest("[class*=\"logoRow\"]");
		const base = row !== null && row.parentElement === root ? row : button;
		const anchor = family.length > 0 ? family[0] : base.nextElementSibling;
		root.insertBefore(entry, anchor);
		placed = true;
		rootObserver.observe(root, {
			childList: true,
			subtree: true
		});
	};
	const waitObserver = new MutationObserver(() => place());
	waitObserver.observe(document.body, {
		childList: true,
		subtree: true
	});
	const rootObserver = new MutationObserver(() => {
		if (root === void 0 || !root.isConnected) {
			placed = false;
			place();
			return;
		}
		if (!root.contains(entry)) place();
	});
	place();
	return () => {
		waitObserver.disconnect();
		rootObserver.disconnect();
		entry.remove();
	};
}
//#endregion
//#region src/client/index.ts
const name = "@PeterBon/dsh-hooks-ui";
/** Single-application guard: first apply wins; later calls become no-ops. */
let applied = false;
function apply(ctx) {
	if (typeof document === "undefined") return;
	if (applied) return;
	applied = true;
	try {
		const panel = mountPanel();
		const disposeEntry = mountSidebarEntry({ toggle: panel.toggle });
		ctx.effect(() => () => {
			applied = false;
			disposeEntry();
			panel.dispose();
		}, "dsh-hooks-ui: panel");
	} catch (error) {
		console.error("[dsh-hooks-ui] mount failed:", error);
	}
}
//#endregion
export { apply, name };
