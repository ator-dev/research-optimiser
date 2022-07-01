type BrowserCommands = Array<browser.commands.Command>;
type FunctionCallControlsRefresh = (termsFromSelection?: boolean, disable?: boolean,
	termsUpdate?: MatchTerms, termUpdate?: MatchTerm, termToUpdateIdx?: number) => void;
type HighlightTags = Record<string, RegExp>;

enum ElementClass {
	HIGHLIGHTS_SHOWN = "highlights-shown",
	BAR_HIDDEN = "bar-hidden",
	CONTROL_EXPAND = "control-expand",
	CONTROL_BUTTON = "control-button",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
	FOCUS_CONTAINER = "focus-contain",
	FOCUS_REVERT = "focus-revert",
	REMOVE = "remove",
	MARKER_BLOCK = "marker-block",
	DISABLED = "disabled",
}

enum ElementID {
	STYLE = "style",
	BAR = "bar",
	MARKER_GUTTER = "markers",
}

enum CommandType {
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHT,
	TOGGLE_SELECT,
	ADVANCE_GLOBAL,
	SELECT_TERM,
}

enum TermChange {
	REMOVE = -1,
	CREATE = -2,
}

interface Command {
	type: CommandType
	termIdx?: number
	reversed?: boolean
}

interface SelectTermPtr {
	selectTerm: (command: string) => void
}

if (browser) {
	self["chrome" + ""] = browser;
}

const select = (element: ElementID | ElementClass, param?: string | number) =>
	[ "markmysearch", element, param ].join("-").slice(0, param ? undefined : -1)
;

const TERM_HUES: ReadonlyArray<number> = [ 60, 300, 110, 220, 0, 190, 30 ];

