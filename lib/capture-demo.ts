import "./load-env";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ChapterSchema } from "./schema";
import { verifyChapterAnswer } from "./verify";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "demo-response.json");
const CHAPTER_JSON = path.join(ROOT, "data", "chapter.json");

type CliArgs = { file?: string; output?: string; positional: string[] };

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") args.file = argv[++i];
    else if (arg === "--output") args.output = argv[++i];
    else args.positional.push(arg);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let answer: string | null = null;
  if (args.file) {
    answer = (await readFile(args.file, "utf8")).trim();
  } else if (args.positional.length > 0) {
    answer = args.positional.join(" ").trim();
  }

  if (!answer || answer.length === 0) {
    console.error(
      "Usage:\n" +
        "  npm run capture-demo -- \"<example answer text>\"\n" +
        "  npm run capture-demo -- --file answer.txt\n" +
        "\nRuns the real /api/verify pipeline against the current data/chapter.json\n" +
        "and writes the JSON saved to data/demo-response.json for cached demo mode.\n" +
        "Requires GEMINI_API_KEY (read from .env.local automatically)."
    );
    process.exit(1);
  }

  const chapter = ChapterSchema.parse(
    JSON.parse(await readFile(CHAPTER_JSON, "utf8"))
  );
  const output = args.output ?? DEFAULT_OUTPUT;

  console.log(`Capturing demo response against "${chapter.title}" ...`);
  const response = await verifyChapterAnswer(chapter, answer);

  await writeFile(output, JSON.stringify(response, null, 2));

  console.log(`summary: ${response.summary}`);
  for (const result of response.results) {
    const marker = result.boundingBox ? " +box" : "";
    console.log(
      `  [${result.status.padEnd(12)}] ${result.claimText.slice(0, 90)}${marker}`
    );
  }
  console.log(`wrote ${output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});