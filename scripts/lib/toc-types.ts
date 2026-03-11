export interface TocRule {
  id: string;
  title: string;
}

export interface TocSection {
  id: string;
  number: number;
  title: string;
  rules: TocRule[];
}

export interface Toc {
  lang: string;
  title: string;
  sections: TocSection[];
}