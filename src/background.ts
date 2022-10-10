if (/*isBrowserChromium()*/ !this.browser) {
	// Firefox accepts a list of event page scripts, whereas Chromium only accepts service workers
	this["importScripts"](
		"/dist/manage-storage.js",
		"/dist/stem-pattern-find.js",
		"/dist/diacritic-pattern.js",
		"/dist/shared-content.js",
	);
}
chrome.tabs.executeScript = isBrowserChromium() ? chrome.tabs.executeScript : browser.tabs.executeScript;
chrome.tabs.query = isBrowserChromium() ? chrome.tabs.query : browser.tabs.query as typeof chrome.tabs.query;
chrome.tabs.sendMessage = isBrowserChromium()
	? chrome.tabs.sendMessage
	: browser.tabs.sendMessage as typeof chrome.tabs.sendMessage;
chrome.tabs.get = isBrowserChromium() ? chrome.tabs.get : browser.tabs.get as typeof chrome.tabs.get;
chrome.search["search"] = isBrowserChromium()
	? (options: { query: string, tabId: number }) =>
		chrome.search["query"]({ text: options.query, tabId: options.tabId }, () => undefined)
	: browser.search.search;
chrome.commands.getAll = isBrowserChromium() ? chrome.commands.getAll : browser.commands.getAll;

/**
 * Creates an object storing highlighting information about a tab, for application to pages within that tab.
 * @param args Arguments for building the initial research instance. Variables in storage may also be used.
 * @returns The resulting research instance.
 */
const createResearchInstance = async (args: {
	url?: { stoplist: Array<string>, url: string, engine?: Engine }
	terms?: MatchTerms
	autoOverwritable: boolean
}): Promise<ResearchInstance> => {
	const sync = await getStorageSync([ StorageSync.SHOW_HIGHLIGHTS ]);
	const local = await getStorageLocal([ StorageLocal.PERSIST_RESEARCH_INSTANCES ]);
	if (args.url) {
		const phraseGroups = args.url.engine ? [] : (await getSearchQuery(args.url.url)).split("\"");
		const termsRaw = args.url.engine
			? args.url.engine.extract(args.url.url ?? "")
			: phraseGroups.flatMap(phraseGroups.length % 2
				? ((phraseGroup, i) => i % 2 ? phraseGroup : phraseGroup.split(" ").filter(phrase => !!phrase))
				: phraseGroup => phraseGroup.split(" "));
		const terms = Array.from(new Set(termsRaw))
			.filter(phrase => args.url ? !args.url.stoplist.includes(phrase) : false)
			.map(phrase => new MatchTerm(phrase));
		return {
			phrases: terms.map(term => term.phrase),
			terms,
			highlightsShown: sync.showHighlights.default,
			autoOverwritable: args.autoOverwritable,
			persistent: local.persistResearchInstances,
			enabled: true,
		};
	}
	args.terms ??= [];
	return {
		phrases: args.terms.map(term => term.phrase),
		terms: args.terms,
		highlightsShown: sync.showHighlights.default,
		autoOverwritable: args.autoOverwritable,
		persistent: local.persistResearchInstances,
		enabled: true,
	};
};

/**
 * Gets the query string of a potential search.
 * @param url A URL to be tested.
 * @returns The URL segment determined to be the search query, or the empty string if none is found.
 */
const getSearchQuery = async (url: string): Promise<string> => {
	const sync = await getStorageSync([ StorageSync.AUTO_FIND_OPTIONS ]);
	return new URL(url).searchParams.get(
		sync.autoFindOptions.searchParams.find(param => new URL(url).searchParams.has(param)) ?? ""
	) ?? "";
};

/**
 * Gets heuristically whether or not a URL specifies a search on an arbitrary search engine.
 * @param engines An array of objects representing search engine URLs and how to extract contained search queries.
 * @param url A URL to be tested.
 * @returns An object containing a flag for whether or not the URL specifies a search,
 * and the first object which matched the URL (if any).
 */
const isTabSearchPage = async (engines: Engines, url: string): Promise<{ isSearch: boolean, engine?: Engine }> => {
	if (await getSearchQuery(url)) {
		return { isSearch: true };
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return { isSearch: !!engine, engine };
	}
};

/**
 * Determines whether a URL is filtered in by a given URL filter.
 * @param url A URL object.
 * @param urlFilter A URL filter array, the component strings of which may contain wildcards.
 * @returns `true` if the URL is filtered in, `false` otherwise.
 */
