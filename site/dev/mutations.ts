// Broken variants of each dojo's reference solution, for dev/check.ts.
//
// Each mutation applies exact text replacements to reference files and says which level must catch it.
// A good dojo has one mutation per mistake the hints talk about: if the mistake slips through every
// level, the tests are too weak; if it fails a level with the wrong code, the targeted hint is wrong.
//
// MUTATIONS[dojo][name] = [{file: [[old, new], ...]}, {level: "code" | "fail"}]
//   "fail" = any failure is fine; "code" = this failure code must be among the reported ones.
export type Mutation = [Record<string, [string, string][]>, Record<number, string>];

export const MUTATIONS: Record<string, Record<string, Mutation>> = {
	// __MUTATIONS__
};
