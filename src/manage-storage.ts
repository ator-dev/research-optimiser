type ResearchInstances = Record<number, ResearchInstance>;
type Stoplist = Array<string>;
type Engines = Record<string, Engine>;
type StorageLocalValues = {
	[StorageLocal.ENABLED]?: boolean,
	[StorageLocal.RESEARCH_INSTANCES]?: ResearchInstances,
	[StorageLocal.ENGINES]?: Engines,
}
type StorageSyncValues = {
	[StorageSync.IS_SET_UP]?: boolean,
	[StorageSync.STOPLIST]?: Stoplist,
}

interface ResearchInstance {
	phrases: ReadonlyArray<string>
	terms: MatchTerms
}

enum StorageLocal {
	ENABLED = "enabled",
	RESEARCH_INSTANCES = "researchInstances",
	_ID_R_INSTANCES = "idResearchInstances",
    _TAB_R_INSTANCE_IDS = "tabResearchInstanceIds",
	ENGINES = "engines",
}

enum StorageSync {
	IS_SET_UP = "isSetUp",
	STOPLIST = "stoplist",
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageLocal = (items: StorageLocalValues) => {
	if (Object.keys(items).includes(StorageLocal.RESEARCH_INSTANCES)) {
		const tabRInstances = items[StorageLocal.RESEARCH_INSTANCES];
		const tabs = Object.keys(tabRInstances);
		const idRInstances = [];
		const tabRInstanceIds = {};
		delete(items[StorageLocal.RESEARCH_INSTANCES]);
		tabs.forEach(tab => {
			const id = idRInstances.indexOf(tabRInstances[tab]);
			if (id === -1) {
				tabRInstanceIds[tab] = idRInstances.length;
				idRInstances.push(tabRInstances[tab]);
			} else {
				tabRInstanceIds[tab] = id;
			}
		});
		items[StorageLocal._ID_R_INSTANCES] = idRInstances;
		items[StorageLocal._TAB_R_INSTANCE_IDS] = tabRInstanceIds;
	}
	return browser.storage.local.set(items);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageLocal = async (keysParam: string | Array<string>): Promise<StorageLocalValues> => {
	const keys = typeof(keysParam) === "string" ? [ keysParam ] : Array.from(new Set(keysParam));
	const gettingRInstances = keys.includes(StorageLocal.RESEARCH_INSTANCES);
	if (gettingRInstances) {
		keys.splice(keys.indexOf(StorageLocal.RESEARCH_INSTANCES), 1);
		keys.push(StorageLocal._ID_R_INSTANCES);
		keys.push(StorageLocal._TAB_R_INSTANCE_IDS);
	}
	const local = await browser.storage.local.get(keys);
	if (gettingRInstances) {
		const idRInstances = local[StorageLocal._ID_R_INSTANCES];
		const tabRInstanceIds = local[StorageLocal._TAB_R_INSTANCE_IDS];
		delete(local[StorageLocal._ID_R_INSTANCES]);
		delete(local[StorageLocal._TAB_R_INSTANCE_IDS]);
		const tabRInstances = {};
		Object.keys(tabRInstanceIds).forEach(tab => {
			tabRInstances[tab] = idRInstances[tabRInstanceIds[tab]];
		});
		local[StorageLocal.RESEARCH_INSTANCES] = tabRInstances;
	}
	if (local[StorageLocal.ENGINES]) {
		const engines = local[StorageLocal.ENGINES] as Engines;
		Object.keys(engines).forEach(id => engines[id] = Object.assign(new Engine, engines[id]));
	}
	return local;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const initStorageLocal = () => getStorageLocal(StorageLocal.ENABLED).then(local =>
	setStorageLocal({
		enabled: local.enabled === undefined ? true : local.enabled,
		researchInstances: {},
		engines: {}
	})
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageSync = (items: StorageSyncValues) => {
	return browser.storage.sync.set(items);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageSync = (keysParam: string | Array<string>): Promise<StorageSyncValues> => {
	return browser.storage.sync.get(keysParam);
};