const isUrlFilteredIn = (() => {
	const sanitize = (urlComponent: string) =>
		sanitizeForRegex(urlComponent).replace("\\*", ".*")
	;

	return (url: URL, urlFilter: URLFilter): boolean =>
		!!urlFilter.find(({ hostname, pathname }) =>
			(new RegExp(sanitize(hostname) + "\\b")).test(url.hostname)
			&& (pathname === "" || pathname === "/" || (new RegExp("\\b" + sanitize(pathname.slice(1)))).test(url.pathname.slice(1)))
		)
	;
})();

/**
 * Determines whether the user has permitted pages with the given URL to be deeply modified during highlighting,
 * which is powerful but may be destructive.
 * @param urlString The valid URL string corresponding to a page to be potentially highlighted.
 * @param urlFilters URL filter preferences.
 * @returns `true` if the corresponding page may be modified, `false` otherwise.
 */
const isUrlPageModifyAllowed = (urlString: string, urlFilters: StorageSyncValues[StorageSync.URL_FILTERS]) =>
	!isUrlFilteredIn(new URL(urlString), urlFilters.noPageModify)
;

/**
 * Determines whether the user has permitted pages with the given URL to treated as a search page,
 * from which keywords may be collected.
 * @param urlString The valid URL string corresponding to a page to be potentially auto-highlighted.
 * @param urlFilters An object of details about URL filtering.
 * @returns `true` if the corresponding page may be treated as a search page, `false` otherwise.
 */
const isUrlSearchHighlightAllowed = (urlString: string, urlFilters: StorageSyncValues[StorageSync.URL_FILTERS]) =>
	!isUrlFilteredIn(new URL(urlString), urlFilters.nonSearch)
;

/**
 * Determines whether the highlight-showing should be toggled on, off, or left unchanged.
 * @param highlightsShown Whether or not highlights are shown currently.
 * @param overrideHighlightsShown Whether or not to force highlights to be shown,
 * or not change highlight-showing if `undefined`
 * @returns `true` to toggle on, `false` to toggle off, `undefined` to not change.
 */
const determineToggleHighlightsOn = (highlightsShown: boolean, overrideHighlightsShown?: boolean) =>
	overrideHighlightsShown === undefined
		? undefined
		: highlightsShown || overrideHighlightsShown
;

/**
 * Caches objects, representing search engine URLs and how to extract their search queries, to session storage.
 * These objects are generated from information such as dynamic bookmarks stored by the user,
 * and caching is triggered on information update.
 */
const manageEnginesCacheOnBookmarkUpdate = (() => {
	/**
	 * Updates an array of user search engines with respect to a particular engine ID, based on a potentially dynamic URL.
	 * @param engines An array of user search engines.
	 * @param id The unique ID of a potential or existing engine.
	 * @param urlDynamicString The string of a URL which may be dynamic (contains `%s` as in a dynamic bookmark).
	 */
	const updateEngine = (engines: Engines, id: string, urlDynamicString: string) => {
		if (!urlDynamicString) {
			return;
		}
		if (!urlDynamicString.includes("%s")) {
			delete engines[id];
			return;
		}
		const engine = new Engine({ urlDynamicString });
		if (Object.values(engines).find(thisEngine => thisEngine.equals(engine))) {
			return;
		}
		engines[id] = engine;
	};

	/**
	 * Uses a function accepting a single bookmark tree node to modify user search engines in storage.
	 * Accepts all such nodes under a root node.
	 * @param engines An array of user search engine objects.
	 * @param setEngine A function to modify user search engines in storage based on a bookmark tree node.
	 * @param node A root node under which to accept descendant nodes (inclusive).
	 */
	const setEngines = (engines: Engines, setEngine: (node: browser.bookmarks.BookmarkTreeNode) => void,
		node: browser.bookmarks.BookmarkTreeNode) => {
		if (node.type === "bookmark") {
			setEngine(node);
		}
		(node.children ?? []).forEach(child => setEngines(engines, setEngine, child));
	};

	return () => {
		if (isBrowserChromium() || !chrome.bookmarks) {
			return;
		}
		browser.bookmarks.getTree().then(async nodes => {
			const session = await getStorageSession([ StorageSession.ENGINES ]);
			nodes.forEach(node =>
				setEngines(session.engines, node => {
					if (node.url) {
						updateEngine(session.engines, node.id, node.url);
					}
				}, node)
			);
			setStorageSession(session);
		});

		browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
			const session = await getStorageSession([ StorageSession.ENGINES ]);
			setEngines(session.engines, node => {
				delete session.engines[node.id];
			}, removeInfo.node);
			setStorageSession(session);
		});

		browser.bookmarks.onCreated.addListener(async (id, createInfo) => {
			if (createInfo.url) {
				const session = await getStorageSession([ StorageSession.ENGINES ]);
				updateEngine(session.engines, id, createInfo.url);
				setStorageSession(session);
			}
		});

		browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
			if (changeInfo.url) {
				const session = await getStorageSession([ StorageSession.ENGINES ]);
				updateEngine(session.engines, id, changeInfo.url);
				setStorageSession(session);
			}
		});
	};
})();

