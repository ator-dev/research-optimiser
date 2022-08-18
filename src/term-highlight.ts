type BrowserCommands = Array<chrome.commands.Command>
type TagName = HTMLElementTagName | Uppercase<HTMLElementTagName>
type HighlightTags = {
	reject: Set<TagName>,
	flow: Set<TagName>,
}
type TermHues = ReadonlyArray<number>
type ControlButtonInfo = {
	path?: string
	label?: string
	containerId: ElementID
	onclick?: () => void
	setUp?: (container: HTMLElement) => void
}
type RequestRefreshIndicators = Generator<undefined, never, unknown>

enum AtRuleIdent {
	FLASH = "flash",
	MARKER_ON = "marker-on",
	MARKER_OFF = "marker-off",
}

enum ElementClass {
	HIGHLIGHTS_SHOWN = "highlights-shown",
	BAR_HIDDEN = "bar-hidden",
	CONTROL = "control",
	CONTROL_PAD = "control-pad",
	CONTROL_CONTENT = "control-content",
	CONTROL_EDIT = "control-edit",
	BAR_CONTROL = "bar-control",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
	FOCUS_CONTAINER = "focus-contain",
	FOCUS_REVERT = "focus-revert",
	REMOVE = "remove",
	DISABLED = "disabled",
	MATCH_CASE = "match-case",
	MATCH_STEM = "match-stem",
	MATCH_WHOLE = "match-whole",
	PRIMARY = "primary",
	SECONDARY = "secondary",
	ACTIVE = "active",
	OVERRIDE_VISIBILITY = "override-visibility",
}

enum ElementID {
	STYLE = "style",
	BAR = "bar",
	BAR_OPTIONS = "bar-options",
	BAR_TERMS = "bar-terms",
	BAR_CONTROLS = "bar-controls",
	MARKER_GUTTER = "markers",
}

enum TermChange {
	REMOVE = -1,
	CREATE = -2,
}

interface FnProcessCommand {
	call: (command: CommandInfo) => void
}

interface ControlsInfo {
	highlightsShown: boolean
	[StorageSync.BAR_CONTROLS_SHOWN]: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	[StorageSync.BAR_LOOK]: StorageSyncValues[StorageSync.BAR_LOOK]
}

interface UnbrokenNodeListItem {
	value: Text
	next: UnbrokenNodeListItem | null
}

// Singly linked list implementation for efficient highlight matching of node DOM 'flow' groups
class UnbrokenNodeList {
	first: UnbrokenNodeListItem | null;
	last: UnbrokenNodeListItem | null;

	push (value: Text) {
		if (this.last) {
			this.last.next = { value, next: null };
			this.last = this.last.next;
		} else {
			this.first = { value, next: null };
			this.last = this.first;
		}
	}

	insertAfter (itemBefore: UnbrokenNodeListItem | null, value: Text | null) {
		if (value) {
			if (itemBefore) {
				itemBefore.next = { next: itemBefore.next, value };
			} else {
				this.first = { next: this.first, value };
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
		this.first = null;
		this.last = null;
	}

	*[Symbol.iterator] () {
		let current = this.first;
		do {
			yield current as UnbrokenNodeListItem;
		// eslint-disable-next-line no-cond-assign
		} while (current = (current as UnbrokenNodeListItem).next);
	}
}

/**
 * Gets a selector for selecting by ID or class, or for CSS at-rules. Abbreviated due to prolific use.
 * __Always__ use for ID, class, and at-rule identifiers.
 * @param identifier The extension-level unique ID, class, or at-rule identifier.
 * @param argument An optional secondary component to the identifier.
 * @returns The selector string, being a constant selector prefix and both components joined by hyphens.
 */
const getSel = (identifier: ElementID | ElementClass | AtRuleIdent, argument?: string | number): string =>
	argument === undefined ? `markmysearch-${identifier}` : `markmysearch-${identifier}-${argument}`
;

/**
 * Fills a CSS stylesheet element to style all UI elements we insert.
 * @param terms Terms to account for and style.
 * @param style A style element to fill with the current style state.
 * @param hues An array of color hues for term styles to cycle through.
 */
const fillStylesheetContent = (terms: MatchTerms, style: HTMLStyleElement, hues: TermHues) => {
	const zIndexMax = 2147483647;
	style.textContent = `
/* TODO reorganise and rename */
/* TERM INPUT & BUTTONS */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} input
	{ width: 5em; padding: 0 2px 0 2px !important; margin-left: 4px; border: none !important; outline: revert;
	box-sizing: unset !important; font-family: revert !important; color: #000 !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled,
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus, .${getSel(ElementClass.ACTIVE)}),
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.BAR_CONTROL)} input:not(:focus),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} input:not(:focus, .${getSel(ElementClass.ACTIVE)})
	{ width: 0; padding: 0 !important; margin: 0; }
#${getSel(ElementID.BAR)}
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: none; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)},
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus)
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus, .${getSel(ElementClass.ACTIVE)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: block; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)},
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus)
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus, .${getSel(ElementClass.ACTIVE)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)}
	{ display: none; }
/**/

/* TERM MATCH MODES STYLE */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_CASE)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-top: 0 !important; border-top: 1px dashed black; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)})
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ text-decoration: underline; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_WHOLE)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-inline: 2px !important; border-inline: 2px solid hsl(0 0% 0% / 0.4); }
/**/

/* BAR */
#${getSel(ElementID.BAR)}
	{ all: revert; position: fixed; z-index: ${zIndexMax}; color-scheme: light; font-size: 14.6px; line-height: initial; user-select: none; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.BAR_HIDDEN)}
	{ display: none; }
#${getSel(ElementID.BAR)} *
	{ all: revert; font: revert; font-size: inherit; line-height: 120%; padding: 0; outline: none; }
#${getSel(ElementID.BAR)} img
	{ height: 1.1em; width: 1.1em; }
#${getSel(ElementID.BAR)} button
	{ display: flex; align-items: center; padding-inline: 4px; margin-block: 0; border: none; border-radius: inherit;
	background: none; color: #000 !important; cursor: initial; letter-spacing: normal; transition: unset; }
#${getSel(ElementID.BAR)} > *
	{ display: inline; }
#${getSel(ElementID.BAR)} > * > *
	{ display: inline-block; vertical-align: top; margin-left: 0.5em; }
/**/

/* TERM PULLDOWN */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}:active:not(:hover)
+ .${getSel(ElementClass.OPTION_LIST)}
	{ display: flex; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}
	{ position: absolute; flex-direction: column; top: 100%; width: max-content; padding: 0; margin: 0; z-index: 1; display: none; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}
	{ font-size: small; margin-left: 3px; background: hsl(0 0% 75%) !important; filter: grayscale(100%);
	width: 100%; text-align: left; color: #111 !important;
	border-color: hsl(0 0% 50%) !important; border-bottom-width: 1px !important;
	border-style: none none solid solid !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}:hover
	{ background: hsl(0 0% 90%) !important; }
/**/

/* BAR CONTROL PADS */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
	{ display: flex; height: 1.3em;
	background: hsl(0 0% 90% / 0.8) !important; color: #000 !important; border-style: none; border-radius: 4px; box-shadow: 1px 1px 5px; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:hover
	{ background: hsl(0 0% 65%) !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:active
	{ background: hsl(0 0% 50%) !important; }
#${getSel(ElementID.BAR)} > * > .${getSel(ElementClass.DISABLED)}
	{ display: none; }
#${getSel(ElementID.BAR)} #${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ display: flex; }
#${getSel(ElementID.BAR)} #${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ background: hsl(0 0% 80% / 0.6) !important; }
/**/

/* TERM SCROLL MARKERS */
@keyframes ${getSel(AtRuleIdent.MARKER_ON)}
	{ from {} to { padding-right: 16px; }; }
@keyframes ${getSel(AtRuleIdent.MARKER_OFF)}
	{ from { padding-right: 16px; } to { padding-right: 0; }; }
#${getSel(ElementID.MARKER_GUTTER)}
	{ display: block; position: fixed; right: 0; top: 0; width: 0; height: 100%; z-index: ${zIndexMax}; }
#${getSel(ElementID.MARKER_GUTTER)} *
	{ width: 16px; top: 0; height: 1px; position: absolute; right: 0; border-left: solid hsl(0 0% 0% / 0.6) 1px; box-sizing: unset;
	padding-right: 0; transition: padding-right 600ms; pointer-events: none; }
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.FOCUS)}
	{ padding-right: 16px; transition: unset; }
/**/

/* TERM HIGHLIGHTS */
@keyframes ${getSel(AtRuleIdent.FLASH)}
	{ from { background-color: hsl(0 0% 65% / 0.8); } to {}; }
.${getSel(ElementClass.FOCUS_CONTAINER)}
	{ animation: ${getSel(AtRuleIdent.FLASH)} 1s; }
/**/
	`;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		const isAboveStyleLevel = (level: number) => i >= hues.length * level;
		const getBackgroundStyle = (colorA: string, colorB: string) =>
			isAboveStyleLevel(1)
				?  `repeating-linear-gradient(${
					isAboveStyleLevel(3) ? isAboveStyleLevel(4) ? 0 : 90 : isAboveStyleLevel(2) ? 45 : -45
				}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`
				: colorA;
		style.textContent += `
/* TERM HIGHLIGHTS */
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
~ body mms-h.${getSel(ElementClass.TERM, term.selector)},
#${getSel(ElementID.BAR)}
~ body .${getSel(ElementClass.FOCUS_CONTAINER)} mms-h.${getSel(ElementClass.TERM, term.selector)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 84% / 0.4)`)} !important;
	border-radius: 2px !important; box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35) !important; }
