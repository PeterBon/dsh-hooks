window.__ModuleLoader__.load({
	id: "@PeterBon/dsh-hooks-ui",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
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
		//#region src/client/settings-card.tsx
		/**
		* The dsh-hooks settings card: status badges, execution-history timeline,
		* and a manual event tester — all served by the core plugin's /dsh-hooks/*
		* routes. Degrades gracefully: fetch failures show an inline notice, never
		* a crash. Registered into the shell's `web-ui.plugin.item` slot.
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
		/** Settings-slot component; the shell's slot machinery supplies the props. */
		function HooksSettingsCard(_props) {
			const [status, setStatus] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)(null);
			const [loadError, setLoadError] = (0, react.useState)(false);
			const [event, setEvent] = (0, react.useState)("turn/end");
			const [reason, setReason] = (0, react.useState)("completed");
			const [tool, setTool] = (0, react.useState)("");
			const [testResult, setTestResult] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				const [statusInfo, records] = await Promise.all([fetchStatus(), fetchHistory(30)]);
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dh-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dh-card-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dh-card-title",
							children: "dsh-hooks"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
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
						})]
					}),
					loadError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dh-error-banner",
						children: "无法访问 /dsh-hooks/* 路由：请确认 dsh-hooks 核心插件已安装且 dsh web 已重启。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: "dh-section-title",
						children: "执行历史（最近 30 条）"
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
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
									className: "dh-button dh-button-primary",
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
		//#region src/client/settings-card.module.css?inline
		var settings_card_module_default = ":root {\n  --dsh-hooks-border: #80849038;\n  --dsh-hooks-muted: #767c85;\n  --dsh-hooks-accent: #4d8df7;\n  --dsh-hooks-ok: #3fb56b;\n  --dsh-hooks-bad: #e5534b;\n  --dsh-hooks-warn: #d9a13c;\n}\n\n.dh-card {\n  flex-direction: column;\n  gap: 14px;\n  padding: 12px 4px;\n  font-size: 13px;\n  line-height: 1.5;\n  display: flex;\n}\n\n.dh-card-head {\n  align-items: center;\n  gap: 10px;\n  display: flex;\n}\n\n.dh-card-title {\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.dh-badges {\n  gap: 6px;\n  display: flex;\n}\n\n.dh-badge {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  background: #80849029;\n  border-radius: 9px;\n  padding: 1px 7px;\n  font-size: 11px;\n}\n\n.dh-section-title {\n  color: var(--dsh-hooks-muted);\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  margin: 0 0 8px;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.dh-timeline {\n  flex-direction: column;\n  gap: 6px;\n  display: flex;\n}\n\n.dh-record {\n  border: 1px solid var(--dsh-hooks-border);\n  border-radius: 6px;\n  gap: 8px;\n  padding: 7px 9px;\n  display: flex;\n}\n\n.dh-record-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.dh-record-top {\n  align-items: baseline;\n  gap: 6px;\n  display: flex;\n}\n\n.dh-record-time {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.dh-record-event {\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.dh-record-command {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  text-align: left;\n  direction: rtl;\n  font-size: 12px;\n  overflow: hidden;\n}\n\n.dh-outcome {\n  white-space: nowrap;\n  border-radius: 9px;\n  align-self: flex-start;\n  padding: 1px 7px;\n  font-size: 11px;\n}\n\n.dh-outcome-ok {\n  color: var(--dsh-hooks-ok);\n  background: #3fb56b29;\n}\n\n.dh-outcome-bad {\n  color: var(--dsh-hooks-bad);\n  background: #e5534b29;\n}\n\n.dh-outcome-warn {\n  color: var(--dsh-hooks-warn);\n  background: #d9a13c29;\n}\n\n.dh-outcome-neutral {\n  color: var(--dsh-hooks-muted);\n  background: #80849029;\n}\n\n.dh-record-error {\n  color: var(--dsh-hooks-bad);\n  white-space: pre-wrap;\n  word-break: break-all;\n  margin-top: 4px;\n  font-size: 11px;\n}\n\n.dh-empty {\n  color: var(--dsh-hooks-muted);\n  padding: 6px 2px;\n  font-size: 12px;\n}\n\n.dh-test-form {\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.dh-test-row {\n  gap: 8px;\n  display: flex;\n}\n\n.dh-field {\n  flex-direction: column;\n  flex: 1;\n  gap: 3px;\n  min-width: 0;\n  display: flex;\n}\n\n.dh-field-label {\n  color: var(--dsh-hooks-muted);\n  font-size: 11px;\n}\n\n.dh-input, .dh-select {\n  border: 1px solid var(--dsh-hooks-border);\n  color: inherit;\n  box-sizing: border-box;\n  background: #8084901f;\n  border-radius: 5px;\n  outline: none;\n  width: 100%;\n  padding: 5px 8px;\n  font-size: 12px;\n}\n\n.dh-input:focus, .dh-select:focus {\n  border-color: var(--dsh-hooks-accent);\n}\n\n.dh-buttons {\n  gap: 8px;\n  display: flex;\n}\n\n.dh-button {\n  border: 1px solid var(--dsh-hooks-border);\n  color: inherit;\n  cursor: pointer;\n  background: #8084901f;\n  border-radius: 5px;\n  padding: 5px 12px;\n  font-size: 12px;\n}\n\n.dh-button:hover {\n  background: #80849038;\n}\n\n.dh-button-primary {\n  background: var(--dsh-hooks-accent);\n  border-color: var(--dsh-hooks-accent);\n  color: #fff;\n}\n\n.dh-button-primary:hover {\n  background: #3c7de8;\n}\n\n.dh-test-results {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.dh-test-line {\n  word-break: break-all;\n  border-radius: 5px;\n  padding: 4px 8px;\n  font-size: 12px;\n}\n\n.dh-test-line-match {\n  color: var(--dsh-hooks-ok);\n  background: #3fb56b24;\n}\n\n.dh-test-line-skip {\n  color: var(--dsh-hooks-muted);\n  background: #8084901a;\n}\n\n.dh-error-banner {\n  color: var(--dsh-hooks-bad);\n  background: #e5534b1f;\n  border: 1px solid #e5534b66;\n  border-radius: 6px;\n  padding: 8px 10px;\n  font-size: 12px;\n}\n";
		//#endregion
		//#region src/client/index.ts
		const name = "@PeterBon/dsh-hooks-ui";
		/** Required services: the slot registry must be up before this plugin applies. */
		const inject = ["slots"];
		const STYLE_ID = "dsh-hooks-ui-style";
		/** Single-application guard: first apply wins; later calls become no-ops. */
		let applied = false;
		function apply(ctx) {
			if (typeof document === "undefined") return;
			if (applied) return;
			applied = true;
			injectCardStyle();
			try {
				ctx.slots.inject("web-ui.plugin.item", () => {
					const unregister = ctx.slots.register({
						name: "web-ui.plugin.item",
						id: "dsh-hooks",
						order: 120,
						label: "Hooks"
					}, HooksSettingsCard);
					return () => {
						unregister();
					};
				});
			} catch (error) {
				console.error("[dsh-hooks-ui] slot registration failed:", error);
			}
			ctx.effect(() => () => {
				applied = false;
				document.getElementById(STYLE_ID)?.remove();
			}, "dsh-hooks-ui: card");
		}
		/** Inject the card stylesheet once (bundled as a string via .css?inline). */
		function injectCardStyle() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = settings_card_module_default;
			document.head.appendChild(style);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
