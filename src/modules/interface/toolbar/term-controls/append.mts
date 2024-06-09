import type { TermAbstractControl } from "/dist/modules/interface/toolbar/term-control.mjs";
import type { ToolbarTermControlInterface } from "/dist/modules/interface/toolbar.mjs";
import { TermInput } from "/dist/modules/interface/toolbar/term-control/term-input.mjs";
import { TermOptionList } from "/dist/modules/interface/toolbar/term-control/term-option-list.mjs";
import { Control } from "/dist/modules/interface/toolbar/control.mjs";
import type { ControlFocusArea } from "/dist/modules/interface/toolbar/common.mjs";
import { applyMatchModeToClassList, getMatchModeFromClassList } from "/dist/modules/interface/toolbar/common.mjs";
import { type MatchMode, MatchTerm } from "/dist/modules/match-term.mjs";
import { EleClass } from "/dist/modules/common.mjs";
import type { TermAppender, DoPhrasesMatchTerms, ControlsInfo } from "/dist/content.mjs";

class TermAppendControl implements TermAbstractControl {
	readonly #toolbarInterface: ToolbarTermControlInterface;
	readonly #termAppender: TermAppender;

	readonly #input: TermInput;
	readonly #optionList: TermOptionList;
	readonly control: Control;
	
	readonly matchMode: MatchMode;

	constructor (
		controlsInfo: ControlsInfo,
		toolbarInterface: ToolbarTermControlInterface,
		termAppender: TermAppender,
		doPhrasesMatchTerms: DoPhrasesMatchTerms,
	) {
		this.#toolbarInterface = toolbarInterface;
		this.#termAppender = termAppender;
		this.matchMode = Object.assign({}, controlsInfo.matchMode);
		let controlContainerTemp: HTMLElement | undefined = undefined;
		const setUpControl = (container: HTMLElement) => {
			const pad = container.querySelector(`.${EleClass.CONTROL_PAD}`) as HTMLElement;
			this.#input.appendTo(pad);
			const revealButton = this.#optionList.createRevealButton();
			revealButton.addEventListener("focusin", event => {
				if (event.relatedTarget) {
					toolbarInterface.markMenuOpener(event.relatedTarget);
				}
			});
			pad.appendChild(revealButton);
			this.#optionList.appendTo(container);
		};
		this.control = new Control("appendTerm", {
			buttonClasses: [ EleClass.CONTROL_BUTTON, EleClass.CONTROL_CONTENT ],
			path: "/icons/create.svg",
			setUp: container => {
				controlContainerTemp = container;
			},
		}, controlsInfo, doPhrasesMatchTerms);
		this.#input = new TermInput({ type: "append", button: this.control.button }, this, toolbarInterface);
		this.#optionList = new TermOptionList(
			(matchType, checked) => {
				this.matchMode[matchType] = checked;
				this.updateMatchModeClassList();
			},
			this.matchMode,
			controlsInfo,
			this,
			toolbarInterface,
		);
		if (controlContainerTemp) {
			setUpControl(controlContainerTemp);
		}
		this.updateMatchModeClassList();
	}

	getInputValue () {
		return this.#input.getValue();
	}

	inputOpenedMenu (): boolean {
		return this.#input.classListContains(EleClass.MENU_OPENER);
	}

	markInputOpenedMenu (value: boolean) {
		if (value) {
			this.#toolbarInterface.forgetMenuOpener();
		}
		this.#input.classListToggle(EleClass.MENU_OPENER, value);
	}

	inputIsEventTarget (target: EventTarget): boolean {
		return this.#input.isEventTarget(target);
	}

	selectInput (shiftCaret?: "right" | "left") {
		this.#input.select(shiftCaret);
	}

	focusInput () {
		this.markInputOpenedMenu(false);
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

	commit (inputValue?: string) {
		inputValue ??= this.#input.getValue();
		this.#input.resetValue();
		// TODO standard method of avoiding race condition (arising from calling termsSet, which immediately updates controls)
		if (inputValue !== "") {
			const matchMode: MatchMode = getMatchModeFromClassList(
				token => this.control.classListContains(token),
			);
			const term = new MatchTerm(inputValue, matchMode, { allowStemOverride: true });
			this.#termAppender.appendTerm(term);
		}
	}

	/**
	 * Updates the class list of the control to reflect the matching options of its term.
	 */
	updateMatchModeClassList () {
		applyMatchModeToClassList(
			this.matchMode,
			(token, force) => this.control.classListToggle(token, force),
		);
	}

	classListToggle (token: string, force?: boolean) {
		return this.control.classListToggle(token, force);
	}

	classListContains (token: string) {
		return this.control.classListContains(token);
	}

	appendTo (parent: HTMLElement) {
		this.control.appendTo(parent);
	}
}

export { TermAppendControl };
