declare global {
    interface PromiseConstructor {
        await<T>(promise: Promise<T>): T;
    }
    
    module Plugin {
        function registerCompiler(config: {
            extensions: string[];
            filenames: string[];
        }, compilerFactory: () => object): void;
    }
    
    module Babel {
        type CompileOptions = {
            babelrc: boolean;
            sourceMaps: boolean;
            filename: string;
            sourceFileName: string;
        };
        function compile(source: string, compileOptions: CompileOptions, babelOptions: object): {
            code: string;
        }
        function getDefaultOptions(): CompileOptions;
    }
}

export {}