/**/

/* TERM MARKERS */
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.TERM, term.selector)}
	{ background: hsl(${hue} 100% 44%); }
/**/

/* TERM BUTTONS */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 70% 70% / 0.8)`, `hsl(${hue} 70% 88% / 0.8)`)} !important; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_CONTENT)}:hover,
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_EDIT)}:hover:not(:disabled)
	{ background: hsl(${hue} 70% 80%) !important; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_CONTENT)}:active,
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_EDIT)}:active:not(:disabled)
	{ background: hsl(${hue} 70% 70%) !important; }
#${getSel(ElementID.BAR_TERMS)}.${getSel(ElementClass.CONTROL_PAD, i)}
.${getSel(ElementClass.TERM, term.selector)} .${getSel(ElementClass.CONTROL_PAD)}
	{ background: hsl(${hue} 100% 90%) !important; }
/**/
		`;
	});
};

const getContainerBlock = (highlightTags: HighlightTags, element: HTMLElement): HTMLElement =>
	highlightTags.flow.has(element.tagName as TagName) && element.parentElement
		? getContainerBlock(highlightTags, element.parentElement)
		: element
;

const jumpToTerm = (() => {
	const isVisible = (element: HTMLElement) => // TODO improve
		(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
		&& getComputedStyle(element).visibility !== "hidden"
	;

	return (highlightTags: HighlightTags, reverse: boolean, term?: MatchTerm) => {
		const termSelector = term ? getSel(ElementClass.TERM, term.selector) : "";
		const focusBase = document.body
			.getElementsByClassName(getSel(ElementClass.FOCUS))[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(getSel(ElementClass.FOCUS_CONTAINER))[0] as HTMLElement;
		const selection = document.getSelection();
		const selectionFocus = selection && (!document.activeElement
			|| document.activeElement === document.body || !document.body.contains(document.activeElement)
			|| document.activeElement === focusBase || document.activeElement.contains(focusContainer))
			? selection.focusNode
			: document.activeElement ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(getSel(ElementClass.FOCUS));
			purgeClass(getSel(ElementClass.FOCUS_CONTAINER));
			Array.from(document.body.getElementsByClassName(getSel(ElementClass.FOCUS_REVERT)))
				.forEach((element: HTMLElement) => {
					element.tabIndex = -1;
					element.classList.remove(getSel(ElementClass.FOCUS_REVERT));
				})
			;
		}
		const selectionFocusContainer = selectionFocus
			? getContainerBlock(highlightTags, selectionFocus.nodeType === Node.ELEMENT_NODE || !selectionFocus.parentElement
				? selectionFocus as HTMLElement
				: selectionFocus.parentElement)
			: undefined;
		const acceptInSelectionFocusContainer = { value: false };
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.tagName === "MMS-H"
			&& (termSelector ? element.classList.contains(termSelector) : true)
			&& isVisible(element)
			&& (getContainerBlock(highlightTags, element) !== selectionFocusContainer || acceptInSelectionFocusContainer.value)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		walker.currentNode = selectionFocus ? selectionFocus : document.body;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walker[nextNodeMethod]() as HTMLElement;
		if (!elementTerm) {
			walker.currentNode = reverse && document.body.lastElementChild ? document.body.lastElementChild : document.body;
			elementTerm = walker[nextNodeMethod]() as HTMLElement;
			if (!elementTerm) {
				acceptInSelectionFocusContainer.value = true;
				elementTerm = walker[nextNodeMethod]() as HTMLElement;
				if (!elementTerm) {
					return;
				}
			}
		}
		const container = getContainerBlock(highlightTags, elementTerm.parentElement as HTMLElement);
		container.classList.add(getSel(ElementClass.FOCUS_CONTAINER));
		elementTerm.classList.add(getSel(ElementClass.FOCUS));
		let elementToSelect = Array.from(container.getElementsByTagName("mms-h"))
			.every(thisElement => getContainerBlock(highlightTags, thisElement.parentElement as HTMLElement) === container)
			? container
			: elementTerm;
		if (elementToSelect.tabIndex === -1) {
			elementToSelect.classList.add(getSel(ElementClass.FOCUS_REVERT));
			elementToSelect.tabIndex = 0;
		}
		elementToSelect.focus({ preventScroll: true });
		if (document.activeElement !== elementToSelect) {
			const element = document.createElement("div");
			element.tabIndex = 0;
			element.classList.add(getSel(ElementClass.REMOVE));
			elementToSelect.insertAdjacentElement(reverse ? "afterbegin" : "beforeend", element);
			elementToSelect = element;
			elementToSelect.focus({ preventScroll: true });
		}
		elementToSelect.scrollIntoView({ behavior: "smooth", block: "center" });
		if (selection) {
			selection.setBaseAndExtent(elementToSelect, 0, elementToSelect, 0);
		}
		Array.from(document.body.getElementsByClassName(getSel(ElementClass.REMOVE)))
			.forEach((element: HTMLElement) => {
				element.remove();
			})
		;
		const scrollMarkerGutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		purgeClass(getSel(ElementClass.FOCUS), scrollMarkerGutter);
		// eslint-disable-next-line no-constant-condition
		[6, 5, 4, 3, 2].some(precisionFactor => {
			const precision = 10**precisionFactor;
			const scrollMarker = scrollMarkerGutter.querySelector(
				`${term ? `.${getSel(ElementClass.TERM, term.selector)}` : ""}[top^="${
					Math.trunc(getRectYRelative(container.getBoundingClientRect()) * precision) / precision
				}"]`
			) as HTMLElement | null;
			if (scrollMarker) {
				scrollMarker.classList.add(getSel(ElementClass.FOCUS));
				return true;
			}
			return false;
		});
	};
})();

const insertTermInput = (() => {
	const activateInput = (control: HTMLElement, shiftCaretRight?: boolean) => {
		const input = control.querySelector("input") as HTMLInputElement;
		input.select();
		if (shiftCaretRight !== undefined) {
			const caretPosition = shiftCaretRight ? 0 : -1;
			input.setSelectionRange(caretPosition, caretPosition);
		}
	};

	const commit = (term: MatchTerm | undefined, terms: MatchTerms) => {
		const replaces = !!term;
		const control = getControl(term) as HTMLElement;
		const termInput = control.querySelector("input") as HTMLInputElement;
		const inputValue = termInput.value;
		const idx = getTermIdx(term, terms);
		if (replaces && inputValue === "") {
			if (document.activeElement === termInput) {
				activateInput(getControl(undefined, idx + 1) as HTMLElement);
				return;
			}
			chrome.runtime.sendMessage({
				terms: terms.slice(0, idx).concat(terms.slice(idx + 1)),
				termChanged: term,
				termChangedIdx: TermChange.REMOVE,
			});
		} else if (replaces && inputValue !== term.phrase) {
			const termChanged = new MatchTerm(inputValue, term.matchMode);
			chrome.runtime.sendMessage({
				terms: terms.map((term, i) => i === idx ? termChanged : term),
				termChanged,
				termChangedIdx: idx,
			});
		} else if (!replaces && inputValue !== "") {
			const termChanged = new MatchTerm(inputValue);
			chrome.runtime.sendMessage({
				terms: terms.concat(termChanged),
				termChanged,
				termChangedIdx: TermChange.CREATE,
			});
		}
	};

	const shiftTermFocus = (term: MatchTerm | undefined, shiftRight: boolean, onBeforeShift: () => void, terms: MatchTerms) => {
		const replaces = !!term;
		const control = getControl(term) as HTMLElement;
		const termInput = control.querySelector("input") as HTMLInputElement;
		const idx = getTermIdx(term, terms);
		if (termInput.selectionStart !== termInput.selectionEnd
			|| termInput.selectionStart !== (shiftRight ? termInput.value.length : 0)) {
			return;
		}
		onBeforeShift();
		if (shiftRight && idx === terms.length - 1) {
			activateInput(getControlAppendTerm() as HTMLElement, shiftRight);
			return;
		} else if (shiftRight && !replaces) {
			commit(term, terms);
			termInput.value = "";
			return;
		} else if (!shiftRight && idx === 0) {
			commit(term, terms);
			if (termInput.value === "") {
				const focusingControlAppendTerm = terms.length === 1;
				const controlTarget = focusingControlAppendTerm
					? getControlAppendTerm() as HTMLElement
					: getControl(undefined, 1) as HTMLElement;
				activateInput(controlTarget, shiftRight);
			}
			return;
		}
		const controlTarget = getControl(undefined, replaces
			? shiftRight ? idx + 1 : idx - 1
			: terms.length - 1) as HTMLElement;
		activateInput(controlTarget, shiftRight);
	};

	return (terms: MatchTerms, controlPad: HTMLElement, idxCode: number,
		insertInput: (termInput: HTMLInputElement) => void) => {
		const controlContent = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement ?? controlPad;
		const controlEdit = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_EDIT))[0] as HTMLElement | undefined;
		const term = terms[idxCode] as MatchTerm | undefined;
		const replaces = idxCode !== TermChange.CREATE;
		const input = document.createElement("input");
		input.type = "text";
		input.classList.add(getSel(ElementClass.DISABLED));
		const resetInput = (termText = controlContent.textContent as string) => {
			input.value = replaces ? termText : "";
		};
		input.onfocus = () => {
			input.addEventListener("keyup", (event) => {
				if (event.key === "Tab") {
					selectInputFocused(input);
				}
			});
			input.classList.remove(getSel(ElementClass.DISABLED));
			resetInput();
			purgeClass(getSel(ElementClass.ACTIVE), document.getElementById(getSel(ElementID.BAR)) as HTMLElement);
			input.classList.add(getSel(ElementClass.ACTIVE));
		};
		input.onblur = () => {
			commit(term, terms);
			input.classList.add(getSel(ElementClass.DISABLED));
		};
		const show = (event: MouseEvent) => {
			event.preventDefault();
			input.select();
			selectInputFocused(input);
		};
		const hide = () => {
			input.blur();
		};
		if (controlEdit) {
			controlEdit.onclick = event => {
				if (!input.classList.contains(getSel(ElementClass.ACTIVE)) || getComputedStyle(input).width === "0") {
					show(event);
				} else {
					input.value = "";
					commit(term, terms);
					hide();
				}
			};
			controlEdit.oncontextmenu = event => {
				event.preventDefault();
				input.value = "";
				commit(term, terms);
				hide();
			};
			controlContent.oncontextmenu = show;
		} else if (!replaces) {
			const button = controlPad.querySelector("button") as HTMLButtonElement;
			button.onclick = show;
			button.oncontextmenu = show;
		}
		(new ResizeObserver(entries =>
			entries.forEach(entry => entry.contentRect.width === 0 ? hide() : undefined)
		)).observe(input);
		input.onkeydown = event => {
			if (event.key === "Enter") {
				if (event.shiftKey) {
					hide();
				} else {
					commit(term, terms);
					resetInput(input.value);
				}
			} else if (event.key === "Escape") {
				resetInput();
				hide();
			} else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				shiftTermFocus(term, event.key === "ArrowRight", () => event.preventDefault(), terms);
			}
		};
		insertInput(input);
		return input;
	};
})();

