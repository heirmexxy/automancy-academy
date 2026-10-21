import index from "@/course-build/index.json";

export type CourseItem = { id: string; title: string; track: number; trackName: string; kind: "lesson" | "boss" | "capstone"; free: boolean; sessions: number };
export const COURSE = index as { items: CourseItem[]; lessons: number; bosses: number; total: number };
export const ITEM_IDS = COURSE.items.map(i => i.id);
export const FREE_IDS = new Set(COURSE.items.filter(i => i.free).map(i => i.id));
export const itemById = (id: string) => COURSE.items.find(i => i.id === id);
/** Share of the course finished, from the progress.done map. */
export const percentDone = (done: Record<string, boolean> | null | undefined) =>
  Math.round(100 * ITEM_IDS.filter(id => done && done[id]).length / COURSE.total);
