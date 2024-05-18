export interface ISetupData {
    allLangs: string[];
    lang: string;
    content: any
}

export interface IChangeLangData {
    lang: string;
    content: any;
}

export interface IMod {
    setupLang: () => Promise<ISetupData | null>;
    changeLang: (lang: string) => Promise<IChangeLangData | null>;
}