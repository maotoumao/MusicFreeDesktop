export interface ILanguageContent {
    lang: string;
    content: any;
}

export interface ILanguageContentWithAllLangs extends ILanguageContent {
    allLangs: string[];
}