/**
 * Updates the action icon to reflect the extension's enabled/disabled status.
 * @param enabled If specified, overrides the extension's enabled/disabled status.
 */
const updateActionIcon = (enabled?: boolean) =>
	enabled === undefined
		? getStorageLocal([ StorageLocal.ENABLED ]).then(local => updateActionIcon(local.enabled))
		: chrome.browserAction.setIcon({ path: isBrowserChromium()
			? enabled ? "/icons/mms-32.png" : "/icons/mms-off-32.png" // Chromium still has patchy SVG support
			: enabled ? "/icons/mms.svg" : "/icons/mms-off.svg"
		})
;

(() => {
	/**
	 * Registers items to selectively appear in context menus. These items serve as shortcuts for managing the extension.
	 */
	const createContextMenuItems = () => {
		chrome.contextMenus.onClicked.addListener((info, tab) => {
			if (tab && tab.id !== undefined) {
				activateResearchInTab(tab.id);
			}
		});
	
		return (() => {
			chrome.contextMenus.removeAll();
			chrome.contextMenus.create({
				title: "&Highlight Selection",
				id: "activate-research-tab",
				contexts: [ "selection", "page" ],
			});
		})();
	};

	/**
	 * Prepares non-volatile extension components on install.
	 */
	const setUp = () => {
		if (isBrowserChromium()) {
			// TODO instruct user how to assign the appropriate shortcuts
		} else {
			browser.commands.update({ name: "toggle-select", shortcut: "Ctrl+Shift+U" });
			browser.commands.update({ name: "toggle-bar", shortcut: "Ctrl+Shift+F" });
			browser.commands.update({ name: "toggle-research-global", shortcut: "Alt+Shift+J" });
			browser.commands.update({ name: "focus-term-append", shortcut: "Alt+Period" });
			for (let i = 0; i < 10; i++) {
				browser.commands.update({ name: `select-term-${i}`, shortcut: `Alt+Shift+${(i + 1) % 10}` });
				browser.commands.update({ name: `select-term-${i}-reverse`, shortcut: `Ctrl+Shift+${(i + 1) % 10}` });
			}
		}
	};

	/**
	 * Prepares volatile extension components in a new browser session.
	 */
	const initialize = () => {
		manageEnginesCacheOnBookmarkUpdate();
		createContextMenuItems();
		initializeStorage();
		updateActionIcon();
	};

	chrome.runtime.onInstalled.addListener(details => {
		if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
			setUp();
		}
		repairOptions();
		initialize();
	});

	chrome.runtime.onStartup.addListener(initialize);
})();

