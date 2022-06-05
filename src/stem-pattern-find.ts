// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getWordPatternString = (() => {
	const reverse = (chars: string) => {
		for (let i = 0; i < chars.length; i += 2) {
			chars = chars[i] + chars;
		}
		return chars.substring(0, chars.length / 2);
	};
	const suffixes = [
		"e",
		"a",
		"ata",
		"able",
		"ac",
		"acity",
		"ocity",
		"ade",
		"age",
		"aholic",
		"oholic",
		"al",
		"als",
		"ality",
		"alities",
		"algia",
		"an",
		"ian",
		"ance",
		"ancy",
		"ant",
		"ar",
		"ard",
		"arian",
		"arium",
		"orium",
		"ary",
		"ate",
		"ation",
		"ative",
		"atic",
		"atical",
		"atically",
		"cide",
		"cracy",
		"crat",
		"cule",
		"cy",
		"cycle",
		"dom",
		"dox",
		"ed",
		"ee",
		"eer",
		"emia",
		"en",
		"ence",
		"ency",
		"ent",
		"er",
		"ers",
		"ern",
		"es",
		"escence",
		"ese",
		"esque", 
		"ess",
		"est",
		"etic",
		"ette",
		"fication",
		"ful",
		"fy",
		"gam",
		"gamy",
		"gon",
		"gonic",
		"hood",
		"ial",
		"ian",
		"iasis",
		"iatric",
		"ible",
		"ic",
		"ics",
		"ical",
		"ically",
		"ile",
		"ily",
		"ine",
		"ing",
		"ion",
		"ious",
		"ish",
		"ism",
		"ist",
		"ite",
		"itis",
		"ity",
		"ities",
		"ility",
		"ilities",
		"ibility",
		"ibilities",
		"ive",
		"ization",
		"ize",
		"ler",
		"lers",
		"less",
		"let",
		"list",
		"ling",
		"lling",
		"le",
		"led",
		"lled",
		"l",
		"ls",
		"le",
		"les",
		"el",
		"loger",
		"logist",
		"logy",
		"log",
		"ly",
		"ment",
		"ness",
		"oid",
		"ology",
		"oma",
		"onym",
		"opia",
		"opsy",
		"or",
		"ors",
		"ory",
		"osis",
		"ostomy",
		"otomy",
		"ous",
		"s",
		"path",
		"pathy",
		"phile",
		"phobia",
		"phone",
		"phyte",
		"plegia",
		"plegic",
		"pnea",
		"scopy",
		"scope",
		"scribe",
		"script",
		"sect",
		"ship",
		"sion",
		"some",
		"sophy",
		"sophic",
		"th",
		"tion",
		"tor",
		"tors",
		"nd",
		"nds",
		"ted",
		"tome",
		"tomy",
		"trophy",
		"tude",
		"ty",
		"ular",
		"uous",
		"ure",
		"ward",
		"ware",
		"wise",
		"y",
	];
	const sortReverse = (a: string, b: string) => a > b ? -1 : 1;
	const replacePatternReverse = new RegExp(
		`\\b(?:${ suffixes.map(suffix => reverse(suffix)).sort(sortReverse).join("|") })`, "gi");
	const highlightPatternString = `(?:${ suffixes.sort(sortReverse).join("|") })?`;

	const makeRepeatedCharsOptional = (word: string) => {
		for (let i = word.length; i >= 0; i--) {
			if (i > 0 && word[i] === word[i - 1]) {
				word = word.substring(0, i + 1) + "?" + word.substring(i + 1);
			}
		}
		return word;
	};

	return (word: string) => { // Currently, returned pattern must have exactly one pair of brackets.
		const patternString = highlightPatternString;
		const matches = reverse(word).match(replacePatternReverse);
		if (!matches)
			return makeRepeatedCharsOptional(word) + patternString;
		const idx = word.length - matches[0].length;
		if (idx < 3)
			return makeRepeatedCharsOptional(word) + patternString;
		return makeRepeatedCharsOptional(word.substring(0, idx)) + patternString;
	};
})();
