import fs from "node:fs";
import path from "node:path";
import type { RawGaokaoRow, SourceDefinition } from "./model";
import { normalizeText, sha256, stableStringify } from "./normalize";

export interface MetadataOverride {
  provider_key: string;
  revision: string;
  source_file: string;
  source_index: number;
  year: number;
  raw_category: string;
  raw_sha256: string;
  category: string;
  reason: string;
  evidence: string[];
}

export class MetadataOverrides {
  private readonly entries: MetadataOverride[];
  private readonly applied = new Set<number>();

  constructor(entries: MetadataOverride[]) {
    this.entries = entries;
  }

  get appliedCount(): number {
    return this.applied.size;
  }

  match(
    source: SourceDefinition,
    relativePath: string,
    row: RawGaokaoRow,
  ): MetadataOverride | null {
    const normalizedPath = relativePath.replace(/\\/g, "/");
    const candidates = this.entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) =>
        entry.provider_key === source.key &&
        entry.revision === source.revision &&
        entry.source_file === normalizedPath &&
        entry.source_index === Number(row.index),
      );
    if (!candidates.length) return null;
    if (candidates.length !== 1) throw new Error(`Duplicate metadata override: ${normalizedPath}`);
    const { entry, index } = candidates[0];
    const actualHash = sha256(stableStringify(row));
    if (
      entry.year !== Number(row.year) ||
      entry.raw_category !== normalizeText(row.category) ||
      entry.raw_sha256 !== actualHash
    ) {
      throw new Error(
        `Metadata override input drifted for ${normalizedPath}:${entry.source_index}; ` +
        `actual raw_sha256=${actualHash}`,
      );
    }
    this.applied.add(index);
    return entry;
  }

  assertApplied(providerKeys: Set<string>, fromYear: number, toYear: number): void {
    const expected = this.entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) =>
        providerKeys.has(entry.provider_key) && entry.year >= fromYear && entry.year <= toYear,
      );
    const missing = expected.filter(({ index }) => !this.applied.has(index));
    if (missing.length) {
      throw new Error(
        `Metadata overrides did not match pinned inputs: ${missing
          .map(({ entry }) => `${entry.source_file}:${entry.source_index}`)
          .join(", ")}`,
      );
    }
  }
}

export function loadMetadataOverrides(filePath?: string): MetadataOverrides {
  const absolute = path.resolve(
    filePath ?? path.join(import.meta.dirname, "..", "metadata-overrides.json"),
  );
  const parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as {
    schema_version?: number;
    overrides?: MetadataOverride[];
  };
  if (parsed.schema_version !== 1 || !Array.isArray(parsed.overrides)) {
    throw new Error(`Unsupported metadata override file: ${absolute}`);
  }
  return new MetadataOverrides(parsed.overrides);
}