(() => {
	/**
	 * Compares an updated tab with its associated storage in order to identify necessary storage and highlighting changes,
	 * then carries out these changes.
	 * @param urlString The current URL of the tab, used to infer desired highlighting.
	 * @param tabId The ID of a tab to check and interact with.
	 */
	const pageModifyRemote = async (urlString: string, tabId: number) => {
		const sync = await getStorageSync([
			StorageSync.AUTO_FIND_OPTIONS,
			StorageSync.SHOW_HIGHLIGHTS,
			StorageSync.BAR_CONTROLS_SHOWN,
			StorageSync.BAR_LOOK,
			StorageSync.HIGHLIGHT_LOOK,
			StorageSync.MATCH_MODE_DEFAULTS,
			StorageSync.URL_FILTERS,
		]);
		const local = await getStorageLocal([ StorageLocal.ENABLED ]);
		const session = await getStorageSession([
			StorageSession.RESEARCH_INSTANCES,
			StorageSession.ENGINES,
		]);
		const searchDetails: { isSearch: boolean, engine?: Engine } = local.enabled
			? await isTabSearchPage(session.engines, urlString)
			: { isSearch: false };
		searchDetails.isSearch = searchDetails.isSearch && isUrlSearchHighlightAllowed(urlString, sync.urlFilters);
		const isResearchPage = isTabResearchPage(session.researchInstances, tabId);
		const overrideHighlightsShown = (searchDetails.isSearch && sync.showHighlights.overrideSearchPages)
			|| (isResearchPage && sync.showHighlights.overrideResearchPages);
		if (searchDetails.isSearch && (isResearchPage ? session.researchInstances[tabId].autoOverwritable : true)) {
			const researchInstance = await createResearchInstance({
				url: {
					stoplist: sync.autoFindOptions.stoplist,
					url: urlString,
					engine: searchDetails.engine,
				},
				autoOverwritable: true,
			});
			if (!isResearchPage || !itemsMatch(session.researchInstances[tabId].phrases, researchInstance.phrases)) {
				session.researchInstances[tabId] = researchInstance;
				setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
				activateHighlightingInTab(tabId, {
					terms: researchInstance.terms,
					toggleHighlightsOn: determineToggleHighlightsOn(researchInstance.highlightsShown, overrideHighlightsShown),
					barControlsShown: sync.barControlsShown,
					barLook: sync.barLook,
					highlightLook: sync.highlightLook,
					matchMode: sync.matchModeDefaults,
					enablePageModify: isUrlPageModifyAllowed(urlString, sync.urlFilters),
				});
			}
		}
		if (isResearchPage) {
			const researchInstance = session.researchInstances[tabId];
			activateHighlightingInTab(tabId, {
				terms: researchInstance.terms,
				toggleHighlightsOn: determineToggleHighlightsOn(researchInstance.highlightsShown, overrideHighlightsShown),
				barControlsShown: sync.barControlsShown,
				barLook: sync.barLook,
				highlightLook: sync.highlightLook,
				matchMode: sync.matchModeDefaults,
				enablePageModify: isUrlPageModifyAllowed(urlString, sync.urlFilters),
			});
		}
	};
	
	chrome.tabs.onCreated.addListener(async tab => {
		const local = await getStorageLocal([ StorageLocal.FOLLOW_LINKS ]);
		if (!local.followLinks
			|| tab.id === undefined || tab.openerTabId === undefined || /\b\w+:(\/\/)?newtab\//.test(tab.pendingUrl ?? tab.url ?? "")) {
			return;
		}
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		if (isTabResearchPage(session.researchInstances, tab.openerTabId)) {
			const sync = await getStorageSync([ StorageSync.LINK_RESEARCH_TABS ]);
			session.researchInstances[tab.id] = sync.linkResearchTabs
				? session.researchInstances[tab.openerTabId]
				: { ...session.researchInstances[tab.openerTabId] };
			setStorageSession(session);
			pageModifyRemote(tab.url ?? "", tab.id); // New tabs may fail to trigger web navigation, due to loading from cache
		}
	});

	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (changeInfo.url) {
			pageModifyRemote(changeInfo.url, tabId);
		}
	});

	if (isBrowserChromium()) {
		// Chromium emits no `tabs` event for tab reload
		chrome.webNavigation.onCommitted.addListener(details => {
			if (details.url !== "" && details.transitionType === "reload") {
				pageModifyRemote(details.url, details.tabId);
			}
		});
	}
})();

/**
 * Activates highlighting within a tab.
 * @param targetTabId The ID of a tab to highlight within.
 * @param highlightMessageToReceive A message to be received by the tab's highlighting script.
 * This script will first be injected if not already present.
 */
const activateHighlightingInTab = async (targetTabId: number, highlightMessageToReceive?: HighlightMessage) => {
	highlightMessageToReceive = Object.assign(
		{ extensionCommands: await chrome.commands.getAll() } as HighlightMessage,
		highlightMessageToReceive,
	);
	chrome.tabs.executeScript(targetTabId, { file: "/dist/stem-pattern-find.js" }).then(async () => {
		await chrome.tabs.executeScript(targetTabId, { file: "/dist/diacritic-pattern.js" });
		await chrome.tabs.executeScript(targetTabId, { file: "/dist/shared-content.js" });
		await chrome.tabs.executeScript(targetTabId, { file: "/dist/term-highlight.js" });
		chrome.tabs.sendMessage(targetTabId, highlightMessageToReceive);
	}).catch(() => {
		chrome.tabs.sendMessage(targetTabId, highlightMessageToReceive);
	});
};

/**
 * Activates highlighting within a tab using the current user selection, storing appropriate highlighting information.
 * @param tabId The ID of a tab to be linked and within which to highlight.
 * @param messagingRetriesRemaining The number of retries permitted in case of tab messaging errors.
 * Retries are preceded by attempting to inject the highlighting script.
 */
