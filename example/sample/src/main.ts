import { foo } from "./module1"; // barrel/index resolution
import { thing } from "@/module2/module2"; // tsconfig path alias
import { help } from "~util/helper"; // vite alias
import type { AppConfig } from "./types"; // type-only import (included by default)
import "./styles.css"; // non-script: dropped
import notReal from "lodash"; // external: dropped

export const app: AppConfig = { name: foo + thing + help + notReal };
