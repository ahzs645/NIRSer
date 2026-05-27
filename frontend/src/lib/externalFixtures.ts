export const DEFAULT_EXTERNAL_FIXTURE_DIR = "/Users/ahmadjalil/Downloads/New Folder With Items 2/25866682";

export function externalFixtureDir() {
  return process.env.NIRSER_EXTERNAL_FIXTURE_DIR || DEFAULT_EXTERNAL_FIXTURE_DIR;
}