const getTermIdx = (term: MatchTerm | undefined, terms: MatchTerms) =>
	term ? terms.indexOf(term) : TermChange.CREATE
;

const getControl = (term?: MatchTerm, idx?: number): Element | null => {
	const barTerms = document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement;
	return (idx === undefined && term
		? barTerms.getElementsByClassName(getSel(ElementClass.TERM, term.selector))[0]
		: idx === undefined || idx >= barTerms.children.length
			? getControlAppendTerm()
			: Array.from(barTerms.children).at(idx ?? -1) ?? null
	);
};

const getControlAppendTerm = (): Element | null =>
	(document.getElementById(getSel(ElementID.BAR_CONTROLS)) as HTMLElement).firstElementChild
;

const selectInputFocused = (input: HTMLInputElement) =>
	input.setSelectionRange(0, input.value.length) // Mainly used to mitigate Chromium bug in which first focus does not select
;

const updateTermOccurringStatus = (term: MatchTerm) => {
	const controlPad = (getControl(term) as HTMLElement)
		.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
	const hasOccurrences = document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)).length != 0;
	controlPad.classList[hasOccurrences ? "remove" : "add"](getSel(ElementClass.DISABLED));
};

const updateTermTooltip = (() => {
	const getOccurrenceCount = (term: MatchTerm) => {
		const occurrences = Array.from(document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)));
		const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		return matches ? matches.length : 0;
	};

	return (term: MatchTerm) => {
		const controlPad = (getControl(term) as HTMLElement)
			.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
		const controlContent = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
		const occurrenceCount = getOccurrenceCount(term);
		controlContent.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
			!occurrenceCount || !term.command ? ""
				: occurrenceCount === 1 ? `\nJump to: ${term.command} or ${term.commandReverse}`
					: `\nJump to next: ${term.command}\nJump to previous: ${term.commandReverse}`
		}`;
	};
})();

const getTermOptionMatchType = (text: string, fromText = false) =>
	(fromText
		? text.substring(0, text.indexOf("\u00A0"))
		: text.slice(0, text.indexOf("\u00A0"))).toLowerCase()
;

const getTermOptionText = (optionIsActive: boolean, title: string) =>
	optionIsActive
		? title.includes("🗹") ? title : `${title}\u00A0🗹`
		: title.includes("🗹") ? title.slice(0, -2) : title
;

const updateTermMatchModeClassList = (mode: MatchMode, classList: DOMTokenList) => {
	classList[mode.case ? "add" : "remove"](getSel(ElementClass.MATCH_CASE));
	classList[mode.stem ? "add" : "remove"](getSel(ElementClass.MATCH_STEM));
	classList[mode.whole ? "add" : "remove"](getSel(ElementClass.MATCH_WHOLE));
};

const refreshTermControl = (highlightTags: HighlightTags, term: MatchTerm, idx: number) => {
	const control = getControl(undefined, idx) as HTMLElement;
	control.className = "";
	control.classList.add(getSel(ElementClass.CONTROL));
	control.classList.add(getSel(ElementClass.TERM, term.selector));
	updateTermMatchModeClassList(term.matchMode, control.classList);
	const controlContent = control.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
	controlContent.onclick = () => jumpToTerm(highlightTags, false, term);
	controlContent.textContent = term.phrase;
	Array.from(control.getElementsByClassName(getSel(ElementClass.OPTION))).forEach(option =>
		option.textContent = getTermOptionText(
			term.matchMode[getTermOptionMatchType(option.textContent as string, true)],
			option.textContent as string,
		),
	);
};

const removeTermControl = (idx: number) => {
	(getControl(undefined, idx) as HTMLElement).remove();
};

const insertTermControl = (() => {
	const createTermOption = (terms: MatchTerms, term: MatchTerm, title: string) => {
		const matchType = getTermOptionMatchType(title);
		const onActivated = () => {
			const termUpdate = Object.assign({}, term);
			termUpdate.matchMode = Object.assign({}, termUpdate.matchMode);
			termUpdate.matchMode[matchType] = !termUpdate.matchMode[matchType];
			chrome.runtime.sendMessage({
				terms: terms.map(termCurrent => termCurrent === term ? termUpdate : termCurrent),
				termChanged: termUpdate,
				termChangedIdx: getTermIdx(term, terms),
			});
		};
		const option = document.createElement("button");
		option.type = "button";
		option.classList.add(getSel(ElementClass.OPTION));
		option.tabIndex = -1;
		option.textContent = getTermOptionText(term.matchMode[matchType], title);
		option.onmouseup = onActivated;
		return option;
	};

	return (highlightTags: HighlightTags, terms: MatchTerms, idx: number, command: string, commandReverse: string,
		controlsInfo: ControlsInfo) => {
		const term = terms.at(idx) as MatchTerm;
		const controlPad = document.createElement("span");
		controlPad.classList.add(getSel(ElementClass.CONTROL_PAD));
		controlPad.classList.add(getSel(ElementClass.DISABLED));
		controlPad.tabIndex = -1;
		const controlContent = document.createElement("button");
		controlContent.type = "button";
		controlContent.classList.add(getSel(ElementClass.CONTROL_CONTENT));
		controlContent.tabIndex = -1;
		controlContent.textContent = term.phrase;
		controlContent.onclick = () => jumpToTerm(highlightTags, false, term);
		controlPad.appendChild(controlContent);
		const controlEdit = document.createElement("button");
		controlEdit.type = "button";
		controlEdit.classList.add(getSel(ElementClass.CONTROL_EDIT));
		if (!controlsInfo.barLook.showEditIcon) {
			controlEdit.disabled = true;
		}
		controlEdit.tabIndex = -1;
		const controlEditChange = document.createElement("img");
		const controlEditRemove = document.createElement("img");
		controlEditChange.src = chrome.runtime.getURL("/icons/edit.svg");
		controlEditRemove.src = chrome.runtime.getURL("/icons/delete.svg");
		controlEditChange.classList.add(getSel(ElementClass.PRIMARY));
		controlEditRemove.classList.add(getSel(ElementClass.SECONDARY));
		controlEdit.appendChild(controlEditChange);
		controlEdit.appendChild(controlEditRemove);
		controlPad.appendChild(controlEdit);
		insertTermInput(terms, controlPad, idx, input => controlPad.insertBefore(input, controlEdit));
		term.command = command;
		term.commandReverse = commandReverse;
		const menu = document.createElement("menu");
		menu.classList.add(getSel(ElementClass.OPTION_LIST));
		menu.appendChild(createTermOption(terms, term, "Case\u00A0Sensitive"));
		menu.appendChild(createTermOption(terms, term, "Stem\u00A0Word"));
		menu.appendChild(createTermOption(terms, term, "Whole\u00A0Word"));
		const control = document.createElement("span");
		control.classList.add(getSel(ElementClass.CONTROL));
		control.classList.add(getSel(ElementClass.TERM, term.selector));
		control.appendChild(controlPad);
		control.appendChild(menu);
		updateTermMatchModeClassList(term.matchMode, control.classList);
		(document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement).appendChild(control);
	};
})();

const getTermCommands = (commands: BrowserCommands) => {
	const commandsDetail = commands.map(command => ({
		info: command.name ? parseCommand(command.name) : { type: CommandType.NONE },
		shortcut: command.shortcut ?? "",
	}));
	return {
		down: commandsDetail
			.filter(commandDetail =>
				commandDetail.info.type === CommandType.SELECT_TERM && !commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
		up: commandsDetail
			.filter(commandDetail =>
				commandDetail.info.type === CommandType.SELECT_TERM && commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
	};
};

const addControls = (() => {
	const createButton = (() => {
		const create = (id: BarControl, info: ControlButtonInfo, hideWhenInactive: boolean) => {
			const container = document.createElement("span"); // TODO find how vscode knows the type produced by the argument
			container.classList.add(getSel(ElementClass.BAR_CONTROL)); // TODO redundant, use CSS to select class containing this
			container.classList.add(getSel(ElementClass.BAR_CONTROL, id));
			container.tabIndex = -1;
			const pad = document.createElement("span");
			pad.classList.add(getSel(ElementClass.CONTROL_PAD));
			pad.tabIndex = -1;
			const button = document.createElement("button");
			button.type = "button";
			button.tabIndex = -1;
			if (info.path) {
				const image = document.createElement("img");
				image.src = chrome.runtime.getURL(info.path);
				button.appendChild(image);
			}
			if (info.label) {
				const text = document.createElement("span");
				text.tabIndex = -1;
				text.textContent = info.label;
				button.appendChild(text);
			}
			pad.appendChild(button);
			container.appendChild(pad);
			if (hideWhenInactive) {
				container.classList.add(getSel(ElementClass.DISABLED));
			}
			button.onclick = info.onclick ?? null;
			if (info.setUp) {
				info.setUp(container);
			}
			(document.getElementById(getSel(info.containerId)) as HTMLElement).appendChild(container);
		};

		return (terms: MatchTerms, barControl: BarControl, hideWhenInactive: boolean) =>
			create(barControl, ({
				disableTabResearch: {
					path: "/icons/close.svg",
					containerId: ElementID.BAR_OPTIONS,	
					onclick: () => chrome.runtime.sendMessage({
						disableTabResearch: true,
					} as BackgroundMessage),
				},
				performSearch: {
					path: "/icons/search.svg",
					containerId: ElementID.BAR_OPTIONS,
					onclick: () => chrome.runtime.sendMessage({
						performSearch: true,
					} as BackgroundMessage),
				},
				appendTerm: {
					path: "/icons/create.svg",
					containerId: ElementID.BAR_CONTROLS,
					setUp: container => {
						const pad = container.querySelector(`.${getSel(ElementClass.CONTROL_PAD)}`) as HTMLElement;
						insertTermInput(terms, pad, TermChange.CREATE, input => pad.appendChild(input));
					},
				},
			} as Record<BarControl, ControlButtonInfo>)[barControl], hideWhenInactive)
		;
	})();

	return (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
		style: HTMLStyleElement, controlsInfo: ControlsInfo, hues: TermHues) => {
		fillStylesheetContent(terms, style, hues);
		const bar = document.createElement("div");
		bar.id = getSel(ElementID.BAR);
		bar.ondragstart = event => event.preventDefault();
		bar.onmouseenter = () => {
			purgeClass(getSel(ElementClass.ACTIVE), bar);
			const controlInput = document.activeElement;
			if (controlInput && controlInput.tagName === "INPUT"
				&& controlInput.closest(`#${getSel(ElementID.BAR)}`)) {
				controlInput.classList.add(getSel(ElementClass.ACTIVE));
			}
		};
		bar.onmouseleave = bar.onmouseenter;
		if (controlsInfo.highlightsShown) {
			bar.classList.add(getSel(ElementClass.HIGHLIGHTS_SHOWN));
		}
		const barOptions = document.createElement("span");
		barOptions.id = getSel(ElementID.BAR_OPTIONS);
		const barTerms = document.createElement("span");
		barTerms.id = getSel(ElementID.BAR_TERMS);
		const barControls = document.createElement("span");
		barControls.id = getSel(ElementID.BAR_CONTROLS);
		bar.appendChild(barOptions);
		bar.appendChild(barTerms);
		bar.appendChild(barControls);
		document.body.insertAdjacentElement("beforebegin", bar);
		Object.keys(controlsInfo.barControlsShown).forEach((barControl: BarControl) =>
			createButton(terms, barControl, !controlsInfo.barControlsShown[barControl]));
		const termCommands = getTermCommands(commands);
		terms.forEach((term, i) => insertTermControl(highlightTags, terms, i, termCommands.down[i], termCommands.up[i],
			controlsInfo));
		const gutter = document.createElement("div");
		gutter.id = getSel(ElementID.MARKER_GUTTER);
		document.body.insertAdjacentElement("afterend", gutter);
	};
})();

