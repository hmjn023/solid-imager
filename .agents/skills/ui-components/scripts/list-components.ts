#!/usr/bin/env bun

const REGISTRY_URL = "https://www.solid-ui.com/registry/index.json";

interface RegistryComponent {
  name: string;
  type: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: string[];
}

function isRegistryComponent(value: unknown): value is RegistryComponent {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === "string" && typeof item.type === "string";
}

const args = Bun.argv.slice(2);
const asJson = args.includes("--json");
const terms = args.filter((arg) => arg !== "--json").map((arg) => arg.toLocaleLowerCase());

let response: Response;
try {
  response = await fetch(REGISTRY_URL, {
    headers: { accept: "application/json" },
  });
} catch (error) {
  console.error(`Solid UI registry request failed: ${String(error)}`);
  process.exit(1);
}

if (!response.ok) {
  console.error(`Solid UI registry returned ${response.status} ${response.statusText}`);
  process.exit(1);
}

const payload: unknown = await response.json();
if (!Array.isArray(payload) || !payload.every(isRegistryComponent)) {
  console.error("Solid UI registry returned an unexpected response shape");
  process.exit(1);
}

const components = payload
  .filter((component) => {
    if (terms.length === 0) return true;
    const searchable = [
      component.name,
      ...(component.dependencies ?? []),
      ...(component.registryDependencies ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return terms.some((term) => searchable.includes(term));
  })
  .sort((left, right) => left.name.localeCompare(right.name));

if (asJson) {
  console.log(JSON.stringify(components, null, 2));
  process.exit(0);
}

if (components.length === 0) {
  console.error(`No Solid UI components matched: ${terms.join(", ")}`);
  process.exit(2);
}

for (const component of components) {
  const details = [
    component.dependencies?.length ? `packages: ${component.dependencies.join(", ")}` : undefined,
    component.registryDependencies?.length
      ? `components: ${component.registryDependencies.join(", ")}`
      : undefined,
  ].filter(Boolean);
  console.log(`${component.name}${details.length ? ` (${details.join("; ")})` : ""}`);
}

console.log(`\n${components.length} component(s) from ${REGISTRY_URL}`);
