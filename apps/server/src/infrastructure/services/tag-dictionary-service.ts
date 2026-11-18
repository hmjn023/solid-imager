import type { Job } from "@solid-imager/core/jobs";
import {
	canonicalTagName,
	tagDictionaryJobPayloadSchema,
	type TagDictionarySource,
} from "@solid-imager/core/tags";
import {
	JobRepository,
	TagDictionaryRepository,
} from "~/infrastructure/db/repositories";
import { notifyJob } from "~/infrastructure/events/state-notifications";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { danbooruService } from "./danbooru-service";
import {
	ATTRIBUTES_VERSION,
	fetchDictionaryAttributes,
	fetchDictionaryTags,
	fetchTagDictionaryVersion,
	readDictionaryAttributes,
	readDictionaryWiki,
	WIKI_VERSION,
	withWikiSnapshot,
} from "./tag-dictionary-sources";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export async function queueTagDictionaryRefresh(
	trigger: "manual" | "automatic",
) {
	const now = Date.now();
	const jobId = await TagDictionaryRepository.queueRefresh(
		trigger === "automatic"
			? {
					trigger,
					completedBefore: new Date(now - 7 * DAY_MS),
					retryBefore: new Date(now - DAY_MS),
				}
			: { trigger },
	);
	if (jobId) {
		notifyJob("job-progress", {
			jobId,
			created: true,
			processed: 0,
			total: 3,
		});
	}
	return { jobId };
}

/** Automatic checks begin after the user initializes the dictionary. */
export function startTagDictionarySchedule() {
	const tick = () =>
		void queueTagDictionaryRefresh("automatic").catch((err) => {
			logger.warn({ err }, "Scheduled tag dictionary check failed");
		});
	tick();
	const timer = setInterval(tick, HOUR_MS);
	timer.unref();
	return () => clearInterval(timer);
}

export async function processTagDictionaryRefresh(job: Job) {
	tagDictionaryJobPayloadSchema.parse(job.payload);
	notifyJob("job-progress", { jobId: job.id, processed: 0, total: 3 });
	const { snapshots } = await TagDictionaryRepository.status();
	const attempt = { id: job.id, number: job.attemptCount ?? 0 };
	const isCurrentAttempt = async () => {
		const current = await JobRepository.findById(job.id);
		return (
			current?.status === "in_progress" &&
			current.attemptCount === attempt.number &&
			!current.cancelRequestedAt
		);
	};
	const failures: TagDictionarySource[] = [];
	const installed = new Map(
		snapshots.map(({ source, version }) => [source, version]),
	);
	let processed = 0;
	const sync = async (
		source: TagDictionarySource,
		refresh: () => Promise<void>,
	) => {
		if (!(await isCurrentAttempt())) return false;
		try {
			await refresh();
		} catch (err) {
			if (!(await isCurrentAttempt())) return false;
			logger.warn(
				{ err, source, jobId: job.id },
				"Tag dictionary source refresh failed",
			);
			failures.push(source);
		}
		processed++;
		notifyJob("job-progress", {
			jobId: job.id,
			processed,
			total: 3,
			failed: failures.length,
		});
		return true;
	};
	if (
		!(await sync("tags", async () => {
			const { version, count } = await fetchTagDictionaryVersion();
			const current = installed.get("tags");
			if (!current || Date.parse(current) < Date.parse(version)) {
				const rows = await fetchDictionaryTags(count);
				if (!(await isCurrentAttempt())) return;
				const verified = await fetchTagDictionaryVersion();
				if (verified.version !== version || verified.count !== count) {
					throw new Error("Tag snapshot changed during download");
				}
				await TagDictionaryRepository.replace(
					{ source: "tags", rows },
					version,
					attempt,
				);
			}
			await TagDictionaryRepository.reconcileLegacy(attempt);
		}))
	)
		return;
	if (
		!(await sync("wiki", async () => {
			if (installed.get("wiki") === WIKI_VERSION) return;
			await withWikiSnapshot((filename) =>
				TagDictionaryRepository.replace(
					{
						source: "wiki",
						rows: readDictionaryWiki(filename),
					},
					WIKI_VERSION,
					attempt,
				),
			);
		}))
	)
		return;
	if (
		!(await sync("attributes", async () => {
			if (installed.get("attributes") === ATTRIBUTES_VERSION) return;
			const lines = await fetchDictionaryAttributes();
			await TagDictionaryRepository.replace(
				{
					source: "attributes",
					rows: readDictionaryAttributes(lines),
				},
				ATTRIBUTES_VERSION,
				attempt,
			);
		}))
	)
		return;
	if (failures.length)
		throw new Error(`Tag dictionary refresh failed: ${failures.join(", ")}`);
}

export async function getTagDictionaryDetail(input: string) {
	const name = canonicalTagName(input);
	const entry = await TagDictionaryRepository.detail(name);
	if (
		!entry ||
		entry.body ||
		!services.getConfigService().getConfig().tagDictionary.fetchMissingWiki
	) {
		return entry;
	}
	try {
		const page = await danbooruService.wikiPage(entry.name);
		return page
			? {
					...entry,
					body: page.body.trim() || null,
					wikiNames: page.other_names,
					wikiUpdatedAt: new Date(page.updated_at).toISOString(),
					wikiSource: "danbooru" as const,
				}
			: entry;
	} catch {
		return entry;
	}
}
