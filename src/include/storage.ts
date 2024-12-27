/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

chrome.storage = useChromeAPI() ? chrome.storage : browser.storage as typeof chrome.storage;
chrome.storage.session ??= chrome.storage.local;

type ResearchInstances = Record<number, ResearchInstance>
type Engines = Record<string, Engine>
type StorageSessionValues = {
	[StorageSession.RESEARCH_INSTANCES]: ResearchInstances
	[StorageSession.ENGINES]: Engines
}
type StorageLocalValues = {
	[StorageLocal.ENABLED]: boolean
	[StorageLocal.PERSIST_RESEARCH_INSTANCES]: boolean
}
type StorageSyncValues = {
	[StorageSync.AUTO_FIND_OPTIONS]: {
		stoplist: Array<string>
		searchParams: Array<string>
	}
	[StorageSync.MATCH_MODE_DEFAULTS]: MatchMode
	[StorageSync.SHOW_HIGHLIGHTS]: {
		default: boolean
		overrideSearchPages: boolean
		overrideResearchPages: boolean
	}
	[StorageSync.BAR_COLLAPSE]: {
		fromSearch: boolean
		fromTermListAuto: boolean
	}
	[StorageSync.BAR_CONTROLS_SHOWN]: {
		toggleBarCollapsed: boolean
		disableTabResearch: boolean
		performSearch: boolean
		toggleHighlights: boolean
		appendTerm: boolean
		replaceTerms: boolean
	}
	[StorageSync.BAR_LOOK]: {
		showEditIcon: boolean
		showRevealIcon: boolean
		fontSize: string
		opacityControl: number
		opacityTerm: number
		borderRadius: string
	}
	[StorageSync.HIGHLIGHT_METHOD]: {
		paintReplaceByClassic: boolean
		paintUseExperimental: boolean
		hues: Array<number>
	}
	[StorageSync.URL_FILTERS]: {
		noPageModify: URLFilter
		nonSearch: URLFilter
	}
	[StorageSync.TERM_LISTS]: Array<TermList>
}
type URLFilter = Array<{
	hostname: string,
	pathname: string,
}>
type TermList = {
	name: string
	terms: Array<MatchTerm>
	urlFilter: URLFilter
}

type StorageAreaName = "session" | "local" | "sync"

type StorageArea<Area extends StorageAreaName> =
	Area extends "session" ? StorageSession :
	Area extends "local" ? StorageLocal :
	Area extends "sync" ? StorageSync :
never;

type StorageAreaValues<Area extends StorageAreaName> =
	Area extends "session" ? StorageSessionValues :
	Area extends "local" ? StorageLocalValues :
	Area extends "sync" ? StorageSyncValues :
never;

enum StorageSession { // Keys assumed to be unique across all storage areas (excluding 'managed')
	RESEARCH_INSTANCES = "researchInstances",
	ENGINES = "engines",
}

enum StorageLocal {
	ENABLED = "enabled",
	PERSIST_RESEARCH_INSTANCES = "persistResearchInstances",
}

enum StorageSync {
	AUTO_FIND_OPTIONS = "autoFindOptions",
	MATCH_MODE_DEFAULTS = "matchModeDefaults",
	SHOW_HIGHLIGHTS = "showHighlights",
	BAR_COLLAPSE = "barCollapse",
	BAR_CONTROLS_SHOWN = "barControlsShown",
	BAR_LOOK = "barLook",
	HIGHLIGHT_METHOD = "highlightMethod",
	URL_FILTERS = "urlFilters",
	TERM_LISTS = "termLists",
}

interface ResearchInstance {
	terms: MatchTerms
	highlightsShown: boolean
	barCollapsed: boolean
	enabled: boolean
}

/**
 * The default options to be used for items missing from storage, or to which items may be reset.
 * Set to sensible options for a generic first-time user of the extension.
 */
const optionsDefault: StorageSyncValues = {
	autoFindOptions: {
		searchParams: [ // Order of specificity, as only the first match will be used.
			"search_terms", "search_term", "searchTerms", "searchTerm",
			"search_query", "searchQuery",
			"search",
			"query",
			"phrase",
			"keywords", "keyword",
			"terms", "term",
			"text",
			// Short forms:
			"s", "q", "p", "k",
			// Special cases:
			"_nkw", // eBay
			"wd", // Baidu
		],
		stoplist: [
			"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
			"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
			"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's", "you", "your", "yours",
		],
	},
	matchModeDefaults: {
		regex: false,
		case: false,
		stem: true,
		whole: false,
		diacritics: false,
	},
	showHighlights: {
		default: true,
		overrideSearchPages: false,
		overrideResearchPages: false,
	},
	barCollapse: {
		fromSearch: false,
		fromTermListAuto: false,
	},
	barControlsShown: {
		toggleBarCollapsed: true,
		disableTabResearch: true,
		performSearch: false,
		toggleHighlights: true,
		appendTerm: true,
		replaceTerms: true,
	},
	barLook: {
		showEditIcon: true,
		showRevealIcon: true,
		fontSize: "14.6px",
		opacityControl: 0.8,
		opacityTerm: 0.86,
		borderRadius: "4px",
	},
	highlightMethod: {
		paintReplaceByClassic: true,
		paintUseExperimental: false,
		hues: [ 300, 60, 110, 220, 30, 190, 0 ],
	},
	urlFilters: {
		noPageModify: [],
		nonSearch: [],
	},
	termLists: [],
};

/**
 * The working cache of items retrieved from storage since the last background startup.
 */