/**
 * Empty the custom stylesheet, and remove the control bar and marker gutter.
 */
const removeControls = () => {
	const style = document.getElementById(getSel(ElementID.STYLE));
	if (!style || style.textContent === "") {
		return;
	}
	style.textContent = "";
	const bar = document.getElementById(getSel(ElementID.BAR));
	const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER));
	if (bar) {
		bar.remove();
	}
	if (gutter) {
		gutter.remove();
	}
};

const getRectYRelative = (rect: DOMRect) =>
	(rect.y + document.documentElement.scrollTop) / document.documentElement.scrollHeight
;

const insertScrollMarkers = (() => {
	const getTermSelector = (highlightClassName: string) =>
		highlightClassName.slice(getSel(ElementClass.TERM).length + 1)
	;

	return (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) => {
		const regexMatchTermSelector = new RegExp(`\\b${getSel(ElementClass.TERM)}(?:-\\w+)+\\b`);
		const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		const containersInfo: Array<{
			container: HTMLElement,
			termsAdded: Set<string>,
		}> = [];
		if (terms.length === 0) {
			return; // No terms results in an empty selector, which is not allowed
		}
		let markersHtml = "";
		document.body.querySelectorAll(terms
			.slice(0, hues.length) // The scroll markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms
			.map(term => `mms-h.${getSel(ElementClass.TERM, term.selector)}`)
			.join(", ")
		).forEach((highlight: HTMLElement) => {
			const container = getContainerBlock(highlightTags, highlight);
			const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
			const className = (highlight.className.match(regexMatchTermSelector) as RegExpMatchArray)[0];
			const yRelative = getRectYRelative(container.getBoundingClientRect());
			let markerCss = `top: ${yRelative * 100}%;`;
			if (containerIdx !== -1) {
				if (containersInfo[containerIdx].container === container) {
					if (containersInfo[containerIdx].termsAdded.has(getTermSelector(className))) {
						return;
					} else {
						const termsAddedCount = Array.from(containersInfo[containerIdx].termsAdded).length;
						markerCss += `padding-left: ${termsAddedCount * 5}px; z-index: ${termsAddedCount * -1}`;
						containersInfo[containerIdx].termsAdded.add(getTermSelector(className));
					}
				} else {
					containersInfo.splice(containerIdx);
					containersInfo.push({ container, termsAdded: new Set([ getTermSelector(className) ]) });
				}
			} else {
				containersInfo.push({ container, termsAdded: new Set([ getTermSelector(className) ]) });
			}
			markersHtml += `<div class="${className}" top="${yRelative}" style="${markerCss}"></div>`;
		});
		// Generates and inserts HTML directly in order to increase performance, rather than appending individual elements.
		gutter.insertAdjacentHTML("afterbegin", markersHtml);
	};
})();

