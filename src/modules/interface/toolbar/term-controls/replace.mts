/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { TermAbstractControl } from "/dist/modules/interface/toolbar/term-control.d.mjs";
import type { SelectionReturnTarget, ToolbarTermControlInterface } from "/dist/modules/interface/toolbar.d.mjs";
import { TermInput } from "/dist/modules/interface/toolbar/term-control/term-input.mjs";
import { TermOptionList } from "/dist/modules/interface/toolbar/term-control/term-option-list.mjs";
import type { ControlFocusArea, BrowserCommands } from "/dist/modules/interface/toolbar/common.mjs";
import { EleClass, applyMatchModeToClassList, getTermCommands } from "/dist/modules/interface/toolbar/common.mjs";
import { type MatchMode, MatchTerm, type TermTokens } from "/dist/modules/match-term.mjs";
import { getTermClass, type ArrayMutator } from "/dist/modules/common.mjs";
import type {
	HighlighterCounterInterface, HighlighterWalkerInterface,
} from "/dist/modules/highlight/engine-manager.d.mjs";
import type { ControlsInfo } from "/dist/content.mjs";

class TermReplaceControl implements TermAbstractControl {
	readonly #toolbarInterface: ToolbarTermControlInterface;
	readonly #termsMutator: ArrayMutator<MatchTerm>;
	readonly #termTokens: TermTokens;
	readonly #highlighter: HighlighterCounterInterface & HighlighterWalkerInterface;

	readonly #input: TermInput;
	readonly #optionList: TermOptionList;

	readonly #control: HTMLElement;
	readonly #controlPad: HTMLElement;
	readonly #controlContent: HTMLButtonElement;

	#term: MatchTerm;

