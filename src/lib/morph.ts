// Human-readable MorphGNT parsing. Parse codes are 8 chars:
// person, tense, voice, mood, case, number, gender, degree.

const POS: Record<string, string> = {
  A: 'adjective', C: 'conjunction', D: 'adverb', I: 'interjection', N: 'noun', P: 'preposition',
  RA: 'article', RD: 'demonstrative pronoun', RI: 'interrogative/indefinite pronoun', RP: 'personal pronoun',
  RR: 'relative pronoun', V: 'verb', X: 'particle',
};
const PERSON: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd' };
const TENSE: Record<string, string> = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', X: 'perfect', Y: 'pluperfect' };
const VOICE: Record<string, string> = { A: 'active', M: 'middle', P: 'passive' };
const MOOD: Record<string, string> = { I: 'indicative', D: 'imperative', S: 'subjunctive', O: 'optative', N: 'infinitive', P: 'participle' };
const CASE: Record<string, string> = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
const NUMBER: Record<string, string> = { S: 'singular', P: 'plural' };
const GENDER: Record<string, string> = { M: 'masculine', F: 'feminine', N: 'neuter' };
const DEGREE: Record<string, string> = { C: 'comparative', S: 'superlative' };

export function describeParse(pos: string, parse: string): string {
  const [p, t, v, m, c, n, g, d] = parse.split('');
  const parts = [
    PERSON[p], TENSE[t], VOICE[v], MOOD[m], CASE[c], NUMBER[n], GENDER[g], DEGREE[d],
  ].filter(Boolean);
  return [POS[pos] ?? pos, parts.join(' ')].filter(Boolean).join(' · ');
}

export function posLabel(pos: string): string {
  return POS[pos] ?? pos;
}

/** Strip accents and punctuation so lemmas and words compare loosely. */
export function greekPlain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}]/gu, '').toLowerCase();
}
