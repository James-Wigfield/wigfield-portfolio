/** The tool set: one of each, built once and pooled by the manager. */
import type { ToolMaterials } from "../materials";
import { makeBrush } from "./brush";
import { makeBuffer } from "./buffer";
import { makeHammer } from "./hammer";
import { makeTorch } from "./torch";
import type { ToolId, ToolSpec } from "./types";
import { makeVacuum } from "./vacuum";
import { makeWrench } from "./wrench";

export type { ToolId, ToolSpec, RollMode } from "./types";

export function makeTools(m: ToolMaterials): Record<ToolId, ToolSpec> {
  return {
    hammer: makeHammer(m),
    buffer: makeBuffer(m),
    brush: makeBrush(m),
    torch: makeTorch(m),
    wrench: makeWrench(m),
    vacuum: makeVacuum(m),
  };
}
