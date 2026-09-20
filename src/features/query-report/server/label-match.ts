const wordPattern = /[\p{L}\p{N}]+/gu;

function words(value: string) {
  return value.toLocaleLowerCase("ru-RU").match(wordPattern) ?? [];
}

const safeRussianNounEndingsByFinal = {
  а: ["ы", "и", "е", "у", "ой", "ою"],
  ы: ["", "а", "у", "ом", "е", "ов", "ам", "ами", "ах"],
} as const;

const consonantNounEndings = [
  "а",
  "я",
  "ы",
  "и",
  "е",
  "у",
  "ю",
  "ом",
  "ем",
  "ов",
  "ев",
  "ам",
  "ям",
  "ами",
  "ями",
  "ах",
  "ях",
] as const;

function russianNounForms(word: string) {
  const final = word.at(-1) as keyof typeof safeRussianNounEndingsByFinal;
  if (final in safeRussianNounEndingsByFinal) {
    const stem = word.slice(0, -1);
    return new Set(
      safeRussianNounEndingsByFinal[final].map((ending) => `${stem}${ending}`),
    );
  }
  if (!/[бвгджзклмнпрстфхцчшщ]$/u.test(word)) return new Set<string>();
  return new Set(consonantNounEndings.map((ending) => `${word}${ending}`));
}

function tokenMatches(labelToken: string, questionToken: string) {
  if (labelToken === questionToken) return true;
  if (
    !/^\p{Script=Cyrillic}+$/u.test(labelToken) ||
    !/^\p{Script=Cyrillic}+$/u.test(questionToken)
  )
    return false;
  return (
    labelToken.length >= 4 && russianNounForms(labelToken).has(questionToken)
  );
}

export function labelMentionedInQuestion(label: string, question: string) {
  const labelWords = words(label);
  const questionWords = words(question);
  return (
    labelWords.length > 0 &&
    labelWords.every((labelWord) =>
      questionWords.some((questionWord) =>
        tokenMatches(labelWord, questionWord),
      ),
    )
  );
}

export function labelFollowsMarkerInQuestion(
  label: string,
  question: string,
  markers: ReadonlySet<string>,
) {
  const labelWords = words(label);
  const questionWords = words(question);
  if (labelWords.length === 0) return false;
  return questionWords.some((questionWord, index) => {
    const articleOffset = questionWords[index + 1] === "the" ? 1 : 0;
    return (
      markers.has(questionWord) &&
      labelWords.every((labelWord, offset) => {
        const candidate = questionWords[index + articleOffset + offset + 1];
        return candidate ? tokenMatches(labelWord, candidate) : false;
      })
    );
  });
}