	/**
	 * Inserts an interactive term control element.
	 * @param terms The term corresponding to this control.
	 * @param commands Keyboard commands to display as shortcut hints.
	 * @param controlsInfo Details of controls inserted.
	 */
	constructor (
		termParameter: MatchTerm,
		commands: BrowserCommands,
		controlsInfo: ControlsInfo, // TODO ControlsInfo should be an observable
		toolbarInterface: ToolbarTermControlInterface,
		termsMutator: ArrayMutator<MatchTerm>,
		termTokens: TermTokens,
		highlighter: HighlighterCounterInterface & HighlighterWalkerInterface,
	) {
		this.#toolbarInterface = toolbarInterface;
		this.#termsMutator = termsMutator;
		this.#termTokens = termTokens;
		this.#highlighter = highlighter;
		this.#term = termParameter;
		this.#optionList = new TermOptionList(
			(matchType: string, checked: boolean) => {
				const matchMode: MatchMode = Object.assign({}, this.#term.matchMode);
				matchMode[matchType] = checked;
				const idx = toolbarInterface.getTermControlIndex(this);
				if (idx !== null) {
					termsMutator.replaceItem(new MatchTerm(this.#term.phrase, matchMode), idx);
				}
			},
			this.#term.matchMode,
			controlsInfo,
			this,
			toolbarInterface,
		);
		this.#optionList.setMatchMode(this.#term.matchMode);
		this.#controlPad = document.createElement("span");
		this.#controlPad.classList.add(EleClass.CONTROL_PAD, EleClass.DISABLED);
		const revealButton = this.#optionList.createFullTriggerButton();
		this.#controlPad.appendChild(revealButton);
		this.#controlContent = document.createElement("button");
		this.#controlContent.type = "button";
		this.#controlContent.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_CONTENT);
		this.#controlContent.tabIndex = -1;
		this.#controlContent.textContent = this.#term.phrase;
		this.#controlContent.addEventListener("click", () => {
			if (toolbarInterface.hasLastFocusedInput()) {
				toolbarInterface.setAutofocusable(false);
			}
			highlighter.stepToNextOccurrence(false, false, this.#term);
		});
		this.#controlContent.addEventListener("pointerover", () => { // FIXME this is not screenreader friendly.
			this.updateTooltip(commands);
		});
		this.#optionList.makeElementPulldownTrigger(this.#controlContent);
		this.#controlPad.appendChild(this.#controlContent);
		const editButton = document.createElement("button");
		editButton.type = "button";
		editButton.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_EDIT);
		editButton.tabIndex = -1;
		editButton.disabled = !controlsInfo.barLook.showEditIcon;
		this.#optionList.makeElementPulldownTrigger(editButton);
		const editChangeImage = document.createElement("img");
		editChangeImage.classList.add(EleClass.PRIMARY);
		editChangeImage.src = chrome.runtime.getURL("/icons/edit.svg");
		editChangeImage.draggable = false;
		const editRemoveImage = document.createElement("img");
		editRemoveImage.classList.add(EleClass.SECONDARY);
		editRemoveImage.src = chrome.runtime.getURL("/icons/delete.svg");
		editRemoveImage.draggable = false;
		editButton.append(editChangeImage, editRemoveImage);
		this.#input = new TermInput({ type: "replace", editButton, content: this.#controlContent }, this, this.#toolbarInterface);
		this.#input.setTerm(this.#term);
		this.#input.appendTo(this.#controlPad);
		this.#controlPad.appendChild(editButton);
		this.#control = document.createElement("span");
		this.#control.classList.add(EleClass.CONTROL, getTermClass(this.#term, termTokens));
		this.#control.appendChild(this.#controlPad);
		this.#optionList.appendTo(this.#control);
		this.updateMatchModeClassList();
	}

	getTermToken () {
		return this.#termTokens.get(this.#term);
	}

	getInputValue () {
		return this.#input.getValue();
	}

	inputIsLastFocused (): boolean {
		return this.#input.classListContains(EleClass.LAST_FOCUSED);
	}

	markInputAsLastFocused (value: boolean) {
		if (value) {
			this.#toolbarInterface.forgetLastFocusedInput();
		}
		this.#input.classListToggle(EleClass.LAST_FOCUSED, value);
	}

	inputIsEventTarget (target: EventTarget): boolean {
		return this.#input.isEventTarget(target);
	}

	selectInput (shiftCaret?: "right" | "left"): SelectionReturnTarget | null {
		this.markInputAsLastFocused(false);
		return this.#input.select(shiftCaret);
	}

	focusInput (): SelectionReturnTarget {
		this.markInputAsLastFocused(false);
		return this.#input.focus();
	}

	unfocusInput () {
		this.#input.unfocus();
	}

	openOptionList () {
		this.#optionList.open();
	}

	getFocusArea (): ControlFocusArea {
		if (this.#input.hasFocus()) {
			return "input";
		}
		return "none";
	}

	/**
	 * Executes the change indicated by the current input text of the control.
	 * Operates by sending a background message to this effect provided that the text was altered.
	 * @param inputValue 
	 */
	commit (inputValue?: string) {
		inputValue ??= this.#input.getValue();
		// TODO standard method of avoiding race condition (arising from calling termsSet, which immediately updates controls)
		const index = this.#toolbarInterface.getTermControlIndex(this);
		if (index === null) {
			return;
		}
		if (inputValue === "") {
			if (this.#input.hasFocus()) {
				this.#toolbarInterface.selectTermInput(index + 1);
				return;
			}
			this.#termsMutator.replaceItem(null, index);
		} else if (inputValue !== this.#term.phrase) {
			this.#termsMutator.replaceItem(new MatchTerm(inputValue, this.#term.matchMode), index);
		}
	}

	/**
	 * Updates the look of the control to reflect whether or not its term currently occurs within the document.
	 */
	updateStatus () {
		this.#controlPad.classList.toggle(
			EleClass.DISABLED,
			!this.#highlighter.termCounter.exists(this.#term),
		);
	}

	/**
	 * Updates the tooltip of the control to reflect current highlighting and keyboard command information.
	 * @param commands 
	 */
	updateTooltip (commands: BrowserCommands) {
		const index = this.#toolbarInterface.getTermControlIndex(this);
		if (index === null) {
			return;
		}
		const { [index]: commandObject } = getTermCommands(commands);
		const { forwards, backwards } = commandObject ?? { forwards: "", backwards: "" };
		const occurrenceCount = this.#highlighter.termCounter.countBetter(this.#term);
		const matchesString = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page`;
		if (occurrenceCount > 0 && forwards && backwards) {
			const commandString = (occurrenceCount === 1)
				? `Jump to: ${forwards} or ${backwards}`
				: `Jump to next: ${forwards}\nJump to previous: ${backwards}`;
			this.#controlContent.title = matchesString + "\n" + commandString;
		} else {
			this.#controlContent.title = matchesString;
		}
	}

	/**
	 * Updates the class list of the control to reflect the matching options of its term.
	 */
	updateMatchModeClassList () {
		applyMatchModeToClassList(
			this.#term.matchMode,
			(token, force) => this.#control.classList.toggle(token, force),
		);
	}

	/**
	 * Replaces the control's term in-place, and updates it to reflect the new state.
	 * @param term The new term.
	 */
	replaceTerm (term: MatchTerm) {
		this.#control.classList.remove(getTermClass(this.#term, this.#termTokens));
		this.#term = term;
		this.#controlContent.textContent = this.#term.phrase;
		this.#input.setTerm(term);
		this.#optionList.setMatchMode(term.matchMode);
		this.#control.classList.add(getTermClass(this.#term, this.#termTokens));
		this.updateMatchModeClassList();
	}

	classListToggle (token: string, force?: boolean) {
		return this.#control.classList.toggle(token, force);
	}

	classListContains (token: string) {
		return this.#control.classList.contains(token);
	}

	appendTo (parent: HTMLElement) {
		parent.appendChild(this.#control);
	}
}

export { TermReplaceControl };
