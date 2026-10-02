import { describe, expect, it } from "vitest";
import {
	collectTwitterIdentities,
	collectTwitterProfile,
} from "./twitter-identities";
const observedAt = "2026-10-02T00:00:00.000Z";
const post = (postId: string, userId: string, username: string) => ({
	rest_id: postId,
	legacy: { user_id_str: userId },
	core: {
		user_results: {
			result: {
				rest_id: userId,
				legacy: { screen_name: username, name: `${username} display` },
			},
		},
	},
});
describe("Twitter profile lookup", () => {
	it("reads only the exact profile user and preserves a large immutable ID", () => {
		expect(
			collectTwitterProfile({
				data: {
					user: {
						result: {
							__typename: "User",
							rest_id: "18446744073709551615",
							core: { name: "Current", screen_name: "current_name" },
							legacy: { name: "Old", screen_name: "old" },
						},
					},
				},
			}),
		).toEqual({
			remoteId: "18446744073709551615",
			username: "current_name",
			displayName: "Current",
		});
		expect(
			collectTwitterProfile({
				data: {
					user: { result: { __typename: "UserUnavailable", rest_id: "123" } },
				},
			}),
		).toBeNull();
		expect(
			collectTwitterProfile({
				data: { timeline: post("100", "123", "other") },
			}),
		).toBeNull();
	});
	it("supports legacy profiles and rejects invalid identities", () => {
		const user = {
			__typename: "User",
			rest_id: "123",
			legacy: { name: "Legacy", screen_name: "legacy" },
		};
		expect(collectTwitterProfile({ data: { user: { result: user } } })).toEqual(
			{ remoteId: "123", username: "legacy", displayName: "Legacy" },
		);
		expect(
			collectTwitterProfile({
				data: { user: { result: { ...user, rest_id: 123 } } },
			}),
		).toBeNull();
	});
});
describe("Twitter post account identities", () => {
	it("binds the primary and quoted post to their own users without numeric rounding", () => {
		expect(
			collectTwitterIdentities(
				{
					...post("100", "18446744073709551615", "creator"),
					quoted_status_result: { result: post("200", "333", "quoted") },
				},
				observedAt,
			),
		).toEqual([
			{
				postId: "100",
				remoteId: "18446744073709551615",
				username: "creator",
				displayName: "creator display",
				observedAt,
			},
			{
				postId: "200",
				remoteId: "333",
				username: "quoted",
				displayName: "quoted display",
				observedAt,
			},
		]);
	});
	it("supports the user core profile shape", () => {
		const value = post("100", "123", "creator");
		const result = {
			...value,
			core: {
				user_results: {
					result: {
						rest_id: "123",
						core: { name: "Updated", screen_name: "renamed" },
						legacy: { followers_count: 100 },
					},
				},
			},
		};
		expect(collectTwitterIdentities(result, observedAt)[0]).toMatchObject({
			remoteId: "123",
			username: "renamed",
			displayName: "Updated",
		});
	});
	it("does not identify a post using an unrelated nested user", () => {
		expect(
			collectTwitterIdentities(
				{
					rest_id: "100",
					user: post("200", "333", "other").core.user_results.result,
				},
				observedAt,
			),
		).toEqual([]);
	});
	it("rejects mismatching user IDs and numeric IDs that were parsed as numbers", () => {
		const value = post("100", "123", "creator");
		value.legacy.user_id_str = "456";
		expect(collectTwitterIdentities(value, observedAt)).toEqual([]);
		expect(
			collectTwitterIdentities(
				{ ...post("100", "123", "creator"), rest_id: 100 },
				observedAt,
			),
		).toEqual([]);
	});
});