const activateResearchInTab = async (tabId: number, retriesRemaining = 1) => {
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	// TODO make function (getting selected terms with retries)
	const termsSelected = await (chrome.tabs.sendMessage as typeof browser.tabs.sendMessage)(
		tabId,
		{ getDetails: { termsFromSelection: true } } as HighlightMessage,
	).then((response: HighlightDetails) =>
		response.terms ?? []
	).catch(() => undefined);
	if (termsSelected === undefined) { // Error when sending message, likely due to lack of an injected script
		// We cannot be sure there is no user selection, so must retry
		if (retriesRemaining > 0) { // Try executing+messaging again if attempts not exhausted
			await executeScriptsInTab(tabId);
			activateResearchInTab(tabId, retriesRemaining - 1);
		}
		return; // Gives up at this point if no retries remain, as it is assumed that scripts cannot be injected into this tab
	}
	const researchInstance = session.researchInstances[tabId]
		? session.researchInstances[tabId]
		: await createResearchInstance({
			terms: [],
			autoOverwritable: false,
		});
	researchInstance.terms = termsSelected.length ? termsSelected : researchInstance.terms;
	researchInstance.enabled = true;
	researchInstance.highlightsShown = true;
	researchInstance.autoOverwritable = false;
	handleMessage({
		terms: researchInstance.terms,
		makeUnique: true,
		toggleHighlightsOn: true,
		highlightCommand: { type: CommandType.FOCUS_TERM_INPUT },
	} as BackgroundMessage, tabId);
	session.researchInstances[tabId] = researchInstance;
	await setStorageSession(session);
};

/**
 * Disables the highlighting information about a tab.
 * @param tabId The ID of a tab to be forgotten.
 */
const disableResearchInstanceInTab = async (tabId: number) => {
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	const researchInstance = session.researchInstances[tabId];
	if (researchInstance) {
		if (researchInstance.persistent) {
			researchInstance.enabled = false;
		} else {
			delete session.researchInstances[tabId];
		}
		setStorageSession(session);
	}
};

/**
 * Removes highlighting within a tab, disabling the associated highlighting information.
 * @param tabId The ID of a tab to be forgotten and within which to deactivate highlighting.
 */
const deactivateResearchInTab = (tabId: number) => {
	disableResearchInstanceInTab(tabId);
	chrome.tabs.sendMessage(tabId, { deactivate: true } as HighlightMessage);
};

/**
 * Toggles highlighting visibility within a tab.
 * @param tabId The ID of a tab to change the highlighting visibility of.
 * @param toggleHighlightsOn If specified, indicates target visibility. If unspecified, inverse of current visibility is used.
 */
const toggleHighlightsInTab = async (tabId: number, toggleHighlightsOn?: boolean) => {
	const sync = await getStorageSync([ StorageSync.BAR_CONTROLS_SHOWN ]);
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	if (isTabResearchPage(session.researchInstances, tabId)) {
		const researchInstance = session.researchInstances[tabId];
		researchInstance.highlightsShown = toggleHighlightsOn
		?? !await (chrome.tabs.sendMessage as typeof browser.tabs.sendMessage)(
			tabId,
			{ getDetails: { highlightsShown: true } } as HighlightMessage,
		).then((response: HighlightDetails) =>
			response.highlightsShown
		).catch(() =>
			researchInstance.highlightsShown
		);
		chrome.tabs.sendMessage(tabId, {
			toggleHighlightsOn: researchInstance.highlightsShown,
			barControlsShown: sync.barControlsShown,
		} as HighlightMessage);
		setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
	}
};

/**
 * Injects a highlighting script, composed of the highlighting code preceded by its dependencies, into a tab.
 * @param tabId The ID of a tab to execute the script in.
 */
const executeScriptsInTab = async (tabId: number) => {
	await chrome.tabs.executeScript(tabId as number, { file: "/dist/stem-pattern-find.js" });
	await chrome.tabs.executeScript(tabId as number, { file: "/dist/diacritic-pattern.js" });
	await chrome.tabs.executeScript(tabId as number, { file: "/dist/shared-content.js" });
	await chrome.tabs.executeScript(tabId as number, { file: "/dist/term-highlight.js" });
};

