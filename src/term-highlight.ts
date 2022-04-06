class ElementSelect {
	#elements: Set<HTMLElement>;
	#length: number;
	#index: number;

	constructor(elements: Array<HTMLElement> = []) {
		this.#elements = new Set(elements);
		this.#length = elements.length;
		this.#index = -1;
	}

	isEmpty() {
		return this.#length === 0;
	}

	addElement(element: HTMLElement) {
		if (this.#elements.has(element)) return;
		this.#elements.add(element);
		this.#length += 1;
	}

	getCurrentElement() {
		this.#index %= this.#length;
		return Array.from(this.#elements)[this.#index];
	}

	nextElement(predicate = (element: HTMLElement) => !!element): HTMLElement {
		this.#index += 1;
		return predicate(this.getCurrentElement())
			? this.getCurrentElement()
			: this.nextElement(predicate)
		;
	}

	getElementCount(predicate = (element: HTMLElement) => !!element) {
		return Array.from(this.#elements).filter(predicate).length;
	}
}

enum ElementClass {
	ALL = "all",
	CONTROL = "control",
	CONTROL_EXPAND = "control-expand",
	CONTROL_BUTTON = "control-button",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
	MARKER_GUTTER = "markers",
}

enum ElementId {
	STYLE = "style",
	BAR = "bar",
	TOGGLE = "toggle",
}

const getSelector = (element: ElementId | ElementClass, term = "") =>
	["searchhighlight", element, term].join("-").slice(0, term === "" ? -1 : undefined)
;

const Z_INDEX_MAX = 2147483647;

const STYLE_MAIN = `
@keyframes flash { 0% { background-color: rgba(160,160,160,1); } 100% { background-color: rgba(160,160,160,0); }; }
.${getSelector(ElementClass.FOCUS)} { animation-name: flash; animation-duration: 1s; }
.${getSelector(ElementClass.CONTROL)} { all: revert; position: relative; display: inline; }
.${getSelector(ElementClass.CONTROL_EXPAND)} { all: revert; position: relative; display: inline; font-weight: bold; height: 19px;
	border: none; margin-left: 3px; width: 15px; background-color: transparent; color: white; }
.${getSelector(ElementClass.CONTROL_EXPAND)}:hover { all: revert; position: relative; display: inline; font-weight: bold; height: 19px;
	border: none; margin-left: 3px; width: 15px; background-color: rgb(210,210,210); color: transparent; }
.${getSelector(ElementClass.CONTROL_EXPAND)}:hover .${getSelector(ElementClass.OPTION_LIST)} { all: revert; position: absolute; display: inline;
	top: 5px; padding-left: inherit; left: -7px; }
.${getSelector(ElementClass.CONTROL_BUTTON)} { all: revert; display: inline; border-width: 2px; border-block-color: black; }
.${getSelector(ElementClass.CONTROL_BUTTON)}:hover { all: revert; display: inline; border-width: 2px; border-block-color: black; }
.${getSelector(ElementClass.CONTROL_BUTTON)}:disabled { all: revert; display: inline; color: #333; background-color: rgba(200,200,200,0.6);
	border-width: 2px; border-block-color: black; }
.${getSelector(ElementClass.OPTION_LIST)} { all: revert; display: none; }
.${getSelector(ElementClass.OPTION)} { all: revert; display: block; background-color: rgb(210,210,210);
	border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
.${getSelector(ElementClass.OPTION)}:hover { all: revert; display: block; background-color: rgb(150,150,150);
	border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
#${getSelector(ElementId.BAR)} { all: revert; position: fixed; z-index: ${Z_INDEX_MAX}; color-scheme: light;
	line-height: initial; left: 20px; }
#${getSelector(ElementId.TOGGLE)} { all: revert; position: fixed; z-index: ${Z_INDEX_MAX}; }
.${getSelector(ElementClass.CONTROL_BUTTON)} {
	all: revert; display: inline; border-width: 2px; border-block-color: black; }
.${getSelector(ElementClass.CONTROL_BUTTON)}:disabled {
	background-color: rgba(100,100,100,0.5) !important; }
.${getSelector(ElementClass.ALL)} {
	background-color: unset; color: unset; }
.${getSelector(ElementClass.MARKER_GUTTER)}, .${getSelector(ElementClass.MARKER_GUTTER)} > div {
	width: 16px; height: 1px; right: 0; position: fixed; z-index: ${Z_INDEX_MAX}; display: none; }
#${getSelector(ElementId.TOGGLE)}:checked ~ body .${getSelector(ElementClass.MARKER_GUTTER)},
	#${getSelector(ElementId.TOGGLE)}:checked ~ .${getSelector(ElementClass.MARKER_GUTTER)} {
	width: 12px; height: 100%; top: 0; display: block; background-color: rgba(0, 0, 0, 0.5); }
`; // TODO: focus/hover effect curation, combining hover/focus/normal rules [?]

const BUTTON_COLORS: ReadonlyArray<ReadonlyArray<number>> = [
	[255, 255, 0],
	[0, 255, 0],
	[0, 255, 255],
	[255, 0, 255],
	[255, 0, 0],
	[0, 0, 255],
];

const HIGHLIGHT_TAGS: Record<string, ReadonlyArray<string>> = {
	FLOW: ["B", "I", "U", "STRONG", "EM", "BR", "CITE", "SPAN", "MARK", "WBR", "CODE", "DATA", "DFN", "INS"],
	SKIP: ["S", "DEL"], // TODO: use
	REJECT: ["META", "STYLE", "SCRIPT", "NOSCRIPT"],
};

const termsToPattern = (terms: Array<string>) =>
	new RegExp(`(${terms.map(term => term.replace(/(.)/g,"$1(-|‐|‐)?")).join(")|(")})`, "gi")
;

const termToPredicate = (term: string) =>
	(element: HTMLElement) =>
		element && element.offsetParent !== null && element.textContent.match(termsToPattern([term])) !== null
;

const termFromMatch = (matchString: string) =>
	matchString.replace(/-|‐|‐/, "").toLowerCase()
;

const createTermOption = (title: string) => {
	const option = document.createElement("button");
	option.classList.add(getSelector(ElementClass.OPTION));
	option.textContent = title;
	return option;
};

const createTermControl = (focus: ElementSelect, style: HTMLStyleElement, term: string, COLOR: ReadonlyArray<number>) => {
	style.textContent += `
#${getSelector(ElementId.TOGGLE)}:checked ~ body .${getSelector(ElementClass.ALL)}.${getSelector(ElementClass.TERM, term)} {
	background-color: rgba(${COLOR.join(",")},0.4); }
#${getSelector(ElementId.TOGGLE)}:checked ~ body .${getSelector(ElementClass.MARKER_GUTTER)} > .${getSelector(ElementClass.TERM, term)},
	#${getSelector(ElementId.TOGGLE)}:checked ~ .${getSelector(ElementClass.MARKER_GUTTER)} > .${getSelector(ElementClass.TERM, term)} {
	background-color: rgb(${COLOR.join(",")}); display: block; }
.${getSelector(ElementClass.TERM, term)}.${getSelector(ElementClass.CONTROL_BUTTON)} {
	background-color: rgb(${COLOR.map(channel => channel ? channel : 140).join(",")}); }
.${getSelector(ElementClass.TERM, term)}.${getSelector(ElementClass.CONTROL_BUTTON)}:hover {
	background-color: rgb(${COLOR.map(channel => channel ? channel : 200).join(",")}); }
	`;
	const button = document.createElement("button");
	button.classList.add(getSelector(ElementClass.CONTROL_BUTTON));
	button.classList.add(getSelector(ElementClass.TERM, term));
	if (focus.getElementCount(termToPredicate(term)) === 0) {
		button.disabled = true;
	}
	button.textContent = term;
	button.title = focus.getElementCount(termToPredicate(term)).toString() + " [TODO: update tooltip]";
	button.onclick = () => {
		if (focus.isEmpty()) return;
		if (focus.getCurrentElement()) {
			focus.getCurrentElement().classList.remove(getSelector(ElementClass.FOCUS));
		}
		const element = focus.nextElement(termToPredicate(term));
		element.scrollIntoView({behavior: "smooth", block: "center"});
		element.classList.add(getSelector(ElementClass.FOCUS));
	};
	const menu = document.createElement("menu");
	menu.classList.add(getSelector(ElementClass.OPTION_LIST));
	menu.appendChild(createTermOption("Fuzzy"));
	menu.appendChild(createTermOption("Whole Word"));
	const expand = document.createElement("button");
	expand.classList.add(getSelector(ElementClass.CONTROL_EXPAND));
	expand.textContent = "⁝";
	expand.appendChild(menu);
	const div = document.createElement("div");
	div.classList.add(getSelector(ElementClass.CONTROL));
	div.appendChild(expand);
	div.appendChild(button);
	return div;
};

const addControls = (focus: ElementSelect, terms: Array<string>) => {
	const style = document.createElement("style");
	style.id = getSelector(ElementId.STYLE);
	style.textContent = STYLE_MAIN;
	document.head.appendChild(style);
	const bar = document.createElement("div");
	bar.id = getSelector(ElementId.BAR);
	const toggle = document.createElement("input");
	toggle.id = getSelector(ElementId.TOGGLE);
	toggle.type = "checkbox";
	toggle.checked = true;
	document.body.insertAdjacentElement("beforebegin", toggle);
	document.body.insertAdjacentElement("beforebegin", bar);
	for (let i = 0; i < terms.length; i++) {
		bar.appendChild(createTermControl(focus, style, terms[i], BUTTON_COLORS[i % BUTTON_COLORS.length]));
	}
};

const removeControls = () => {
	if (!document.getElementById(getSelector(ElementId.STYLE))) return;
	document.getElementById(getSelector(ElementId.BAR)).remove();
	document.getElementById(getSelector(ElementId.STYLE)).remove();
	Array.from(document.getElementsByClassName(getSelector(ElementClass.MARKER_GUTTER))).forEach(gutter =>
		gutter.remove());
};

/*const highlightInNodes = (focus: ElementSelect, nodes: Array<Node>, pattern: RegExp) => {
	...
	const buttons = Array.from(document.getElementsByClassName(getSelector(ElementClass.CONTROL_BUTTON)));
	terms.forEach(term => {
		const pattern = termsToPattern([term]);
		buttons.forEach((button: HTMLButtonElement) => {
			if (button.textContent.match(pattern)) {
				button.disabled = false;
			}
		});
	});
};*/

const getOffset = (element: HTMLElement, elementTop: HTMLElement) =>
	element && element !== elementTop && "offsetTop" in element
		? element.offsetTop + getOffset(element.offsetParent as HTMLElement, elementTop)
		: 0
;

const getScrollContainer = (element: Element): Element =>
	element.scrollHeight > element.clientHeight &&
	(document.scrollingElement === element || ["scroll", "auto"].indexOf(getComputedStyle(element).overflowY) >= 0)
		? element
		: getScrollContainer(element.parentElement)
;

const addScrollMarker = (gutter: HTMLElement, element: HTMLElement, term: string) => {
	const scrollContainer = gutter.parentElement;
	// TOOD: add overlap strategy, add update strategy, check calculations
	const marker = document.createElement("div");
	marker.classList.add(getSelector(ElementClass.TERM, term));
	marker.style.top = String(getOffset(element, scrollContainer) / scrollContainer.scrollHeight * 100) + "%";
	console.log(marker.style.top);
	gutter.appendChild(marker);
};

const addScrollMarkers = (terms: Array<string>) => {
	const containerPairs: Array<[Element, HTMLElement]> = [];
	terms.forEach(term =>
		Array.from(document.body.getElementsByClassName(getSelector(ElementClass.TERM, term))).forEach(mark => {
			if ("offsetTop" in mark) {
				const scrollContainer = getScrollContainer(mark);
				const containerPair = containerPairs.find(containerPair => containerPair[0] === scrollContainer);
				const gutter = containerPair ? containerPair[1] : document.createElement("div");
				if (!containerPair) {
					gutter.classList.add(getSelector(ElementClass.MARKER_GUTTER));
					scrollContainer.appendChild(gutter);
					containerPairs.push([scrollContainer, gutter]);
				}
				addScrollMarker(gutter, mark as HTMLElement, term);
			}
		})
	);
};

const highlightInNode = (textEnd: Node, start: number, end: number, term: string) => {
	// TODO: delete redundant nodes
	const textStart = document.createTextNode(textEnd.textContent.slice(0, start));
	const mark = document.createElement("mark");
	mark.classList.add(getSelector(ElementClass.ALL));
	mark.classList.add(getSelector(ElementClass.TERM, term));
	mark.textContent = textEnd.textContent.slice(start, end);
	textEnd.textContent = textEnd.textContent.slice(end);
	textEnd.parentNode.insertBefore(textStart, textEnd);
	textEnd.parentNode.insertBefore(mark, textEnd);
};

const breakIfAtBreakLevel = (unbrokenNodes: Array<Node>, pattern: RegExp) => {
	if (!unbrokenNodes.length) return;
	const matches = Array.from(unbrokenNodes.map(node => node.textContent).join("").matchAll(pattern));
	let start = 0;
	let i = 0;
	console.log(unbrokenNodes.map(node => node.textContent).join(""));
	unbrokenNodes.forEach((node, j) => {
		const length = node.textContent.length;
		let adjust = 0;
		matches.slice(i).every(match => {
			console.log(match);
			//console.log(start);
			//console.log(length);
			//console.log(adjust);
			if (match.index >= start + length) {
				return false;
			}
			//console.log(unbrokenNodes[j]);
			const originalLength = unbrokenNodes[j].textContent.length;
			highlightInNode(unbrokenNodes[j], -start + match.index + adjust, -start + match.index + match[0].length + adjust, termFromMatch(match[0]));
			adjust += unbrokenNodes[j].textContent.length - originalLength;
			if (match.index + match[0].length >= start + length) {
				return false;
			}
			i++;
			return true;
		});
		start += length;
	});
	unbrokenNodes.splice(0, unbrokenNodes.length);
};

const highlightInNodes = (rootNode: Node, pattern: RegExp) => {
	const unbrokenNodes: Array<Node> = [];
	const breakLevels: Array<number> = [0];
	let acceptAll = false;
	let level = 0;
	const walk = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {acceptNode: node => {
		if (acceptAll) {
			return NodeFilter.FILTER_ACCEPT;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			if (level > breakLevels.at(-1)) {
				unbrokenNodes.push(node);
			}
			return NodeFilter.FILTER_ACCEPT;
		}
		if (node.nodeType === Node.ELEMENT_NODE && !HIGHLIGHT_TAGS.REJECT.includes(node["tagName"])
			&& (typeof(node["className"]) !== "string" || !node["classList"].contains(getSelector(ElementClass.ALL)))) {
			if (!HIGHLIGHT_TAGS.FLOW.includes(node["tagName"]) && breakLevels.at(-1) !== level) {
				breakLevels.push(level);
				breakIfAtBreakLevel(unbrokenNodes, pattern);
			}
			return NodeFilter.FILTER_ACCEPT;
		}
		return NodeFilter.FILTER_REJECT;
	}});
	let node = walk.currentNode;
	while (node && (level > 0 || walk.currentNode === rootNode)) {
		level++;
		if (!walk.firstChild()) {
			level--;
			while (!walk.nextSibling() && !!node && level > 0) {
				if (level === breakLevels.at(-1)) {
					breakLevels.pop();
					breakIfAtBreakLevel(unbrokenNodes, pattern);
				}
				level--;
				acceptAll = true;
				node = walk.parentNode();
				acceptAll = false;
			}
		}
		node = walk.currentNode === node ? null : walk.currentNode;
	}
};

const highlightInNodesOnMutation = (pattern: RegExp) =>
	new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node =>
		highlightInNodes(node, pattern)
	))).observe(document.body, {childList: true, subtree: true})
;

// TODO: page position detection
// TODO: term editing (+ from user-highlighted text context menu)
// TODO: customization
// TODO: keyboard navigation
// TODO: search engine detection, including bookmarked

const receiveResearchDetails = (researchDetails: ResearchDetail) => {
	removeControls();
	if (!researchDetails.enabled) return;
	const focus = new ElementSelect;
	if (researchDetails.terms.length) {
		const pattern = termsToPattern(researchDetails.terms);
		highlightInNodes(document.body, pattern);
		highlightInNodesOnMutation(pattern);
		addScrollMarkers(researchDetails.terms);
	}
	addControls(focus, researchDetails.terms);
};

browser.runtime.onMessage.addListener(receiveResearchDetails);
