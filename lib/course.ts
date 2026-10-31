import index from "@/course-build/index.json";

export type CourseItem = { id: string; title: string; track: number; trackName: string; kind: "lesson" | "boss" | "capstone"; free: boolean; sessions: number; spec?: string };
export type Specialisation = { id: string; name: string; track: number; items: CourseItem[]; total: number };
type Index = { items: CourseItem[]; lessons: number; bosses: number; total: number; spec?: Record<string, Specialisation> };
/** The main course (Tracks 0–6). Progress percentages and the flagship certificate use only these items. */
export const COURSE = index as Index;
export const ITEM_IDS = COURSE.items.map(i => i.id);
export const FREE_IDS = new Set(COURSE.items.filter(i => i.free).map(i => i.id));
/** Paid specialisations (e.g. "crmspec": Track 7), sold and unlocked separately. */
export const SPECS: Record<string, Specialisation> = COURSE.spec || {};
export const SPEC_ITEMS: CourseItem[] = Object.values(SPECS).flatMap(s => s.items);
/** Every item, main course and specialisations, in order. */
export const ALL_ITEMS: CourseItem[] = [...COURSE.items, ...SPEC_ITEMS];
export const ALL_ITEM_IDS = ALL_ITEMS.map(i => i.id);
export const specOf = (id: string): string | null => SPEC_ITEMS.find(i => i.id === id)?.spec || null;
export const itemById = (id: string) => ALL_ITEMS.find(i => i.id === id);
/** Share of the main course finished, from the progress.done map. */
export const percentDone = (done: Record<string, boolean> | null | undefined) =>
  Math.round(100 * ITEM_IDS.filter(id => done && done[id]).length / COURSE.total);
