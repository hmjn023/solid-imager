/**
 * Conflict Resolution Module
 * Defines policies and strategies for resolving sync conflicts
 */

import { z } from "zod";

/**
 * Conflict resolution policy enum
 */
export const conflictResolutionPolicySchema = z.enum([
	"newer_wins",
	"local_wins",
	"remote_wins",
	"manual",
]);
export type ConflictResolutionPolicy = z.infer<
	typeof conflictResolutionPolicySchema
>;

/**
 * Conflict type enum
 */
export const conflictTypeSchema = z.enum([
	"hash_mismatch",
	"timestamp_mismatch",
	"both_mismatch",
	"metadata_mismatch",
]);
export type ConflictType = z.infer<typeof conflictTypeSchema>;

/**
 * Conflict information
 */
export interface SyncConflict {
	/** Conflict ID */
	id: string;
	/** Local media ID */
	localMediaId: string;
	/** Remote media ID */
	remoteMediaId: string;
	/** Local file path */
	localFilePath: string;
	/** Remote file path */
	remoteFilePath: string;
	/** Local modified timestamp */
	localModifiedAt: Date;
	/** Remote modified timestamp */
	remoteModifiedAt: Date;
	/** Local file hash */
	localHash: string | null;
	/** Remote file hash */
	remoteHash: string | null;
	/** Conflict type */
	conflictType: ConflictType;
	/** Resolution status */
	resolved: boolean;
	/** Resolution policy applied */
	resolution?: ConflictResolutionPolicy;
	/** Resolved media ID */
	resolvedMediaId?: string;
	/** Resolution timestamp */
	resolvedAt?: Date;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
	/** Whether resolution was successful */
	success: boolean;
	/** Resolved conflict */
	conflict: SyncConflict;
	/** Action taken */
	action:
		| "kept_local"
		| "kept_remote"
		| "merged"
		| "skipped"
		| "manual_required";
	/** Error message if resolution failed */
	error?: string;
}

/**
 * Conflict Resolver Service
 * Provides strategies for resolving sync conflicts
 */
export class ConflictResolverService {
	/**
	 * Resolve conflict based on policy
	 */
	resolveConflict(
		conflict: SyncConflict,
		policy: ConflictResolutionPolicy,
	): ConflictResolutionResult {
		switch (policy) {
			case "newer_wins":
				return this.resolveByNewerWins(conflict);
			case "local_wins":
				return this.resolveByLocalWins(conflict);
			case "remote_wins":
				return this.resolveByRemoteWins(conflict);
			case "manual":
				return this.resolveByManual(conflict);
			default:
				return {
					success: false,
					conflict,
					action: "skipped",
					error: `Unknown resolution policy: ${policy}`,
				};
		}
	}

	/**
	 * Resolve conflict by keeping the newer version
	 */
	private resolveByNewerWins(conflict: SyncConflict): ConflictResolutionResult {
		const localTime = conflict.localModifiedAt.getTime();
		const remoteTime = conflict.remoteModifiedAt.getTime();

		if (localTime > remoteTime) {
			return {
				success: true,
				conflict: {
					...conflict,
					resolved: true,
					resolution: "newer_wins",
					resolvedMediaId: conflict.localMediaId,
					resolvedAt: new Date(),
				},
				action: "kept_local",
			};
		}
		if (remoteTime > localTime) {
			return {
				success: true,
				conflict: {
					...conflict,
					resolved: true,
					resolution: "newer_wins",
					resolvedMediaId: conflict.remoteMediaId,
					resolvedAt: new Date(),
				},
				action: "kept_remote",
			};
		}

		// Same timestamp - prefer local
		return {
			success: true,
			conflict: {
				...conflict,
				resolved: true,
				resolution: "newer_wins",
				resolvedMediaId: conflict.localMediaId,
				resolvedAt: new Date(),
			},
			action: "kept_local",
		};
	}

	/**
	 * Resolve conflict by keeping local version
	 */
	private resolveByLocalWins(conflict: SyncConflict): ConflictResolutionResult {
		return {
			success: true,
			conflict: {
				...conflict,
				resolved: true,
				resolution: "local_wins",
				resolvedMediaId: conflict.localMediaId,
				resolvedAt: new Date(),
			},
			action: "kept_local",
		};
	}

	/**
	 * Resolve conflict by keeping remote version
	 */
	private resolveByRemoteWins(
		conflict: SyncConflict,
	): ConflictResolutionResult {
		return {
			success: true,
			conflict: {
				...conflict,
				resolved: true,
				resolution: "remote_wins",
				resolvedMediaId: conflict.remoteMediaId,
				resolvedAt: new Date(),
			},
			action: "kept_remote",
		};
	}

	/**
	 * Mark conflict for manual resolution
	 */
	private resolveByManual(conflict: SyncConflict): ConflictResolutionResult {
		return {
			success: false,
			conflict: {
				...conflict,
				resolved: false,
				resolution: "manual",
			},
			action: "manual_required",
			error: "Conflict requires manual resolution",
		};
	}

	/**
	 * Detect conflict type based on differences
	 */
	detectConflictType(
		localHash: string | null,
		remoteHash: string | null,
		localModifiedAt: Date,
		remoteModifiedAt: Date,
	): ConflictType {
		const hashMismatch = localHash && remoteHash && localHash !== remoteHash;
		const timestampMismatch =
			Math.abs(localModifiedAt.getTime() - remoteModifiedAt.getTime()) > 1000;

		if (hashMismatch && timestampMismatch) {
			return "both_mismatch";
		}
		if (hashMismatch) {
			return "hash_mismatch";
		}
		if (timestampMismatch) {
			return "timestamp_mismatch";
		}
		return "metadata_mismatch";
	}

	/**
	 * Batch resolve conflicts
	 */
	batchResolve(
		conflicts: SyncConflict[],
		policy: ConflictResolutionPolicy,
	): ConflictResolutionResult[] {
		return conflicts.map((conflict) => this.resolveConflict(conflict, policy));
	}
}