/**
 * Finds and highlights occurrences of terms, then marks their positions in the scrollbar.
 * @param terms Terms to find, highlight, and mark.
 * @param rootNode A node under which to find and highlight term occurrences.
 * @param highlightTags Element tags to reject from highlighting or break up blocks of consecutive text nodes.
 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators are regenerated.
 */
const generateTermHighlightsUnderNode = (() => {
	/**
	 * Highlights a term matched in a text node.
	 * @param term The term matched.
	 * @param textEndNode The text node to highlight inside.
	 * @param start The first character index of the match within the text node.
	 * @param end The last character index of the match within the text node.
	 * @param nodeItems The singly linked list of consecutive text nodes being internally highlighted.
	 * @param nodeItemPrevious The previous item in the text node list.
	 * @returns The new previous item (the item just highlighted).
	 */
	const highlightInsideNode = (term: MatchTerm, textEndNode: Node, start: number, end: number,
		nodeItems: UnbrokenNodeList, nodeItemPrevious: UnbrokenNodeListItem | null): UnbrokenNodeListItem => {
		// TODO add strategy for mitigating damage (caused by programmatic changes by the website)
		const text = textEndNode.textContent as string;
		const textStart = text.substring(0, start);
		const highlight = document.createElement("mms-h");
		highlight.classList.add(getSel(ElementClass.TERM, term.selector));
		highlight.textContent = text.substring(start, end);
		textEndNode.textContent = text.substring(end);
		(textEndNode.parentNode as Node).insertBefore(highlight, textEndNode);
		nodeItems.insertAfter(nodeItemPrevious, highlight.firstChild as Text);
		if (textStart !== "") {
			const textStartNode = document.createTextNode(textStart);
			(highlight.parentNode as Node).insertBefore(textStartNode, highlight);
			nodeItems.insertAfter(nodeItemPrevious, textStartNode);
			return ((nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as UnbrokenNodeListItem)
				.next as UnbrokenNodeListItem;
		}
		return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as UnbrokenNodeListItem;
	};

	/**
	 * Highlights terms in a block of consecutive text nodes.
	 * @param terms Terms to find and highlight.
	 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
	 */
	const highlightInBlock = (terms: MatchTerms, nodeItems: UnbrokenNodeList) => {
		const textFlow = nodeItems.getText();
		for (const term of terms) {
			let nodeItemPrevious: UnbrokenNodeListItem | null = null;
			let nodeItem: UnbrokenNodeListItem | null = nodeItems.first as UnbrokenNodeListItem;
			let textStart = 0;
			let textEnd = nodeItem.value.length;
			const matches = textFlow.matchAll(term.pattern);
			for (const match of matches) {
				let highlightStart = match.index as number;
				const highlightEnd = highlightStart + match[0].length;
				while (textEnd <= highlightStart) {
					nodeItemPrevious = nodeItem;
					nodeItem = nodeItem.next as UnbrokenNodeListItem;
					textStart = textEnd;
					textEnd += nodeItem.value.length;
				}
				for (;;) {
					nodeItemPrevious = highlightInsideNode(
						term,
						nodeItem.value,
						highlightStart - textStart,
						Math.min(highlightEnd - textStart, textEnd),
						nodeItems,
						nodeItemPrevious,
					);
					highlightStart = textEnd;
					textStart = highlightEnd;
					if (highlightEnd <= textEnd) {
						break;
					}
					nodeItemPrevious = nodeItem;
					nodeItem = nodeItem.next as UnbrokenNodeListItem;
					textStart = textEnd;
					textEnd += nodeItem.value.length;
				}
			}
		}
	};

	/**
	 * Highlights occurrences of terms in text nodes under a node in the DOM tree.
	 * @param node A node under which to match terms and insert highlights.
	 * @param highlightTags Element tags to reject from highlighting or break up blocks of consecutive text nodes.
	 * @param terms Terms to find and highlight.
	 */
	const insertHighlights = (terms: MatchTerms, node: Node, highlightTags: HighlightTags,
		nodeItems = new UnbrokenNodeList, visitSiblings = true) => {
		// TODO support for <iframe>?
		do {
			switch (node.nodeType) {
			case (1): // Node.ELEMENT_NODE
			case (11): { // Node.DOCUMENT_FRAGMENT_NODE
				if (!highlightTags.reject.has((node as Element).tagName as TagName)) {
					const breaksFlow = !highlightTags.flow.has((node as Element).tagName as TagName);
					if (breaksFlow && nodeItems.first) {
						highlightInBlock(terms, nodeItems);
						nodeItems.clear();
					}
					if (node.firstChild) {
						insertHighlights(terms, node.firstChild, highlightTags, nodeItems);
						if (breaksFlow && nodeItems.first) {
							highlightInBlock(terms, nodeItems);
							nodeItems.clear();
						}
					}
				}
				break;
			} case (3): { // Node.TEXT_NODE
				nodeItems.push(node as Text);
				break;
			}}
			node = node.nextSibling as ChildNode; // May be null (checked by loop condition)
		} while (node && visitSiblings);
	};

	return (terms: MatchTerms, rootNode: Node,
		highlightTags: HighlightTags, requestRefreshIndicators: RequestRefreshIndicators) => {
		if (rootNode.nodeType === Node.TEXT_NODE) {
			const nodeItems = new UnbrokenNodeList;
			nodeItems.push(rootNode as Text);
			highlightInBlock(terms, nodeItems);
		} else {
			insertHighlights(terms, rootNode, highlightTags, new UnbrokenNodeList, false);
		}
		requestRefreshIndicators.next();
	};
})();

/**
 * Remove all uses of a class name in elements under a root node in the DOM tree.
 * @param className A class name to purge.
 * @param root A root node under which to purge the class (non-inclusive).
 */
const purgeClass = (className: string, root: HTMLElement = document.body) =>
	Array.from(root.getElementsByClassName(className)).forEach(element => element.classList.remove(className))
;

/**
 * Revert all direct changes to the DOM tree introduced by the extension, under a root node. Circumstantial and non-direct
 * alterations may remain.
 * @param classNames Class names of the highlights to remove. If left empty, all highlights are removed.
 * @param root A root node under which to remove highlights.
 */
const restoreNodes = (classNames: Array<string> = [], root: HTMLElement | DocumentFragment = document.body) => {
	const highlights = root.querySelectorAll(classNames.length ? `mms-h.${classNames.join(", mms-h.")}` : "mms-h");
	for (const highlight of Array.from(highlights)) {
		// Direct assignation to `outerHTML` prevents the mutation observer from triggering excess highlighting
		highlight.outerHTML = highlight.innerHTML;
	}
	if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
		root = (root as DocumentFragment).getRootNode() as HTMLElement;
		if (root.nodeType === Node.TEXT_NODE) {
			return;
		}
	}
	purgeClass(getSel(ElementClass.FOCUS), root as HTMLElement);
	purgeClass(getSel(ElementClass.FOCUS_REVERT), root as HTMLElement);
};

