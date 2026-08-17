window.__ModuleLoader__.load({
	id: "@PeterBon/dsh-hooks-ui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_dom_client = require("react-dom/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
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
			const [status, setStatus] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)(null);
			const [loadError, setLoadError] = (0, react.useState)(false);
			const [event, setEvent] = (0, react.useState)("turn/end");
			const [reason, setReason] = (0, react.useState)("completed");
			const [tool, setTool] = (0, react.useState)("");
			const [testResult, setTestResult] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				const [statusInfo, records] = await Promise.all([fetchStatus(), fetchHistory(50)]);
				setStatus(statusInfo);
				setHistory(records);
				setLoadError(statusInfo === null && records === null);
			}, []);
			(0, react.useEffect)(() => {
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
				className: "dh-panel",
				"aria-label": "dsh-hooks 面板",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: "dh-header",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: "dh-title",
							children: "dsh-hooks"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dh-badges",
							children: status !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dh-badge",
									children: ["v", status.version]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dh-badge",
									children: [status.hookCount, " hooks"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dh-badge",
									children: [status.historyCount, " 记录"]
								})
							] })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dh-close",
							onClick: onClose,
							"aria-label": "关闭面板",
							children: "✕"
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dh-body",
					children: [
						loadError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dh-error-banner",
							children: "无法访问 /dsh-hooks/* 路由：请确认 dsh-hooks 核心插件已安装且 dsh web 已重启。"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: "dh-section-title",
							children: "执行历史（最近 50 条）"
						}), history === null || history.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dh-empty",
							children: history === null ? "加载中…" : "暂无记录"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dh-timeline",
							children: [...history].reverse().map((record, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dh-record",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-record-main",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dh-record-top",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dh-record-time",
													children: formatTime(record.ts)
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dh-record-event",
													children: record.event
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: `dh-outcome ${outcomeClass(record.outcome)}`,
													children: outcomeLabel(record.outcome)
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dh-record-command",
											title: record.command,
											children: record.command
										}),
										record.error !== void 0 && record.error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dh-record-error",
											children: record.error.slice(0, 200)
										})
									]
								})
							}, `${record.ts}-${index}`))
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: "dh-section-title",
							children: "手动测试"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dh-test-form",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-test-row",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: "dh-field",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dh-field-label",
												children: "事件"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												className: "dh-select",
												value: event,
												onChange: (e) => setEvent(e.target.value),
												children: EVENTS.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: name,
													children: name
												}, name))
											})]
										}),
										event === "turn/end" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: "dh-field",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dh-field-label",
												children: "reason"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "dh-input",
												value: reason,
												onChange: (e) => setReason(e.target.value),
												placeholder: "completed"
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: "dh-field",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dh-field-label",
												children: "tool（可选）"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "dh-input",
												value: tool,
												onChange: (e) => setTool(e.target.value),
												placeholder: "pwsh"
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-buttons",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dh-button",
										onClick: () => void runTest(false),
										children: "模拟（看匹配）"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: `dh-button dh-button-primary`,
										onClick: () => void runTest(true),
										children: "执行（真实触发）"
									})]
								}),
								testResult !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-test-results",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dh-test-line",
										children: [
											testResult.event,
											"：",
											testResult.matched,
											"/",
											testResult.total,
											" 个 hook 触发",
											testResult.executed ? "（已执行）" : ""
										]
									}, "head"), testResult.lines.map((line) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: `dh-test-line ${line.matched ? "dh-test-line-match" : "dh-test-line-skip"}`,
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
				case "ok": return "dh-outcome-ok";
				case "bad": return "dh-outcome-bad";
				case "warn": return "dh-outcome-warn";
				default: return "dh-outcome-neutral";
			}
		}
		//#endregion
		//#region src/client/panel.module.css?inline
		var panel_module_default = ":root {\n  --dsh-hooks-panel-bg: #181a1ef7;\n  --dsh-hooks-panel-border: #ffffff14;\n  --dsh-hooks-text: #e6e6e6;\n  --dsh-hooks-muted: #9aa0a8;\n  --dsh-hooks-accent: #4d8df7;\n  --dsh-hooks-ok: #3fb56b;\n  --dsh-hooks-bad: #e5534b;\n  --dsh-hooks-warn: #d9a13c;\n}\n\n@media (prefers-color-scheme: light) {\n  :root {\n    --dsh-hooks-panel-bg: #fafafcfa;\n    --dsh-hooks-panel-border: #00000014;\n    --dsh-hooks-text: #26282c;\n    --dsh-hooks-muted: #767c85;\n  }\n}\n\n.dh-panel {\n  z-index: 9998;\n  background: var(--dsh-hooks-panel-bg);\n  border-left: 1px solid var(--dsh-hooks-panel-border);\n  width: 380px;\n  max-width: 92vw;\n  color: var(--dsh-hooks-text);\n  flex-direction: column;\n  font-size: 13px;\n  line-height: 1.5;\n  display: flex;\n  position: fixed;\n  top: 0;\n  bottom: 0;\n  right: 0;\n  box-shadow: -8px 0 24px #0000002e;\n}\n\n.dh-header {\n  border-bottom: 1px solid var(--dsh-hooks-panel-border);\n  align-items: center;\n  gap: 8px;\n  padding: 12px 14px;\n  display: flex;\n}\n\n.dh-title {\n  flex: 1;\n  margin: 0;\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.dh-badges {\n  gap: 6px;\n  display: flex;\n}\n\n.dh-badge {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  background: #80849029;\n  border-radius: 9px;\n  padding: 1px 7px;\n  font-size: 11px;\n}\n\n.dh-close {\n  color: var(--dsh-hooks-muted);\n  cursor: pointer;\n  background: none;\n  border: none;\n  border-radius: 4px;\n  padding: 2px 6px;\n  font-size: 16px;\n}\n\n.dh-close:hover {\n  color: var(--dsh-hooks-text);\n  background: #8084902e;\n}\n\n.dh-body {\n  flex-direction: column;\n  flex: 1;\n  gap: 14px;\n  padding: 12px 14px;\n  display: flex;\n  overflow-y: auto;\n}\n\n.dh-section-title {\n  color: var(--dsh-hooks-muted);\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  margin: 0 0 8px;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.dh-timeline {\n  flex-direction: column;\n  gap: 6px;\n  display: flex;\n}\n\n.dh-record {\n  border: 1px solid var(--dsh-hooks-panel-border);\n  border-radius: 6px;\n  gap: 8px;\n  padding: 7px 9px;\n  display: flex;\n}\n\n.dh-record-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.dh-record-top {\n  align-items: baseline;\n  gap: 6px;\n  display: flex;\n}\n\n.dh-record-time {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.dh-record-event {\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.dh-record-command {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  text-align: left;\n  direction: rtl;\n  font-size: 12px;\n  overflow: hidden;\n}\n\n.dh-outcome {\n  white-space: nowrap;\n  border-radius: 9px;\n  align-self: flex-start;\n  padding: 1px 7px;\n  font-size: 11px;\n}\n\n.dh-outcome-ok {\n  color: var(--dsh-hooks-ok);\n  background: #3fb56b29;\n}\n\n.dh-outcome-bad {\n  color: var(--dsh-hooks-bad);\n  background: #e5534b29;\n}\n\n.dh-outcome-warn {\n  color: var(--dsh-hooks-warn);\n  background: #d9a13c29;\n}\n\n.dh-outcome-neutral {\n  color: var(--dsh-hooks-muted);\n  background: #80849029;\n}\n\n.dh-record-error {\n  color: var(--dsh-hooks-bad);\n  white-space: pre-wrap;\n  word-break: break-all;\n  margin-top: 4px;\n  font-size: 11px;\n}\n\n.dh-empty {\n  color: var(--dsh-hooks-muted);\n  padding: 6px 2px;\n  font-size: 12px;\n}\n\n.dh-test-form {\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.dh-test-row {\n  gap: 8px;\n  display: flex;\n}\n\n.dh-field {\n  flex-direction: column;\n  flex: 1;\n  gap: 3px;\n  display: flex;\n}\n\n.dh-field-label {\n  color: var(--dsh-hooks-muted);\n  font-size: 11px;\n}\n\n.dh-input, .dh-select {\n  border: 1px solid var(--dsh-hooks-panel-border);\n  color: var(--dsh-hooks-text);\n  background: #8084901f;\n  border-radius: 5px;\n  outline: none;\n  padding: 5px 8px;\n  font-size: 12px;\n}\n\n.dh-input:focus, .dh-select:focus {\n  border-color: var(--dsh-hooks-accent);\n}\n\n.dh-buttons {\n  gap: 8px;\n  display: flex;\n}\n\n.dh-button {\n  border: 1px solid var(--dsh-hooks-panel-border);\n  color: var(--dsh-hooks-text);\n  cursor: pointer;\n  background: #8084901f;\n  border-radius: 5px;\n  padding: 5px 12px;\n  font-size: 12px;\n}\n\n.dh-button:hover {\n  background: #80849038;\n}\n\n.dh-button-primary {\n  background: var(--dsh-hooks-accent);\n  border-color: var(--dsh-hooks-accent);\n  color: #fff;\n}\n\n.dh-button-primary:hover {\n  background: #3c7de8;\n}\n\n.dh-test-results {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.dh-test-line {\n  border-radius: 5px;\n  padding: 4px 8px;\n  font-size: 12px;\n}\n\n.dh-test-line-match {\n  color: var(--dsh-hooks-ok);\n  background: #3fb56b24;\n}\n\n.dh-test-line-skip {\n  color: var(--dsh-hooks-muted);\n  background: #8084901a;\n}\n\n.dh-error-banner {\n  color: var(--dsh-hooks-bad);\n  background: #e5534b1f;\n  border: 1px solid #e5534b66;\n  border-radius: 6px;\n  padding: 8px 10px;\n  font-size: 12px;\n}\n";
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
				root = (0, react_dom_client.createRoot)(target);
				root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HooksPanel, { onClose: hide }));
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
		exports.apply = apply;
		exports.name = name;
		return module.exports;
	}
});
