export interface GpuInfo {
  supported: boolean;
  /** Suporte a shader-f16: permite modelos q4f16 (menores e mais rápidos). */
  f16: boolean;
  maxBufferSizeMB: number;
  vendor: string;
  architecture: string;
  /** Motivo quando não há suporte. */
  reason?: string;
}

const UNSUPPORTED = (reason: string): GpuInfo => ({
  supported: false,
  f16: false,
  maxBufferSizeMB: 0,
  vendor: "",
  architecture: "",
  reason,
});

export async function detectGpu(): Promise<GpuInfo> {
  if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) {
    return UNSUPPORTED("WebGPU não está disponível neste navegador.");
  }
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return UNSUPPORTED("Nenhum adaptador de GPU compatível foi encontrado.");
    const info = adapter.info;
    return {
      supported: true,
      f16: adapter.features.has("shader-f16"),
      maxBufferSizeMB: Math.round(adapter.limits.maxBufferSize / 1024 / 1024),
      vendor: info?.vendor ?? "",
      architecture: info?.architecture ?? "",
    };
  } catch (err) {
    return UNSUPPORTED(err instanceof Error ? err.message : String(err));
  }
}

/** Pede ao navegador para não apagar o cache de modelos (gigabytes) sob pressão de disco. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function storageEstimate(): Promise<{ usedMB: number; quotaMB: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usedMB: Math.round(usage / 1048576), quotaMB: Math.round(quota / 1048576) };
}
