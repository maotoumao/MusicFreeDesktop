declare const nestedProperty: {
    get(
        object: any,
        property: string
    ): any;

    has(
        object: any,
        property: string,
        options?: {
            own: boolean
        }
    ): boolean;

    set(
        object: any,
        property: string,
        value: any
    ): any;

    isInNestedProperty(
        object: any,
        property: string,
        objectInPath: any,
        options?: {
            validPath: boolean
        }
    ): boolean;

    ObjectPrototypeMutationError: ErrorConstructor
}

export = nestedProperty;