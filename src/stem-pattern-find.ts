// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getWordPatternString = (() => {
	const reverse = (chars: string) => {
		for (let i = 0; i < chars.length; i += 2) {
			chars = chars[i] + chars;
		}
		return chars.substring(0, chars.length / 2);
	};

	const sortReverse = (a: string, b: string) => a > b ? -1 : 1;

	const makeSomeCharDuplicatesOptional = (word: string) => word.replace(/(a|e|i|o|u)\1+/gi, "$1$1?");

	return (() => {
		const suffixes = [
			"e",
			"es",
			"ely",
			"em",
			"et",
			"ets",
			"etry",
			"etic",
			"etics",
			"ce",
			"ces",
			"tist",
			"tists",
			"tific",
			"tifics",
			"a",
			"ata",
			"able",
			"ables",
			"ably",
			"ability",
			"abilities",
			"gable",
			"gables",
			"gably",
			"gability",
			"gabilities",
			"gs",
			"ged",
			"ging",
			"gings",
			"ger",
			"gers",
			"ac",
			"acity",
			"ocity",
			"ade",
			"age",
			"aholic",
			"oholic",
			"al",
			"als",
			"all",
			"alls",
			"alling",
			"allings",
			"aller",
			"allers",
			"ally",
			"ality",
			"alness",
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
			"ates",
			"ated",
			"ater",
			"aters",
			"ating",
			"ation",
			"ations",
			"ative",
			"atic",
			"atical",
			"atically",
			"cide",
			"cracy",
			"crat",
			"cule",
			"cycle",
			"cy",
			"cies",
			"cious",
			"tic",
			"tics",
			"tical",
			"ticals",
			"dom",
			"dox",
			"ed",
			"ee",
			"eer",
			"eers",
			"eering",
			"emia",
			"en",
			"ence",
			"ences",
			"enced",
			"encer",
			"encers",
			"entific",
			"entifics",
			"entist",
			"entists",
			"encing",
			"encings",
			"ency",
			"ent",
			"ents",
			"enting",
			"entings",
			"ention",
			"entions",
			"enter",
			"enters",
			"entative",
			"entatives",
			"entual",
			"entuality",
			"entualities",
			"entive",
			"er",
			"ers",
			"ern",
			"escence",
			"ese",
			"esque", 
			"ess",
			"esses",
			"essing",
			"essation",
			"essor",
			"essors",
			"eased",
			"est",
			"ests",
			"esting",
			"estings",
			"ested",
			"ester",
			"esters",
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
			"ietal",
			"iety",
			"ietist",
			"ietists",
			"ietism",
			"ian",
			"iasis",
			"iatric",
			"ible",
			"ic",
			"ics",
			"ian",
			"ical",
			"icals",
			"ically",
			"icism",
			"icisms",
			"icise",
			"iciser",
			"icisers",
			"ician",
			"icians",
			"istic",
			"istics",
			"ile",
			"ily",
			"ine",
			"ines",
			"ined",
			"iner",
			"ining",
			"inings",
			"ing",
			"ings",
			"inger",
			"inged",
			"inging",
			"ingings",
			"ion",
			"ious",
			"ish",
			"ism",
			"ist",
			"ists",
			"ite",
			"ites",
			"iteness",
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
			"izes",
			"izing",
			"izings",
			"izable",
			"izables",
			"ized",
			"isation",
			"ise",
			"ises",
			"ising",
			"isings",
			"isable",
			"isables",
			"ised",
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
			"lled",
			"ller",
			"llers",
			"lling",
			"llings",
			"islate",
			"islates",
			"islating",
			"islatings",
			"islation",
			"islations",
			"islater",
			"islaters",
			"el",
			"loger",
			"logist",
			"logy",
			"log",
			"ly",
			"ment",
			"ments",
			"mental",
			"mentals",
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
			"ories",
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
			"ships",
			"shipping",
			"shipped",
			"shipper",
			"sion",
			"sions",
			"sioning",
			"sionings",
			"sioned",
			"sioner",
			"sioners",
			"sive",
			"sives",
			"d",
			"ded",
			"deds",
			"ding",
			"dings",
			"der",
			"ders",
			"some",
			"sophy",
			"sophic",
			"th",
			"tion",
			"tions",
			"tive",
			"tives",
			"tor",
			"tors",
			"nd",
			"nds",
			"n",
			"nning",
			"nnings",
			"nner",
			"nners",
			"ted",
			"tome",
			"tomy",
			"trophy",
			"tude",
			"ty",
			"ular",
			"uous",
			"ure",
			"us",
			"uses",
			"used",
			"user",
			"users",
			"using",
			"usable",
			"usables",
			"i",
			"inal",
			"inals",
			"ward",
			"ware",
			"wise",
			"mise",
			"mize",
			"mum",
			"ma",
			"y",
			"ys",
			"ies",
		].sort(sortReverse);
		const replacePatternReverse = new RegExp(
			`\\b(?:${suffixes.map(suffix => reverse(suffix)).sort(sortReverse).join("|")})`, "gi");
		const highlightPatternString = `(?:${suffixes.join("|")})?`;

		return (word: string) => { // Currently, returned pattern must have exactly one pair of brackets.
			const matches = reverse(word).match(replacePatternReverse);
			if (!matches)
				return makeSomeCharDuplicatesOptional(word) + highlightPatternString;
			const idx = word.length - matches[0].length;
			if (idx < 3)
				return makeSomeCharDuplicatesOptional(word) + highlightPatternString;
			return makeSomeCharDuplicatesOptional(word.substring(0, idx)) + highlightPatternString;
		};
	})();
})();
