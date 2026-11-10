// Confere se o catálogo curado bate com os modelos do WebLLM instalado (IDs e VRAM).
// Rode após atualizar o @mlc-ai/web-llm: pnpm --filter @localchat/core check:models
import { prebuiltAppConfig } from "@mlc-ai/web-llm";
import { MODEL_FAMILIES } from "../src/models.ts";

const list = prebuiltAppConfig.model_list;
let failed = false;
for (const fam of MODEL_FAMILIES) {
  for (const q of ["q4f16_1", "q4f32_1"] as const) {
    const id = `${fam.base}-${q}-MLC`;
    const rec = list.find((m) => m.model_id === id);
    if (!rec) {
      console.error(`✗ ${id} não existe no WebLLM`);
      failed = true;
      continue;
    }
    const real = Math.round(rec.vram_required_MB ?? 0);
    const flag = Math.abs(real - fam.vram[q]) > 50 ? `  (catálogo: ${fam.vram[q]} — atualize)` : "";
    console.log(`✓ ${id}  ${real} MB${flag}`);
  }
}
process.exit(failed ? 1 : 0);