const jumpToTerm = (() => {
	const getContainerBlock = (highlightTags: HighlightTags, element: HTMLElement): HTMLElement =>
		highlightTags.flow.test(element.tagName) && element.parentElement
			? getContainerBlock(highlightTags, element.parentElement)
			: element
	;

	const isVisible = (element: HTMLElement) =>
		(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
		&& window.getComputedStyle(element).visibility !== "hidden"
	;

	return (highlightTags: HighlightTags, reverse: boolean, term?: MatchTerm) => {
		const termSelector = term ? select(ElementClass.TERM, term.selector) : null;
		const focusBase = document.body
			.getElementsByClassName(select(ElementClass.FOCUS))[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(select(ElementClass.FOCUS_CONTAINER))[0] as HTMLElement;
		const selection = document.getSelection();
		const anchor = selection && (!document.activeElement
			|| document.activeElement === document.body || !document.body.contains(document.activeElement)
			|| document.activeElement === focusBase || document.activeElement.contains(focusContainer))
			? selection.anchorNode
			: document.activeElement ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(select(ElementClass.FOCUS));
			purgeClass(select(ElementClass.FOCUS_CONTAINER));
			Array.from(document.body.getElementsByClassName(select(ElementClass.FOCUS_REVERT)))
				.forEach((element: HTMLElement) => {
					element.tabIndex = -1;
					element.classList.remove(select(ElementClass.FOCUS_REVERT));
				})
			;
		}
		const anchorContainer = anchor
			? getContainerBlock(highlightTags, anchor.nodeType === Node.ELEMENT_NODE || !anchor.parentElement
				? anchor as HTMLElement
				: anchor.parentElement)
			: undefined;
		const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.tagName === "MMS-H" && (termSelector ? element.classList.contains(termSelector) : true) && isVisible(element)
				&& getContainerBlock(highlightTags, element as HTMLElement) !== anchorContainer
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		walk.currentNode = anchor ? anchor : document.body;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walk[nextNodeMethod]() as HTMLElement;
		if (!elementTerm) {
			walk.currentNode = reverse && document.body.lastElementChild ? document.body.lastElementChild : document.body;
			elementTerm = walk[nextNodeMethod]() as HTMLElement;
			if (!elementTerm) {
				return;
			}
		}
		const container = getContainerBlock(highlightTags, elementTerm.parentElement as HTMLElement);
		container.classList.add(select(ElementClass.FOCUS_CONTAINER));
		elementTerm.classList.add(select(ElementClass.FOCUS));
		let elementToSelect = Array.from(container.getElementsByTagName("mms-h"))
			.every(thisElement => getContainerBlock(highlightTags, thisElement.parentElement as HTMLElement) === container)
			? container
			: elementTerm;
		if (elementToSelect.tabIndex === -1) {
			if (!this["browser"]) {
				(elementToSelect.parentElement as HTMLElement).focus({ preventScroll: true });
				if (document.activeElement === elementToSelect.parentElement) {
					elementToSelect = elementToSelect.parentElement as HTMLElement;
				}
			}
			elementToSelect.classList.add(select(ElementClass.FOCUS_REVERT));
			elementToSelect.tabIndex = 0;
		}
		elementToSelect.focus({ preventScroll: true });
		if (document.activeElement !== elementToSelect) {
			const element = document.createElement("div");
			element.tabIndex = 0;
			element.classList.add(select(ElementClass.REMOVE));
			elementToSelect.insertAdjacentElement(reverse ? "afterbegin" : "beforeend", element);
			elementToSelect = element;
			elementToSelect.focus({ preventScroll: true });
		}
		elementToSelect.scrollIntoView({ behavior: "smooth", block: "center" });
		if (selection)
			selection.setBaseAndExtent(elementToSelect, 0, elementToSelect, 0);
		Array.from(document.body.getElementsByClassName(select(ElementClass.REMOVE)))
			.forEach((element: HTMLElement) => {
				element.remove();
			})
		;
	};
})();

const createTermInput = (terms: MatchTerms, callRefreshTermControls: FunctionCallControlsRefresh,
	termButton: HTMLButtonElement, idx: number) => {
	const term = terms[idx];
	const replaces = idx !== TermChange.CREATE;
	const termInput = document.createElement("input");
	termInput.type = "text";
	termInput.disabled = true;
	termButton.appendChild(termInput);
	const show = (event: MouseEvent) => {
		event.preventDefault();
		termInput.value = replaces ? termButton.textContent as string : "";
		termButton.disabled = true;
		termInput.disabled = false;
		termInput.select();
	};
	const hide = () => {
		termInput.disabled = true;
		termButton.disabled = false;
	};
	const hideAndCommit = () => {
		if (termInput.disabled)
			return;
		hide();
		let message: BackgroundMessage | null = null;
		if (replaces) {
			if (termInput.value === "") {
				terms.splice(idx, 1);
				message = {
					terms,
					termChanged: term,
					termChangedIdx: TermChange.REMOVE,
				};
			} else if (termInput.value !== term.phrase) {
				term.phrase = termInput.value;
				term.compile();
				message = {
					terms,
					termChanged: term,
					termChangedIdx: idx,
				};
			}
		} else if (termInput.value !== "") {
			terms.push(new MatchTerm(termInput.value));
			message = {
				terms,
				termChanged: terms.at(-1),
				termChangedIdx: TermChange.CREATE,
			};
		}
		if (message) {
			callRefreshTermControls(false, false, message.terms, message.termChanged, message.termChangedIdx);
			browser.runtime.sendMessage(message);
		}
	};
	termButton.oncontextmenu = show;
	if (!replaces)
		termButton.onclick = show;
	termInput.onblur = hideAndCommit;
	termInput.onkeydown = event => event.key === "Enter" ? hideAndCommit() : event.key === "Escape" ? hide() : undefined;
};

const insertStyle = (terms: MatchTerms, style: HTMLStyleElement, hues: ReadonlyArray<number>) => {
	const zIndexMax = 2147483647;
	style.textContent = `
@keyframes flash { 0% { background-color: hsla(0, 0%, 65%, 0.8); } 100% {}; }
.${select(ElementClass.FOCUS_CONTAINER)} { animation-name: flash; animation-duration: 1s; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}:active:not(.${select(ElementClass.CONTROL_BUTTON)}:hover)
	+ .${select(ElementClass.OPTION_LIST)} { all: revert; position: absolute; top: 17px; left: -40px; z-index: 1; }
#${select(ElementID.BAR)} > button,
	#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)},
	#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}:hover,
	#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}:disabled,
	#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}.${select(ElementClass.DISABLED)} {
	all: revert; color: black; border-style: none; box-shadow: 1px 1px 5px; border-radius: 4px; }
#${select(ElementID.BAR)} > button { font-weight: bold; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}.${select(ElementClass.DISABLED)} {
	background-color: hsla(0, 0%, 80%, 0.6) !important; color: black; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)} > input,
	#${select(ElementID.BAR)} > button > input {
	all: revert; padding-block: 0; margin-left: 6px; border-style: none; width: 100px; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)} > input:disabled,
	#${select(ElementID.BAR)} > button > input:disabled { display: none; }
#${select(ElementID.BAR)} > div { all: revert; position: relative; display: inline-block; }
#${select(ElementID.BAR)} > button { background-color: hsl(0, 0%, 80%); }
#${select(ElementID.BAR)} > div, #${select(ElementID.BAR)} > button { margin-left: 8px; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)} { all: revert; position: relative; font-weight: bold;
	border: none; margin-left: 3px; width: 15px; height: 18px; background-color: transparent; color: white; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:hover,
	#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:active { color: transparent; }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION_LIST)} { all: revert; display: none; }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)} { all: revert; margin-left: 3px;
	border-style: none; border-bottom-style: solid; border-bottom-width: 1px; border-left-style: solid;
	border-color: hsl(0, 0%, 50%); background-color: hsl(0, 0%, 75%); }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)}:hover { background-color: hsl(0, 0%, 100%); }
#${select(ElementID.BAR)} > button:hover { background-color: hsl(0, 0%, 65%); }
#${select(ElementID.BAR)} > button:active { background-color: hsl(0, 0%, 50%); }
#${select(ElementID.BAR)} { all: revert; position: fixed; z-index: ${zIndexMax}; color-scheme: light;
	line-height: initial; font-size: 0; display: none; }
#${select(ElementID.BAR)}:not(.${select(ElementClass.BAR_HIDDEN)}) { display: inline; }
#${select(ElementID.MARKER_GUTTER)} { display: none; z-index: ${zIndexMax};
	right: 0; top: 0; width: 12px; height: 100%; margin-left: -4px; }
#${select(ElementID.MARKER_GUTTER)} div:not(.${select(ElementClass.MARKER_BLOCK)}) {
	width: 16px; height: 100%; top: 0; height: 1px; position: absolute; right: 0; }
#${select(ElementID.MARKER_GUTTER)}, .${select(ElementClass.MARKER_BLOCK)} {
	position: fixed; background-color: hsla(0, 0%, 0%, 0.5); }
.${select(ElementClass.MARKER_BLOCK)} { width: inherit; z-index: -1; }
/*#${/*select(ElementID.HIGHLIGHT_TOGGLE)*/""}:checked ~ */#${select(ElementID.MARKER_GUTTER)} { display: block; }`
	;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		style.textContent += `
#${select(ElementID.BAR)}.${select(ElementClass.HIGHLIGHTS_SHOWN)}
	~ body mms-h.${select(ElementClass.TERM, term.selector)} { background-color: hsla(${hue}, 100%, 60%, 0.4); }
#${select(ElementID.MARKER_GUTTER)} .${select(ElementClass.TERM, term.selector)} {
	background-color: hsl(${hue}, 100%, 50%); }
#${select(ElementID.BAR)} > .${select(ElementClass.TERM, term.selector)}
	> .${select(ElementClass.CONTROL_BUTTON)} { background-color: hsl(${hue}, 50%, 60%); }
#${select(ElementID.BAR)} > .${select(ElementClass.TERM, term.selector)}
	> .${select(ElementClass.CONTROL_BUTTON)}:hover { background-color: hsl(${hue}, 70%, 70%); }
#${select(ElementID.BAR)} > .${select(ElementClass.TERM, term.selector)}
	> .${select(ElementClass.CONTROL_BUTTON)}:active { background-color: hsl(${hue}, 70%, 50%); }
#${select(ElementID.BAR)}.${select(ElementClass.CONTROL_BUTTON, i)}
	> .${select(ElementClass.TERM, term.selector)} > .${select(ElementClass.CONTROL_BUTTON)} {
	background-color: hsl(${hue}, 100%, 85%); }`
		;
	});
};

