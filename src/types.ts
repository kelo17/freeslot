export type Day = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Page = "overview" | "students" | "recommendations";

export interface Course {
  id: string;
  name: string;
  code?: string;
  teacher?: string;
  day: Day;
  startPeriod: number;
  endPeriod: number;
  weeks: number[];
  location?: string;
  sourceText?: string;
}

export interface Student {
  id: string;
  name: string;
  department: string;
  courses: Course[];
  source: "demo" | "manual" | "imported";
  importText?: string;
}

export interface AppData {
  version: 1;
  students: Student[];
  selectedIds: string[];
  week: number;
  duration: number;
  recommendation?: RecommendationFilters;
}

export interface RecommendationFilters {
  selectedIds: string[];
  weeks: number[];
  duration: number;
  days: number[];
  startPeriod: number;
  endPeriod: number;
}

export interface HeatmapTarget {
  day: number;
  startPeriod: number;
  endPeriod: number;
  week: number;
}