const getObserverNodeHighlighter = (() => {
	const canHighlightNode = (rejectSelector: string, node: Element): boolean =>
		!node.closest(rejectSelector) && node.tagName !== "MMS-H"
	;

	return (requestRefreshIndicators: RequestRefreshIndicators, highlightTags: HighlightTags, terms: MatchTerms) => {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		return new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					// Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
					if ((node.nodeType === 1 || node.nodeType === 11) && canHighlightNode(rejectSelector, node as Element)) {
						restoreNodes([], node as HTMLElement | DocumentFragment);
						generateTermHighlightsUnderNode(terms, node, highlightTags, requestRefreshIndicators);
					}
				}
			}
			terms.forEach(term => updateTermOccurringStatus(term));
		});
	};
})();

const highlightInNodesOnMutation = (observer: MutationObserver) =>
	observer.observe(document.body, {childList: true, subtree: true})
;

const beginHighlighting = (() => {
	const selectTermOnCommand = (highlightTags: HighlightTags, terms: MatchTerms,
		processCommand: FnProcessCommand) => {
		let selectModeFocus = false;
		let focusedIdx = 0;
		processCommand.call = (commandInfo: CommandInfo) => {
			const getFocusedIdx = (idx: number) => Math.min(terms.length - 1, idx);
			focusedIdx = getFocusedIdx(focusedIdx);
			switch (commandInfo.type) {
			case CommandType.TOGGLE_BAR: {
				const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
				bar.classList[bar.classList.contains(getSel(ElementClass.BAR_HIDDEN))
					? "remove" : "add"](getSel(ElementClass.BAR_HIDDEN));
				break;
			} case CommandType.TOGGLE_SELECT: {
				selectModeFocus = !selectModeFocus;
				break;
			} case CommandType.ADVANCE_GLOBAL: {
				if (selectModeFocus) {
					jumpToTerm(highlightTags, commandInfo.reversed ?? false, terms[focusedIdx]);
				} else {
					jumpToTerm(highlightTags, commandInfo.reversed ?? false);
				}
				break;
			} case CommandType.FOCUS_TERM_INPUT: {
				const control = getControl(undefined, commandInfo.termIdx) as HTMLElement;
				const input = control.querySelector("input") as HTMLInputElement;
				input.select();
				selectInputFocused(input);
				break;
			} case CommandType.SELECT_TERM: {
				const barTerms = document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement;
				barTerms.classList.remove(getSel(ElementClass.CONTROL_PAD, focusedIdx));
				focusedIdx = getFocusedIdx(commandInfo.termIdx as number);
				barTerms.classList.add(getSel(ElementClass.CONTROL_PAD, focusedIdx));
				if (!selectModeFocus) {
					jumpToTerm(highlightTags, commandInfo.reversed as boolean, terms[focusedIdx]);
				}
				break;
			}}
		};
	};

	return (
		highlightTags: HighlightTags, requestRefreshIndicators: RequestRefreshIndicators,
		terms: MatchTerms, termsToPurge: MatchTerms, disable: boolean, termsFromSelection: boolean,
		selectTermPtr: FnProcessCommand, observer: MutationObserver
	) => {
		observer.disconnect();
		if (termsFromSelection) {
			const selection = document.getSelection();
			terms = [];
			if (selection && selection.anchorNode) {
				const termsAll = selection.toString().split(" ").map(phrase => phrase.replace(/\W/g, ""))
					.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
				const termSelectors: Set<string> = new Set;
				termsAll.forEach(term => {
					if (!termSelectors.has(term.selector)) {
						termSelectors.add(term.selector);
						terms.push(term);
					}
				});
				selection.collapseToStart();
			}
			chrome.runtime.sendMessage({
				terms,
				makeUnique: true,
				toggleHighlightsOn: true,
			} as BackgroundMessage);
		}
		restoreNodes(termsToPurge.length ? termsToPurge.map(term => getSel(ElementClass.TERM, term.selector)) : []);
		if (disable) {
			removeControls();
			return;
		}
		selectTermOnCommand(highlightTags, terms, selectTermPtr);
		if (termsFromSelection) {
			return;
		}
		generateTermHighlightsUnderNode(terms, document.body, highlightTags, requestRefreshIndicators);
		terms.forEach(term => updateTermOccurringStatus(term));
		highlightInNodesOnMutation(observer);
	};
})();

