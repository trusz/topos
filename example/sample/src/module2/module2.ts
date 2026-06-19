import "./side"; // side-effect import
import { foo } from "../module1/module1"; // cycle back to module1

export const thing = "thing:" + foo;
