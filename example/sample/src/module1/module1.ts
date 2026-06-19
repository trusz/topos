import { thing } from "../module2/module2"; // forms a cycle with module2

export const foo = "foo:" + thing;