const storageCache: Record<StorageAreaName, StorageAreaValues<StorageAreaName> | Record<never, never>> = {
	session: {},
	local: {},
	sync: {},
};

/**
 * Gets an object of key-value pairs corresponding to a set of keys in the given area of storage.
 * Storage may be fetched asynchronously or immediately retrieved from a cache.
 * @param area The name of the storage area from which to retrieve values.
 * @param keys The keys corresponding to the entries to retrieve.
 * @returns A promise resolving to an object of storage entries.
 */
const storageGet = async <Area extends StorageAreaName>(area: Area, keys?: Array<StorageArea<Area>>):
	Promise<StorageAreaValues<Area>> =>
{
	if (keys && keys.every(key => storageCache[area][key as string] !== undefined)) {
		return { ...storageCache[area] } as StorageAreaValues<Area>;
	}
	const store = await chrome.storage[area].get(keys) as StorageAreaValues<Area>;
	const storeAsSession = store as StorageAreaValues<"session">;
	if (storeAsSession.engines) {
		const engines = storeAsSession.engines as Engines;
		Object.keys(engines).forEach(id => engines[id] = Object.assign(new Engine, engines[id]));
	}
	Object.entries(store).forEach(([ key, value ]) => {
		storageCache[area][key] = value;
	});
	return { ...store };
};

/**
 * 
 * @param area 
 * @param store 
 */
const storageSet = async <Area extends StorageAreaName>(area: Area, store: StorageAreaValues<Area>) => {
	Object.entries(store).forEach(([ key, value ]) => {
		storageCache[area][key] = value;
	});
	await chrome.storage[area].set(store);
};

/**
 * Sets internal storage to its default working values.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const storageInitialize = async () => {
	const local = await storageGet("local");
	const localOld = { ...local };
	const toRemove: Array<string> = [];
	if (objectFixWithDefaults(local, {
		enabled: true,
		followLinks: true,
		persistResearchInstances: true,
	} as StorageLocalValues, toRemove)) {
		console.warn("Storage 'local' cleanup rectified issues. Results:", localOld, local); // Use standard logging system?
	}
	await storageSet("local", local);
	if (chrome.storage["session"] !== chrome.storage.local) { // Temporary fix. Without the 'session' API, its values may be stored in 'local'.
		await chrome.storage.local.remove(toRemove);
	}
	await storageSet("session", {
		researchInstances: {},
		engines: {},
	});
};

/**
 * Makes an object conform to an object of defaults.
 * Missing default items are assigned, and items with no corresponding default are removed. Items within arrays are ignored.
 * @param object An object to repair.
 * @param defaults An object of default items to be compared with the first object.
 * @param toRemove An empty array to be filled with deleted top-level keys.
 * @param atTopLevel Indicates whether or not the function is currently at the top level of the object.
 * @returns Whether or not any fixes were applied.
 */
const objectFixWithDefaults = (
	object: Record<string, unknown>,
	defaults: Record<string, unknown>,
	toRemove: Array<string>,
	atTopLevel = true,
): boolean => {
	let hasModified = false;
	Object.keys(object).forEach(objectKey => {
		if (defaults[objectKey] === undefined) {
			delete object[objectKey];
			if (atTopLevel) {
				toRemove.push(objectKey);
			}
			hasModified = true;
		} else if (typeof(object[objectKey]) === "object" && !Array.isArray(object[objectKey])) {
			if (objectFixWithDefaults(
				object[objectKey] as Record<string, unknown>,
				defaults[objectKey] as Record<string, unknown>,
				toRemove,
				false,
			)) {
				hasModified = true;
			}
		}
	});
	Object.keys(defaults).forEach(defaultsKey => {
		if (typeof(object[defaultsKey]) !== typeof(defaults[defaultsKey])
			|| Array.isArray(object[defaultsKey]) !== Array.isArray(defaults[defaultsKey])) {
			object[defaultsKey] = defaults[defaultsKey];
			hasModified = true;
		}
	});
	return hasModified;
};

/**
 * Checks persistent options storage for unwanted or misconfigured values, then restores it to a normal state.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const optionsRepair = async () => {
	const sync = await storageGet("sync");
	const syncOld = { ...sync };
	const toRemove = [];
	if (objectFixWithDefaults(sync, optionsDefault, toRemove)) {
		console.warn("Storage 'sync' cleanup rectified issues. Results:", syncOld, sync); // Use standard logging system?
	}
	storageSet("sync", sync);
	await chrome.storage.sync.remove(toRemove);
};

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName === "managed") {
		return;
	}
	if ([ "researchInstances", "engines" ].some(key => changes[key])) {
		areaName = "session";
	}
	Object.entries(changes).forEach(([ key, value ]) => {
		storageCache[areaName][key] = value.newValue;
	});
});

/*const updateCache = (changes: Record<string, chrome.storage.StorageChange>, areaName: StorageAreaName | "managed") => {
	if (areaName === "managed") {
		return;
	}
	if ([ "researchInstances", "engines" ].some(key => changes[key])) {
		areaName = "session";
	}
	Object.entries(changes).forEach(([ key, value ]) => {
		storageCache[areaName][key] = value.newValue;
	});
};

chrome.storage.onChanged.addListener(updateCache);

(() => {
	Object.keys(storageCache).forEach(async (areaName: StorageAreaName) => {
		const area = await chrome.storage[areaName].get();
		const areaChange: Record<string, chrome.storage.StorageChange> = {};
		Object.keys(area).forEach(key => {
			areaChange[key] = { oldValue: area[key], newValue: area[key] };
		});
		updateCache(areaChange, areaName);
	});
})();*/
