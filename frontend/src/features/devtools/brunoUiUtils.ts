export async function readFirstTextFile(fileList: FileList | null) {
  const file = fileList?.[0];
  return file ? file.text() : null;
}

export function parseFiveValueVector(value: string, fallback: [number, number, number, number, number]) {
  const parsed = value.split(/[,\s]+/).map(Number).filter(Number.isFinite);
  return parsed.length === 5 ? parsed as [number, number, number, number, number] : fallback;
}