(() => {
	const refreshTermControls = (() => {
		const insertToolbar = (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
			style: HTMLStyleElement, controlsInfo: ControlsInfo, hues: TermHues) => {
			const focusingControlAppend = document.activeElement && document.activeElement.tagName === "INPUT"
				&& document.activeElement.closest(`#${getSel(ElementID.BAR)}`);
			removeControls();
			addControls(highlightTags, commands, terms, style, controlsInfo, hues);
			if (focusingControlAppend) {
				((getControl() as HTMLElement).querySelector("input") as HTMLInputElement).select();
			}
		};
	
		return (highlightTags: HighlightTags, terms: MatchTerms, commands: BrowserCommands, style: HTMLStyleElement,
			observer: MutationObserver, selectTermPtr: FnProcessCommand,
			requestRefreshIndicators: RequestRefreshIndicators,
			termsFromSelection: boolean, disable: boolean,
			controlsInfo: ControlsInfo, hues: TermHues,
			termsUpdate?: MatchTerms, termUpdate?: MatchTerm, termToUpdateIdx?: number,
		) => {
			const termsToHighlight: MatchTerms = [];
			const termsToPurge: MatchTerms = [];
			if (termsUpdate !== undefined && termToUpdateIdx !== undefined
				&& termToUpdateIdx !== TermChange.REMOVE && termUpdate) {
				// 'message.disable' assumed false.
				if (termToUpdateIdx === TermChange.CREATE) {
					terms.push(new MatchTerm(termUpdate.phrase, termUpdate.matchMode));
					const termCommands = getTermCommands(commands);
					const idx = terms.length - 1;
					insertTermControl(highlightTags, terms, idx, termCommands.down[idx], termCommands.up[idx], controlsInfo);
					termsToHighlight.push(terms[idx]);
					termsToPurge.push(terms[idx]);
				} else {
					const term = terms[termToUpdateIdx];
					termsToPurge.push(Object.assign({}, term));
					term.matchMode = termUpdate.matchMode;
					term.phrase = termUpdate.phrase;
					term.compile();
					refreshTermControl(highlightTags, terms[termToUpdateIdx], termToUpdateIdx);
					termsToHighlight.push(term);
				}
			} else if (termsUpdate !== undefined) {
				// TODO retain colours?
				if (termToUpdateIdx === TermChange.REMOVE && termUpdate) {
					const termRemovedPreviousIdx = terms.findIndex(term => JSON.stringify(term) === JSON.stringify(termUpdate));
					if (termRemovedPreviousIdx === -1) {
						console.warn(`Request received to delete term ${JSON.stringify(termUpdate)} which is not stored in this page.`);
					} else {
						removeTermControl(termRemovedPreviousIdx);
						terms.splice(termRemovedPreviousIdx, 1);
						restoreNodes([ getSel(ElementClass.TERM, termUpdate.selector) ]);
						fillStylesheetContent(terms, style, hues);
						return;
					}
				} else {
					terms.splice(0);
					termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
					insertToolbar(highlightTags, commands, terms, style, controlsInfo, hues);
				}
			} else if (!disable && !termsFromSelection) {
				return;
			}
			if (!disable) {
				fillStylesheetContent(terms, style, hues);
			}
			beginHighlighting(
				highlightTags, requestRefreshIndicators,
				termsToHighlight.length ? termsToHighlight : terms, termsToPurge,
				disable, termsFromSelection, selectTermPtr, observer
			);
		};
	})();

	const insertStyleElement = () => {
		let style = document.getElementById(getSel(ElementID.STYLE)) as HTMLStyleElement;
		if (!style) {
			style = document.createElement("style");
			style.id = getSel(ElementID.STYLE);
			document.head.appendChild(style);
		}
		return style;
	};

	return () => {
		const commands: BrowserCommands = [];
		const processCommand: FnProcessCommand = { call: command => { command; } };
		const terms: MatchTerms = [];
		const hues: TermHues = [ 60, 300, 110, 220, 0, 190, 30 ];
		const controlsInfo: ControlsInfo = {
			highlightsShown: false,
			barControlsShown: {
				disableTabResearch: true,
				performSearch: true,
				appendTerm: true,
			},
			barLook: {
				showEditIcon: true,
			},
		};
		const getHighlightTagsSet = (tagsLower: Array<HTMLElementTagName>) =>
			new Set(tagsLower.flatMap(tagLower => [ tagLower, tagLower.toUpperCase() ])) as Set<TagName>
		;
		const highlightTags: HighlightTags = {
			reject: getHighlightTagsSet([ "meta", "style", "script", "noscript", "title" ]),
			flow: getHighlightTagsSet([ "b", "i", "u", "strong", "em", "cite", "span", "mark", "wbr", "code", "data", "dfn", "ins",
				"mms-h" as HTMLElementTagName ]),
			// break: any other class of element
		};
		const requestRefreshIndicators: RequestRefreshIndicators = function* () {
			const requestWaitDuration = 1000;
			const reschedulingDelayMax = 5000;
			const reschedulingRequestCountMargin = 1;
			let timeRequestAcceptedLast = 0;
			let requestCount = 0;
			const scheduleRefresh = () =>
				setTimeout(() => {
					const dateMs = Date.now();
					if (requestCount > reschedulingRequestCountMargin
						&& dateMs < timeRequestAcceptedLast + reschedulingDelayMax) {
						requestCount = 0;
						scheduleRefresh();
						return;
					}
					requestCount = 0;
					insertScrollMarkers(terms, highlightTags, hues);
					terms.forEach(term => updateTermTooltip(term));
				}, requestWaitDuration + 50); // Arbitrary small amount added to account for lag (preventing lost updates)
			while (true) {
				requestCount++;
				const dateMs = Date.now();
				if (dateMs > timeRequestAcceptedLast + requestWaitDuration) {
					timeRequestAcceptedLast = dateMs;
					scheduleRefresh();
				}
				yield;
			}
		}();
		const observer = getObserverNodeHighlighter(requestRefreshIndicators, highlightTags, terms);
		const style = insertStyleElement();
		chrome.runtime.onMessage.addListener((message: HighlightMessage, sender, sendResponse) => {
			if (message.extensionCommands) {
				commands.splice(0);
				message.extensionCommands.forEach(command => commands.push(command));
			}
			if (message.barControlsShown) {
				controlsInfo.barControlsShown = message.barControlsShown;
			}
			if (message.barLook) {
				controlsInfo.barLook = message.barLook;
			}
			if (message.toggleHighlightsOn !== undefined) {
				controlsInfo.highlightsShown = message.toggleHighlightsOn;
			}
			if (
				message.disable || message.termsFromSelection || message.termUpdate
				|| (message.terms !== undefined
					&& (!itemsMatchLoosely(terms, message.terms, (a: MatchTerm, b: MatchTerm) => a.phrase === b.phrase)
						|| (!terms.length && !document.getElementById(ElementID.BAR))))
			) {
				refreshTermControls(
					highlightTags, terms, commands, style, observer, processCommand, requestRefreshIndicators, //
					message.termsFromSelection ?? false, message.disable ?? false, controlsInfo, hues, //
					message.terms, message.termUpdate, message.termToUpdateIdx, //
				);
			}
			if (message.command) {
				processCommand.call(message.command);
			}
			// TODO improve handling of highlight setting
			const bar = document.getElementById(getSel(ElementID.BAR));
			if (bar) {
				bar.classList[controlsInfo.highlightsShown ? "add" : "remove"](getSel(ElementClass.HIGHLIGHTS_SHOWN));
			}
			sendResponse(); // Mitigates manifest V3 bug which otherwise logs an error message
		});
	};
})()();
