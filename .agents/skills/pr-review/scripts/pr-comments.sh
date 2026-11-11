#!/usr/bin/env bash
set -euo pipefail

# Read-only: return review threads and their root comments as a JSON stream.
if [[ $# -gt 1 ]]; then
  echo "Usage: bash pr-comments.sh [PR_NUMBER]" >&2
  exit 2
fi
if [[ ${1:-} == --help || ${1:-} == -h ]]; then
  echo "Usage: bash pr-comments.sh [PR_NUMBER]"
  exit 0
fi
if [[ $# -eq 1 && ! $1 =~ ^[1-9][0-9]*$ ]]; then
  echo "PR_NUMBER must be a positive integer" >&2
  exit 2
fi

repo_full_name=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
repo_owner=${repo_full_name%%/*}
repo_name=${repo_full_name#*/}
if [[ -z $repo_owner || -z $repo_name || $repo_full_name != */* || $repo_name == */* ]]; then
  echo "Could not resolve the current GitHub repository" >&2
  exit 1
fi
if [[ $# -eq 1 ]]; then
  pr_number=$1
else
  pr_number=$(gh pr view --json number --jq '.number')
fi
if [[ ! $pr_number =~ ^[1-9][0-9]*$ ]]; then
  echo "Could not resolve a pull request for the current branch" >&2
  exit 1
fi

# Buffer until all pages succeed, so a failed request cannot look like a complete review.
threads_file=$(mktemp)
trap 'rm -f "$threads_file"' EXIT
gh api graphql --paginate \
  -F owner="$repo_owner" -F repo="$repo_name" -F pr="$pr_number" \
  -f query='query($owner: String!, $repo: String!, $pr: Int!, $endCursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100, after: $endCursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isResolved
            isOutdated
            comments(first: 1) {
              nodes {
                id
                databaseId
                author { login }
                path
                line
                startLine
                originalLine
                originalStartLine
                body
                url
              }
            }
          }
        }
      }
    }
  }' --jq '.data.repository.pullRequest.reviewThreads.nodes[]' > "$threads_file"
cat "$threads_file"