chrome.commands.onCommand.addListener(async commandString => {
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); // `tab.id` always defined for this case
	const commandInfo = parseCommand(commandString);
	switch (commandInfo.type) {
	case CommandType.TOGGLE_ENABLED: {
		getStorageLocal([ StorageLocal.ENABLED ]).then(local => {
			setStorageLocal({ enabled: !local.enabled } as StorageLocalValues);
			updateActionIcon(!local.enabled);
		});
		return;
	} case CommandType.TOGGLE_IN_TAB: {
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		if (isTabResearchPage(session.researchInstances, tab.id as number)) {
			deactivateResearchInTab(tab.id as number);
		} else {
			activateResearchInTab(tab.id as number);
		}
		return;
	} case CommandType.TOGGLE_HIGHLIGHTS: {
		toggleHighlightsInTab(tab.id as number);
		return;
	}}
	chrome.tabs.sendMessage(tab.id as number, { command: commandInfo } as HighlightMessage);
});

/**
 * Decodes a message involving backend extension management.
 * @param message A message intended for the background script.
 * @param senderTabId The ID of a tab assumed to be the message sender.
 */
const handleMessage = async (message: BackgroundMessage, senderTabId: number) => {
	if (message.highlightMessage !== undefined) {
		if (message.executeInTab) {
			await executeScriptsInTab(message.tabId as number);
		}
		chrome.tabs.sendMessage(message.tabId as number, message.highlightMessage);
	} else if (message.toggleResearchOn !== undefined) {
		setStorageLocal({ enabled: message.toggleResearchOn } as StorageLocalValues)
			.then(() => updateActionIcon(message.toggleResearchOn));
	} else if (message.disableTabResearch) {
		deactivateResearchInTab(senderTabId);
	} else if (message.performSearch) {
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		(chrome.search["search"] as typeof browser.search.search)({
			query: session.researchInstances[senderTabId].terms.map(term => term.phrase).join(" "),
			tabId: senderTabId,
		});
	} else {
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		if (message.makeUnique || !isTabResearchPage(session.researchInstances, senderTabId)) {
			const researchInstance = await createResearchInstance({
				terms: message.terms,
				autoOverwritable: false,
			});
			session.researchInstances[senderTabId] = researchInstance;
			setStorageSession(session);
		}
		if (message.makeUnique || message.toggleHighlightsOn !== undefined) {
			const researchInstance = session.researchInstances[senderTabId]; // From previous `if` statement
			const sync = await getStorageSync([
				StorageSync.BAR_CONTROLS_SHOWN,
				StorageSync.BAR_LOOK,
				StorageSync.HIGHLIGHT_LOOK,
				StorageSync.MATCH_MODE_DEFAULTS,
				StorageSync.URL_FILTERS,
			]);
			if (message.toggleHighlightsOn !== undefined) {
				researchInstance.highlightsShown = message.toggleHighlightsOn;
			}
			activateHighlightingInTab(senderTabId, {
				terms: researchInstance.terms,
				toggleHighlightsOn: determineToggleHighlightsOn(researchInstance.highlightsShown, false),
				barControlsShown: sync.barControlsShown,
				barLook: sync.barLook,
				highlightLook: sync.highlightLook,
				matchMode: sync.matchModeDefaults,
				enablePageModify: isUrlPageModifyAllowed((await chrome.tabs.get(senderTabId)).url ?? "", sync.urlFilters),
				command: message.highlightCommand,
			});
		} else if (message.terms !== undefined) {
			session.researchInstances[senderTabId].terms = message.terms;
			setStorageSession(session);
			const highlightMessage: HighlightMessage = { terms: message.terms };
			highlightMessage.termUpdate = message.termChanged;
			highlightMessage.termToUpdateIdx = message.termChangedIdx;
			Object.keys(session.researchInstances).forEach(tabId => {
				if (session.researchInstances[tabId] === session.researchInstances[senderTabId]) {
					chrome.tabs.sendMessage(Number(tabId), highlightMessage);
				}
			});
		}
	}
};

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
	if (sender.tab && sender.tab.id !== undefined) {
		handleMessage(message, sender.tab.id);
	} else {
		chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) =>
			handleMessage(message, tab.id as number)
		);
	}
	sendResponse(); // Mitigates manifest V3 bug which otherwise logs an error message
});

chrome.browserAction.onClicked.addListener(() =>
	chrome.permissions.request({ permissions: [ "bookmarks" ] })
);

chrome.permissions.onAdded.addListener(permissions =>
	permissions && permissions.permissions && permissions.permissions.includes("bookmarks")
		? manageEnginesCacheOnBookmarkUpdate() : undefined
);