const getTermControl = (term?: MatchTerm, idx = -1): HTMLDivElement => {
	const bar = document.getElementById(select(ElementID.BAR));
	if (!bar) {
		// TODO: recovery in order to end up retrieving the requested button anyway
		console.error("MARK MY SEARCH: Navigation bar not found on request.");
		return undefined as unknown as HTMLDivElement; // evil
	}
	return (idx === -1 && term
		? bar.getElementsByClassName(select(ElementClass.TERM, term.selector))[0]
		: bar.children[idx]
	) as HTMLDivElement;
};

const updateTermTooltip = (term: MatchTerm) => {
	const controlButton = getTermControl(term)
		.getElementsByClassName(select(ElementClass.CONTROL_BUTTON))[0] as HTMLButtonElement;
	const occurrenceCount = document.body.getElementsByClassName(select(ElementClass.TERM, term.selector)).length;
	controlButton.classList[occurrenceCount === 0 ? "add" : "remove"](select(ElementClass.DISABLED));
	// TODO: do not count parts of single matches individually
	controlButton.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
		!occurrenceCount || !term.command ? ""
			: occurrenceCount === 1 ? `\nJump to: ${term.command}, ${term.commandReverse}`
				: `\nJump to next: ${term.command}\nJump to previous: ${term.commandReverse}`}`;
};

const getTermOptionMatchType = (text: string, fromText = false) =>
	(fromText
		? text.substring(0, text.indexOf("\u00A0"))
		: text.slice(0, text.indexOf("\u00A0"))).toLocaleLowerCase()
;

const getTermOptionText = (term: MatchTerm, title: string, matchType: string) =>
	term.matchMode[matchType]
		? title.includes("✅") ? title : `${title}\u00A0✅`
		: title.includes("✅") ? title.slice(0, -2) : title
;

const refreshTermControl = (term: MatchTerm, idx: number) => {
	const control = getTermControl(undefined, idx);
	control.className = "";
	control.classList.add(select(ElementClass.TERM, term.selector));
	const button = control.getElementsByClassName(select(ElementClass.CONTROL_BUTTON))[0] as HTMLButtonElement;
	if (button.firstChild)
		button.firstChild.textContent = term.phrase;
	Array.from(control.getElementsByClassName(select(ElementClass.OPTION))).forEach((option) =>
		option.textContent = getTermOptionText(term, (option.textContent as string),
			getTermOptionMatchType(option.textContent as string, true)));
};

const addTermControl = (() => {
	const createTermOption = (terms: MatchTerms, callRefreshTermControls: FunctionCallControlsRefresh,
		idx: number, title: string) => {
		const matchType = getTermOptionMatchType(title);
		const onActivated = () => {
			const term = terms[idx];
			term.matchMode[matchType] = !term.matchMode[matchType];
			term.compile();
			const message: BackgroundMessage = {
				terms,
				termChanged: term,
				termChangedIdx: idx,
			};
			callRefreshTermControls(false, false, message.terms, message.termChanged, message.termChangedIdx);
			browser.runtime.sendMessage(message);
		};
		const option = document.createElement("button");
		option.classList.add(select(ElementClass.OPTION));
		option.tabIndex = -1;
		option.textContent = getTermOptionText(terms[idx], title, matchType);
		option.onmouseup = onActivated;
		return option;
	};

	return (highlightTags: HighlightTags, terms: MatchTerms, callRefreshTermControls: FunctionCallControlsRefresh,
		idx: number, command: string, commandReverse: string, buttonAppend?: HTMLButtonElement) => {
		const term = terms[idx];
		const controlButton = document.createElement("button");
		controlButton.classList.add(select(ElementClass.CONTROL_BUTTON));
		controlButton.classList.add(select(ElementClass.DISABLED));
		controlButton.tabIndex = -1;
		controlButton.textContent = term.phrase;
		controlButton.onclick = () => jumpToTerm(highlightTags, false, term);
		createTermInput(terms, callRefreshTermControls, controlButton, idx);
		term.command = command;
		term.commandReverse = commandReverse;
		const menu = document.createElement("menu");
		menu.classList.add(select(ElementClass.OPTION_LIST));
		menu.appendChild(createTermOption(terms, callRefreshTermControls, idx, "Case\u00A0Match"));
		menu.appendChild(createTermOption(terms, callRefreshTermControls, idx, "Stem\u00A0Word"));
		menu.appendChild(createTermOption(terms, callRefreshTermControls, idx, "Whole\u00A0Word"));
		const control = document.createElement("div");
		control.classList.add(select(ElementClass.TERM, term.selector));
		control.appendChild(controlButton);
		control.appendChild(menu);
		if (!buttonAppend) {
			buttonAppend = (document.getElementById(select(ElementID.BAR)) as HTMLDivElement)
				.lastElementChild as HTMLButtonElement;
		}
		buttonAppend.insertAdjacentElement("beforebegin", control);
	};
})();

const getTermCommands = (commands: BrowserCommands) => {
	const commandsDetail = commands
		.map(command => command.name ? ({ info: parseCommand(command.name), shortcut: command.shortcut ?? "" }) : null)
		.filter(command => !!command && !!command.info) as unknown as Array<{ info: Command, shortcut: string }>;
	return {
		down: commandsDetail
			.filter(commandDetail => commandDetail.info.type === CommandType.SELECT_TERM && !commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
		up: commandsDetail
			.filter(commandDetail => commandDetail.info.type === CommandType.SELECT_TERM && commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
	};
};

const addControls = (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
	callRefreshTermControls: FunctionCallControlsRefresh, style: HTMLStyleElement) => {
	insertStyle(terms, style, TERM_HUES);
	const bar = document.createElement("div");
	bar.id = select(ElementID.BAR);
	bar.classList.add(select(ElementClass.HIGHLIGHTS_SHOWN));
	const buttonAppend = document.createElement("button");
	buttonAppend.textContent = "+";
	buttonAppend.tabIndex = -1;
	createTermInput(terms, callRefreshTermControls, buttonAppend, TermChange.CREATE);
	bar.appendChild(buttonAppend);
	const termCommands = getTermCommands(commands);
	terms.forEach((term, i) => addTermControl(highlightTags, terms, callRefreshTermControls,
		i, termCommands.down[i], termCommands.up[i], buttonAppend));
	document.body.insertAdjacentElement("beforebegin", bar);
	const gutter = document.createElement("div");
	gutter.id = select(ElementID.MARKER_GUTTER);
	document.body.insertAdjacentElement("afterend", gutter);
};

const removeControls = () => {
	const style = document.getElementById(select(ElementID.STYLE));
	if (!style || style.textContent === "")
		return;
	style.textContent = "";
	const bar = document.getElementById(select(ElementID.BAR));
	const gutter = document.getElementById(select(ElementID.MARKER_GUTTER));
	if (bar)
		bar.remove();
	if (gutter)
		gutter.remove();
};

const addScrollMarkers = (() => {
	const getOffset = (element: HTMLElement, elementTop: HTMLElement) =>
		element && element !== elementTop && "offsetTop" in element
			? element.offsetTop + getOffset(element.offsetParent as HTMLElement, elementTop)
			: 0
	;

	const getScrollContainer = (element: HTMLElement): HTMLElement =>
		element.scrollHeight > element.clientHeight
		&& (document.scrollingElement === element
			|| [ "scroll", "auto" ].includes(window.getComputedStyle(element).overflowY)) || !element.parentElement
			? element
			: getScrollContainer(element.parentElement)
	;

	return (terms: MatchTerms) => {
		const gutter = document.getElementById(select(ElementID.MARKER_GUTTER));
		if (!gutter) {
			// TODO: recovery condition?
			return;
		}
		if (!document.scrollingElement)
			return;
		const containerPairs: Array<[Element, HTMLElement]> = [ [ document.scrollingElement, gutter ] ];
		terms.forEach(term =>
			Array.from(document.body.getElementsByClassName(select(ElementClass.TERM, term.selector))).forEach((highlight: Element) => {
				if (!("offsetTop" in highlight))
					return;
				const scrollContainer = getScrollContainer(highlight as HTMLElement);
				const containerPair = containerPairs.find(containerPair => containerPair[0] === scrollContainer);
				const block = containerPair ? containerPair[1] : document.createElement("div");
				if (!containerPair) {
					block.classList.add(select(ElementClass.MARKER_BLOCK));
					block.style.top = String(
						getOffset(scrollContainer, document.scrollingElement as HTMLElement)
							/ (document.scrollingElement as Element).scrollHeight * 100
					) + "%";
					//block.style.height = "15%";
					gutter.appendChild(block);
					containerPairs.push([ scrollContainer, block ]);
				}
				// TOOD: add overlap strategy, add update strategy, check calculations
				const marker = document.createElement("div");
				marker.classList.add(select(ElementClass.TERM, term.selector));
				marker.style.top = String(getOffset(highlight as HTMLElement, scrollContainer) / scrollContainer.scrollHeight * 100) + "%";
				block.appendChild(marker);
			})
		);
	};
})();

const highlightInNodes = (() => {
	interface UnbrokenNodeListItem {
		next?: UnbrokenNodeListItem
		value: Node
	}
	
	class UnbrokenNodeList {
		first?: UnbrokenNodeListItem;
		last?: UnbrokenNodeListItem;
	
		push (value: Node) {
			if (this.last) {
				this.last.next = { value };
				this.last = this.last.next;
			} else {
				this.first = { value };
				this.last = this.first;
			}
		}
	
		insertAfter (value?: Node, itemBefore?: UnbrokenNodeListItem | null) {
			if (value) {
				if (itemBefore) {
					const itemAfter = itemBefore.next;
					itemBefore.next = { value };
					itemBefore.next.next = itemAfter;
				} else {
					const itemAfter = this.first;
					this.first = { value };
					this.first.next = itemAfter;
				}
			}
		}
	
		getText () {
			let text = "";
			let current = this.first;
			do {
				text += (current as UnbrokenNodeListItem).value.textContent;
			// eslint-disable-next-line no-cond-assign
			} while (current = (current as UnbrokenNodeListItem).next);
			return text;
		}
	
		clear () {
			this.first = undefined;
			this.last = undefined; 
		}

		*[Symbol.iterator] () {
			let current = this.first;
			do {
				yield current as UnbrokenNodeListItem;
			// eslint-disable-next-line no-cond-assign
			} while (current = (current as UnbrokenNodeListItem).next);
		}
	}

	const highlightInNode = (wordRightPattern: RegExp, term: MatchTerm, textEndNode: Node, start: number, end: number) => {
		// TODO: add strategy for mitigating damage (caused by programmatic changes by the website).
		const text = textEndNode.textContent as string;
		start = Math.max(0, start);
		end = Math.min(text.length, end);
		const textStart = text.substring(0, start);
		const highlight = document.createElement("mms-h");
		highlight.classList.add(select(ElementClass.TERM, term.selector));
		highlight.textContent = text.substring(start, end);
		textEndNode.textContent = text.substring(end);
		(textEndNode.parentNode as Node).insertBefore(highlight, textEndNode);
		if (textStart !== "") {
			const textStartNode = document.createTextNode(textStart);
			(textEndNode.parentNode as Node).insertBefore(textStartNode, highlight);
			return textStartNode;
		}
	};

	const highlightInBlock = (wordRightPattern: RegExp, nodeItems: UnbrokenNodeList, terms: MatchTerms) => {
		for (const term of terms) {
			const textFlow = nodeItems.getText();
			const matches = textFlow.matchAll(term.pattern);
			let currentNodeStart = 0;
			let match: RegExpMatchArray = matches.next().value;
			let nodeItemPrevious: UnbrokenNodeListItem | null = null;
			for (const nodeItem of nodeItems) {
				const nextNodeStart = currentNodeStart + (nodeItem.value.textContent as string).length;
				while (match && match.index as number < nextNodeStart) {
					if (match.index as number + match[0].length >= currentNodeStart) {
						const textLengthOriginal = (nodeItem.value.textContent as string).length;
						nodeItems.insertAfter(
							highlightInNode(
								wordRightPattern,
								term,
								nodeItem.value,
								match.index as number - currentNodeStart, match.index as number - currentNodeStart + match[0].length),
							nodeItemPrevious);
						currentNodeStart += textLengthOriginal - (nodeItem.value.textContent as string).length;
						if ((match.index as number) + match[0].length > nextNodeStart) {
							break;
						}
					}
					match = matches.next().value;
				}
				currentNodeStart = nextNodeStart;
				nodeItemPrevious = nodeItem;
			}
		}
		nodeItems.clear();
	};

	return (rootNode: Node, highlightTags: HighlightTags, terms: MatchTerms) => {
		const wordRightPattern = /[^^]\b/;
		const nodeItems: UnbrokenNodeList = new UnbrokenNodeList;
		const breakLevels: Array<number> = [ 0 ];
		let level = 0;
		const walkerBreakHandler = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, { acceptNode: node => {
			switch (node.nodeType) {
			case (1): // NODE.ELEMENT_NODE
			case (11): { // NODE.DOCUMENT_FRAGMENT_NODE
				if (!highlightTags.reject.test((node as Element).tagName)) {
					if (!highlightTags.flow.test((node as Element).tagName)) {
						if (node.hasChildNodes())
							breakLevels.push(level);
						if (nodeItems.first)
							highlightInBlock(wordRightPattern, nodeItems, terms);
					}
					return 1; // NodeFilter.FILTER_ACCEPT
				}
				return 2; // NodeFilter.FILTER_REJECT
			} case (3): { // Node.TEXT_NODE
				if (level > (breakLevels.at(-1) as number))
					nodeItems.push(node);
				return 1; // NodeFilter.FILTER_ACCEPT
			}}
			return 2; // NodeFilter.FILTER_REJECT
		} });
		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, { acceptNode: node =>
			(node.nodeType === 1 || node.nodeType === 11) // Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
				? !highlightTags.reject.test((node as Element).tagName)
					? 1 : 2 // NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
				: node.nodeType === 3 // Node.TEXT_NODE
					? 1 : 2 // NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
		});
		let node: Node | null = walkerBreakHandler.currentNode;
		while (node) {
			level++; // Down to child level.
			node = walkerBreakHandler.firstChild();
			if (!node) {
				level--; // Up to sibling level.
				walker.currentNode = walkerBreakHandler.currentNode;
				node = walker.nextSibling();
				while (!node) {
					level--; // Up to parent level.
					walker.parentNode();
					walkerBreakHandler.currentNode = walker.currentNode;
					if (level === breakLevels.at(-1)) {
						breakLevels.pop();
						if (nodeItems.first)
							highlightInBlock(wordRightPattern, nodeItems, terms);
					}
					if (level <= 0)
						return;
					node = walker.nextSibling();
				}
				node = walkerBreakHandler.nextSibling();
			}
		}
	};
})();

const purgeClass = (className: string) =>
	Array.from(document.getElementsByClassName(className)).forEach(element => element.classList.remove(className))
;

const restoreNodes = () => {
	const highlights = document.body.getElementsByTagName("mms-h");
	if (!highlights.length)
		return;
	Array.from(highlights).forEach(element => {
		element.childNodes.forEach(childNode =>
			element.parentNode ? element.parentNode.insertBefore(childNode, element) : undefined
		);
		element.remove();
	});
	purgeClass(select(ElementClass.FOCUS));
	purgeClass(select(ElementClass.FOCUS_REVERT));
};

const getObserverNodeHighlighter = (() => {
	const canHighlightNode = (rejectSelector: string, node: Element): boolean =>
		!node.closest(rejectSelector)
	;

	return (highlightTags: HighlightTags, terms: MatchTerms) => {
		const rejectSelector = highlightTags.reject.source.slice(5, -3).split("|").join(", ");
		return new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					// Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
					if ((node.nodeType === 1 || node.nodeType === 11) && canHighlightNode(rejectSelector, node as Element)) {
						highlightInNodes(node, highlightTags, terms);
					}
				}
			}
			terms.forEach(term => updateTermTooltip(term));
		});
	};
})();

const highlightInNodesOnMutation = (observer: MutationObserver) =>
	observer.observe(document.body, {childList: true, subtree: true})
;

const insertHighlighting = (() => {
	const selectTermOnCommand = (highlightTags: HighlightTags, terms: MatchTerms, selectTermPtr: SelectTermPtr) => {
		let selectModeFocus = false;
		let focusedIdx = 0;
		selectTermPtr.selectTerm = (commandString: string) => {
			const getFocusedIdx = (idx: number) => Math.min(terms.length - 1, idx);
			focusedIdx = getFocusedIdx(focusedIdx);
			const commandInfo = parseCommand(commandString) as Command;
			switch (commandInfo.type) {
			case CommandType.TOGGLE_BAR: {
				const bar = document.getElementById(select(ElementID.BAR));
				if (!bar) {
					// TODO: recovery condition?
					return;
				}
				bar.classList[bar.classList.contains(select(ElementClass.BAR_HIDDEN))
					? "remove" : "add"](select(ElementClass.BAR_HIDDEN));
				break;
			} case CommandType.TOGGLE_HIGHLIGHT: {
				break;
			} case CommandType.TOGGLE_SELECT: {
				selectModeFocus = !selectModeFocus;
				break;
			} case CommandType.ADVANCE_GLOBAL: {
				if (selectModeFocus)
					jumpToTerm(highlightTags, commandInfo.reversed ?? false, terms[focusedIdx]);
				else
					jumpToTerm(highlightTags, commandInfo.reversed ?? false);
				break;
			} case CommandType.SELECT_TERM: {
				const bar = document.getElementById(select(ElementID.BAR));
				if (!bar) {
					// TODO: recovery condition?
					return;
				}
				bar.classList.remove(select(ElementClass.CONTROL_BUTTON, focusedIdx));
				focusedIdx = getFocusedIdx(commandInfo.termIdx as number);
				bar.classList.add(select(ElementClass.CONTROL_BUTTON, focusedIdx));
				if (!selectModeFocus)
					jumpToTerm(highlightTags, commandInfo.reversed as boolean, terms[focusedIdx]);
				break;
			}}
		};
	};

	return (highlightTags: HighlightTags, terms: MatchTerms, disable: boolean, termsFromSelection: boolean,
		selectTermPtr: SelectTermPtr, observer: MutationObserver) => {
		observer.disconnect();
		restoreNodes();
		if (disable) {
			removeControls();
			return;
		}
		if (termsFromSelection) {
			const selection = document.getSelection();
			if (!selection)
				return;
			terms = selection.toString().split(" ").map(phrase => phrase.replace(/\W/g, ""))
				.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
			selection.collapseToStart();
			browser.runtime.sendMessage({ terms, makeUnique: true } as BackgroundMessage);
			return;
		}
		selectTermOnCommand(highlightTags, terms, selectTermPtr);
		highlightInNodes(document.body, highlightTags, terms);
		terms.forEach(term => updateTermTooltip(term));
		highlightInNodesOnMutation(observer);
		addScrollMarkers(terms); // TODO: make dynamic
	};
})();

const parseCommand = (commandString: string): Command | null => {
	const parts = commandString.split("-");
	return parts[0] === "toggle"
		? parts[1] === "bar"
			? { type: CommandType.TOGGLE_BAR }
			: parts[1] === "highlight"
				? { type: CommandType.TOGGLE_HIGHLIGHT }
				: parts[1] === "select"
					? { type: CommandType.TOGGLE_SELECT } : null
		: parts[0] === "advance" && parts[1] === "global"
			? { type: CommandType.ADVANCE_GLOBAL, reversed: parts[2] === "reverse" }
			: parts[0] === "select" && parts[1] === "term"
				? { type: CommandType.SELECT_TERM, termIdx: Number(parts[2]), reversed: parts[3] === "reverse" } : null;
};

(() => {
	// TODO: configuration
	const refreshTermControls = (() => {
		const insertInterface = (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
			callRefreshTermControls: FunctionCallControlsRefresh, style: HTMLStyleElement) => {
			removeControls();
			addControls(highlightTags, commands, terms, callRefreshTermControls, style);
		};
	
		return (highlightTags: HighlightTags, terms: MatchTerms, commands: BrowserCommands, style: HTMLStyleElement,
			observer: MutationObserver, selectTermPtr: SelectTermPtr, callRefreshTermControls: FunctionCallControlsRefresh,
			disable: boolean, termsFromSelection: boolean,
			termsUpdate?: MatchTerms, termUpdate?: MatchTerm, termToUpdateIdx?: number) => {
			if (termToUpdateIdx !== undefined && termToUpdateIdx !== TermChange.REMOVE && termUpdate) {
				// 'message.disable' assumed false.
				if (termToUpdateIdx === TermChange.CREATE) {
					let idx = terms.length - 1;
					const termCommands = getTermCommands(commands);
					if (termUpdate !== terms[idx]) {
						terms.push(new MatchTerm(termUpdate.phrase, termUpdate.matchMode));
						idx++;
					}
					addTermControl(highlightTags, terms, callRefreshTermControls,
						idx, termCommands.down[idx], termCommands.up[idx]);
				} else {
					const term = terms[termToUpdateIdx];
					if (termUpdate !== term) {
						term.phrase = termUpdate.phrase;
						term.matchMode = termUpdate.matchMode;
						term.compile();
					}
					refreshTermControl(term, termToUpdateIdx);
				}
			} else if (termsUpdate) {
				// TODO: retain colours
				if (termsUpdate !== terms) { // If called from the same script, 'termsUpdate' is a shallow copy of 'terms' and is correct.
					terms.splice(0, terms.length);
					termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
				}
				insertInterface(highlightTags, commands, terms, callRefreshTermControls, style);
			} else if (!disable && !termsFromSelection) {
				return;
			}
			if (!disable) {
				insertStyle(terms, style, TERM_HUES);
			}
			setTimeout(() => insertHighlighting(highlightTags, terms, disable, termsFromSelection, selectTermPtr, observer));
		};
	})();

	const insertStyleElement = () => {
		let style = document.getElementById(select(ElementID.STYLE)) as HTMLStyleElement;
		if (!style) {
			style = style ? style : document.createElement("style");
			style.id = select(ElementID.STYLE);
			document.head.appendChild(style);
		}
		return style;
	};

	return (() => {
		const commands: BrowserCommands = [];
		const selectTermPtr: SelectTermPtr = { selectTerm: command => { command; } };
		const terms: MatchTerms = [];
		const highlightTags: HighlightTags = {
			reject: /\b(?:meta|style|script|noscript|mms-h)\b/i,
			skip: /\b(?:s|del)\b/i, // Implementation would likely be overly complex.
			flow: /\b(?:b|i|u|strong|em|cite|span|mark|wbr|code|data|dfn|ins|mms-h)\b/i,
		};
		const observer = getObserverNodeHighlighter(highlightTags, terms);
		const style = insertStyleElement();
		const callRefreshTermControls: FunctionCallControlsRefresh = (
			termsFromSelection = false, disable = false, termsUpdate, termUpdate, termToUpdateIdx
		) => // For highly responsive controls, but requires a few non-ideal special cases.
			refreshTermControls(highlightTags, terms, commands, style, observer, selectTermPtr,
				callRefreshTermControls, termsFromSelection, disable, termsUpdate, termUpdate, termToUpdateIdx);
		browser.runtime.onMessage.addListener((message: HighlightMessage, sender, sendResponse) => {
			if (message.extensionCommands) {
				commands.splice(0, commands.length);
				message.extensionCommands.forEach(command => commands.push(command));
			}
			if (message.command) {
				selectTermPtr.selectTerm(message.command);
			}
			if (message.disable || message.termUpdate || (message.terms &&
				(message.terms.length !== terms.length || message.terms.some((term, i) => term.phrase !== terms[i].phrase)))) {
				callRefreshTermControls(
					message.termsFromSelection, message.disable,
					message.terms, message.termUpdate, message.termToUpdateIdx
				);
			}
			sendResponse(); // Manifest V3 bug.
		});
	});
})()();
