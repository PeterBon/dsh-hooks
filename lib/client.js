window.__ModuleLoader__.load({
	id: "dsh-hooks",
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
		/** POST a JSON action and surface the envelope result (error message included). */
		async function postFeishu(path, body, fetchFn) {
			try {
				const response = await fetchFn(path, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						accept: "application/json"
					},
					body: JSON.stringify(body)
				});
				const envelope = await response.json();
				if (!response.ok || !envelope.ok) return {
					ok: false,
					error: envelope.error?.message ?? `HTTP ${response.status}`
				};
				const value = envelope.value ?? {};
				return {
					ok: true,
					setup: value.setup,
					message: typeof value.message === "string" ? value.message : void 0,
					resultMaxChars: typeof value.resultMaxChars === "number" ? value.resultMaxChars : void 0
				};
			} catch (error) {
				console.warn(`[dsh-hooks-ui] POST ${path} failed: ${error instanceof Error ? error.message : String(error)}`);
				return {
					ok: false,
					error: "网络请求失败"
				};
			}
		}
		async function fetchFeishuStatus(fetchFn = fetch) {
			return getJson("/dsh-hooks/feishu/status", fetchFn);
		}
		async function postFeishuSetup(profile, resultMaxChars, fetchFn = fetch) {
			const body = { profile };
			if (resultMaxChars !== void 0) body.resultMaxChars = resultMaxChars;
			return postFeishu("/dsh-hooks/feishu/setup", body, fetchFn);
		}
		async function postFeishuConfig(resultMaxChars, fetchFn = fetch) {
			return postFeishu("/dsh-hooks/feishu/config", { resultMaxChars }, fetchFn);
		}
		async function postFeishuCancel(fetchFn = fetch) {
			return postFeishu("/dsh-hooks/feishu/cancel", {}, fetchFn);
		}
		async function postFeishuTest(fetchFn = fetch) {
			return postFeishu("/dsh-hooks/feishu/test", {}, fetchFn);
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
		* The dsh-hooks settings card: status badges, a manual event tester, the
		* Feishu connect flow (QR scan + truncation length + test card), and a
		* collapsed-by-default execution-history timeline at the bottom — all
		* served by the core plugin's /dsh-hooks/* routes. Degrades gracefully:
		* fetch failures show an inline notice, never a crash. Registered into the
		* shell's `settings.section` slot.
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
		const DEFAULT_TRUNCATE = 300;
		/** Settings-slot component; the shell's slot machinery supplies the props. */
		function HooksSettingsCard(_props) {
			const [status, setStatus] = (0, react.useState)(null);
			const [history, setHistory] = (0, react.useState)(null);
			const [historyOpen, setHistoryOpen] = (0, react.useState)(false);
			const [loadError, setLoadError] = (0, react.useState)(false);
			const [event, setEvent] = (0, react.useState)("turn/end");
			const [reason, setReason] = (0, react.useState)("completed");
			const [tool, setTool] = (0, react.useState)("");
			const [testResult, setTestResult] = (0, react.useState)(null);
			const [feishu, setFeishu] = (0, react.useState)(null);
			const [profile, setProfile] = (0, react.useState)("web");
			const [setupTruncate, setSetupTruncate] = (0, react.useState)(String(DEFAULT_TRUNCATE));
			const [truncateDraft, setTruncateDraft] = (0, react.useState)(null);
			const [configMessage, setConfigMessage] = (0, react.useState)(null);
			const [reconnecting, setReconnecting] = (0, react.useState)(false);
			const [feishuError, setFeishuError] = (0, react.useState)(null);
			const [testMessage, setTestMessage] = (0, react.useState)(null);
			const [countdown, setCountdown] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				const [statusInfo, records, feishuInfo] = await Promise.all([
					fetchStatus(),
					fetchHistory(30),
					fetchFeishuStatus()
				]);
				setStatus(statusInfo);
				setHistory(records);
				setFeishu(feishuInfo);
				setLoadError(statusInfo === null && records === null);
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				const timer = setInterval(() => void refresh(), 5e3);
				return () => clearInterval(timer);
			}, [refresh]);
			const pending = feishu?.setup?.status === "pending";
			(0, react.useEffect)(() => {
				if (!pending) return;
				const poll = setInterval(() => void refresh(), 2e3);
				const tick = setInterval(() => {
					setCountdown(remainingSeconds(feishu?.setup?.expiresAtMs));
				}, 1e3);
				return () => {
					clearInterval(poll);
					clearInterval(tick);
				};
			}, [
				pending,
				feishu?.setup?.expiresAtMs,
				refresh
			]);
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
			const connectFeishu = async () => {
				setFeishuError(null);
				setTestMessage(null);
				setConfigMessage(null);
				setCountdown(null);
				const parsed = Number(setupTruncate);
				const result = await postFeishuSetup(profile.trim() !== "" ? profile.trim() : "web", Number.isFinite(parsed) ? parsed : void 0);
				if (!result.ok) {
					setFeishuError(result.error ?? "启动扫码失败");
					return;
				}
				if (result.setup !== void 0) {
					setFeishu({
						configured: false,
						appId: null,
						targetKind: null,
						target: null,
						setup: result.setup,
						resultMaxChars: Number.isFinite(parsed) ? parsed : DEFAULT_TRUNCATE
					});
					setCountdown(remainingSeconds(result.setup.expiresAtMs));
				}
			};
			const cancelFeishu = async () => {
				await postFeishuCancel();
				refresh();
			};
			const sendTestCard = async () => {
				setTestMessage(null);
				setFeishuError(null);
				const result = await postFeishuTest();
				if (!result.ok) setFeishuError(result.error ?? "发送失败");
				else setTestMessage(result.message ?? "已发送");
			};
			const saveTruncate = async () => {
				const value = Number(truncateDraft);
				if (!Number.isFinite(value)) {
					setConfigMessage({
						ok: false,
						text: "请输入数字"
					});
					return;
				}
				const result = await postFeishuConfig(value);
				if (!result.ok) {
					setConfigMessage({
						ok: false,
						text: result.error ?? "保存失败"
					});
					return;
				}
				setTruncateDraft(null);
				setConfigMessage({
					ok: true,
					text: `已保存：卡片内容最长 ${result.resultMaxChars} 字符`
				});
				refresh();
			};
			const truncateValue = truncateDraft ?? String(feishu?.resultMaxChars ?? DEFAULT_TRUNCATE);
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
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: "dh-section-title",
						children: "飞书通知"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dh-feishu",
						children: pending ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dh-feishu-qr",
							children: [
								feishu?.setup?.qrDataUrl !== void 0 && feishu?.setup?.qrDataUrl !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									className: "dh-feishu-qr-img",
									src: feishu.setup.qrDataUrl,
									alt: "飞书扫码授权二维码"
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									className: "dh-feishu-link",
									href: feishu?.setup?.qrUrl,
									target: "_blank",
									rel: "noreferrer",
									children: "在浏览器中打开飞书授权链接"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-feishu-line",
									children: ["请用飞书扫码", countdown !== null && countdown > 0 ? `（${countdown}s 内有效）` : ""]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dh-buttons",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dh-button",
										onClick: () => void cancelFeishu(),
										children: "取消"
									})
								})
							]
						}) : feishu?.configured === true && !reconnecting ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dh-feishu-status",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-feishu-line dh-feishu-ok",
									children: [
										"✅ 已连接 · 应用 ",
										feishu.appId ?? "?",
										feishu.targetKind !== null && feishu.target !== null ? `（接收者 ${feishu.targetKind}: ${feishu.target}）` : ""
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-feishu-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dh-field dh-field-narrow",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dh-field-label",
											children: "卡片截断长度（50–5000 字符）"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "dh-input",
											type: "number",
											min: 50,
											max: 5e3,
											value: truncateValue,
											onChange: (e) => setTruncateDraft(e.target.value)
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dh-button",
										onClick: () => void saveTruncate(),
										children: "保存"
									})]
								}),
								configMessage !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: configMessage.ok ? "dh-feishu-line dh-feishu-ok" : "dh-feishu-error",
									children: configMessage.text
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-buttons",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dh-button dh-button-primary",
										onClick: () => void sendTestCard(),
										children: "发送测试卡片"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dh-button",
										onClick: () => setReconnecting(true),
										children: "重新连接"
									})]
								}),
								testMessage !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dh-feishu-line dh-feishu-ok",
									children: testMessage
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dh-feishu-hint",
									children: "截断长度即时生效；重新扫码会覆盖现有应用凭据与本 profile 的飞书 hooks。"
								})
							]
						}) : feishu?.setup?.status === "failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dh-feishu-status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dh-feishu-error",
								children: ["连接失败：", feishu.setup.error ?? "未知错误"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dh-buttons",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dh-button dh-button-primary",
									onClick: () => void connectFeishu(),
									children: "重试"
								})
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dh-feishu-form",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-test-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dh-field",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dh-field-label",
											children: "profile（写入哪个 profile 的 cordis.patch.yml）"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "dh-input",
											value: profile,
											onChange: (e) => setProfile(e.target.value),
											placeholder: "web"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dh-field dh-field-narrow",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dh-field-label",
											children: "卡片截断长度（50–5000）"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "dh-input",
											type: "number",
											min: 50,
											max: 5e3,
											value: setupTruncate,
											onChange: (e) => setSetupTruncate(e.target.value)
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dh-buttons",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dh-button dh-button-primary",
										onClick: () => void connectFeishu(),
										children: "扫码连接飞书"
									}), reconnecting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dh-button",
										onClick: () => setReconnecting(false),
										children: "返回"
									})]
								}),
								feishuError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dh-feishu-error",
									children: feishuError
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dh-feishu-hint",
									children: "将创建名为「DSH 通知机器人」的飞书应用（仅 im:message:send_as_bot 权限），扫码者本人接收通知卡片；配置写入 ~/.dsh/profiles/<profile>/cordis.patch.yml，重启 dsh web 后生效。"
								})
							]
						})
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dh-section-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
							className: "dh-section-title",
							children: ["执行历史（最近 30 条）", status !== null && status.historyCount > 0 ? ` · ${status.historyCount} 条` : ""]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dh-button dh-toggle",
							onClick: () => setHistoryOpen((open) => !open),
							"aria-expanded": historyOpen,
							children: historyOpen ? "收起 ▲" : "展开 ▼"
						})]
					}), historyOpen && (history === null || history.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
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
					}))] })
				]
			});
		}
		/** Seconds until the QR expires, or null when unknown/expired. */
		function remainingSeconds(expiresAtMs) {
			if (expiresAtMs === void 0) return null;
			return Math.max(0, Math.round((expiresAtMs - Date.now()) / 1e3));
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
		var settings_card_module_default = ":root {\n  --dsh-hooks-border: #80849038;\n  --dsh-hooks-muted: #767c85;\n  --dsh-hooks-accent: #4d8df7;\n  --dsh-hooks-ok: #3fb56b;\n  --dsh-hooks-bad: #e5534b;\n  --dsh-hooks-warn: #d9a13c;\n}\n\n.dh-card {\n  flex-direction: column;\n  gap: 14px;\n  padding: 12px 4px;\n  font-size: 13px;\n  line-height: 1.5;\n  display: flex;\n}\n\n.dh-card-head {\n  align-items: center;\n  gap: 10px;\n  display: flex;\n}\n\n.dh-card-title {\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.dh-badges {\n  gap: 6px;\n  display: flex;\n}\n\n.dh-badge {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  background: #80849029;\n  border-radius: 9px;\n  padding: 1px 7px;\n  font-size: 11px;\n}\n\n.dh-section-title {\n  color: var(--dsh-hooks-muted);\n  text-transform: uppercase;\n  letter-spacing: .04em;\n  margin: 0 0 8px;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.dh-section-head {\n  justify-content: space-between;\n  align-items: center;\n  gap: 8px;\n  margin: 0 0 8px;\n  display: flex;\n}\n\n.dh-section-head .dh-section-title {\n  margin: 0;\n}\n\n.dh-toggle {\n  padding: 2px 10px;\n  font-size: 11px;\n}\n\n.dh-field-narrow {\n  flex: 0 0 150px;\n}\n\n.dh-feishu-row {\n  align-items: flex-end;\n  gap: 8px;\n  display: flex;\n}\n\n.dh-timeline {\n  flex-direction: column;\n  gap: 6px;\n  display: flex;\n}\n\n.dh-record {\n  border: 1px solid var(--dsh-hooks-border);\n  border-radius: 6px;\n  gap: 8px;\n  padding: 7px 9px;\n  display: flex;\n}\n\n.dh-record-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.dh-record-top {\n  align-items: baseline;\n  gap: 6px;\n  display: flex;\n}\n\n.dh-record-time {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  font-size: 11px;\n}\n\n.dh-record-event {\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.dh-record-command {\n  color: var(--dsh-hooks-muted);\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  text-align: left;\n  direction: rtl;\n  font-size: 12px;\n  overflow: hidden;\n}\n\n.dh-outcome {\n  white-space: nowrap;\n  border-radius: 9px;\n  align-self: flex-start;\n  padding: 1px 7px;\n  font-size: 11px;\n}\n\n.dh-outcome-ok {\n  color: var(--dsh-hooks-ok);\n  background: #3fb56b29;\n}\n\n.dh-outcome-bad {\n  color: var(--dsh-hooks-bad);\n  background: #e5534b29;\n}\n\n.dh-outcome-warn {\n  color: var(--dsh-hooks-warn);\n  background: #d9a13c29;\n}\n\n.dh-outcome-neutral {\n  color: var(--dsh-hooks-muted);\n  background: #80849029;\n}\n\n.dh-record-error {\n  color: var(--dsh-hooks-bad);\n  white-space: pre-wrap;\n  word-break: break-all;\n  margin-top: 4px;\n  font-size: 11px;\n}\n\n.dh-empty {\n  color: var(--dsh-hooks-muted);\n  padding: 6px 2px;\n  font-size: 12px;\n}\n\n.dh-test-form {\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.dh-test-row {\n  gap: 8px;\n  display: flex;\n}\n\n.dh-field {\n  flex-direction: column;\n  flex: 1;\n  gap: 3px;\n  min-width: 0;\n  display: flex;\n}\n\n.dh-field-label {\n  color: var(--dsh-hooks-muted);\n  font-size: 11px;\n}\n\n.dh-input, .dh-select {\n  border: 1px solid var(--dsh-hooks-border);\n  color: inherit;\n  box-sizing: border-box;\n  background: #8084901f;\n  border-radius: 5px;\n  outline: none;\n  width: 100%;\n  padding: 5px 8px;\n  font-size: 12px;\n}\n\n.dh-input:focus, .dh-select:focus {\n  border-color: var(--dsh-hooks-accent);\n}\n\n.dh-buttons {\n  gap: 8px;\n  display: flex;\n}\n\n.dh-button {\n  border: 1px solid var(--dsh-hooks-border);\n  color: inherit;\n  cursor: pointer;\n  background: #8084901f;\n  border-radius: 5px;\n  padding: 5px 12px;\n  font-size: 12px;\n}\n\n.dh-button:hover {\n  background: #80849038;\n}\n\n.dh-button-primary {\n  background: var(--dsh-hooks-accent);\n  border-color: var(--dsh-hooks-accent);\n  color: #fff;\n}\n\n.dh-button-primary:hover {\n  background: #3c7de8;\n}\n\n.dh-test-results {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.dh-test-line {\n  word-break: break-all;\n  border-radius: 5px;\n  padding: 4px 8px;\n  font-size: 12px;\n}\n\n.dh-test-line-match {\n  color: var(--dsh-hooks-ok);\n  background: #3fb56b24;\n}\n\n.dh-test-line-skip {\n  color: var(--dsh-hooks-muted);\n  background: #8084901a;\n}\n\n.dh-error-banner {\n  color: var(--dsh-hooks-bad);\n  background: #e5534b1f;\n  border: 1px solid #e5534b66;\n  border-radius: 6px;\n  padding: 8px 10px;\n  font-size: 12px;\n}\n\n.dh-feishu {\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.dh-feishu-form, .dh-feishu-status, .dh-feishu-qr {\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 8px;\n  display: flex;\n}\n\n.dh-feishu-qr-img {\n  border: 1px solid var(--dsh-hooks-border);\n  box-sizing: border-box;\n  background: #fff;\n  border-radius: 8px;\n  width: 220px;\n  height: 220px;\n  padding: 6px;\n}\n\n.dh-feishu-line {\n  font-size: 12px;\n}\n\n.dh-feishu-ok {\n  color: var(--dsh-hooks-ok);\n}\n\n.dh-feishu-error {\n  color: var(--dsh-hooks-bad);\n  word-break: break-all;\n  font-size: 12px;\n}\n\n.dh-feishu-hint {\n  color: var(--dsh-hooks-muted);\n  font-size: 11px;\n}\n\n.dh-feishu-link {\n  color: var(--dsh-hooks-accent);\n  font-size: 12px;\n}\n";
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-hooks";
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
				ctx.slots.inject("settings.section", () => {
					const unregister = ctx.slots.register({
						name: "settings.section",
						id: "dsh-hooks",
						order: 100,
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
