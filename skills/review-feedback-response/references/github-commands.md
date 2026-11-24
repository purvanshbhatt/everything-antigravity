# GitHub commands for review threads

Run these from inside the repository. `gh api` fills in `{owner}` and `{repo}` from the current repository, including inside `-F` field values. Replace `123` with the PR number.

Posting a reply or resolving a thread is public and notifies people: run those commands only after the user has approved the exact text.

## Review summaries (approve, request changes, comment)

```bash
gh pr view 123 --json reviews --jq '.reviews[] | {author: .author.login, state, body}'
```

## Inline comments (REST)

```bash
gh api --paginate repos/{owner}/{repo}/pulls/123/comments \
  --jq '.[] | {id, path, line, user: .user.login, in_reply_to_id, body}'
```

`in_reply_to_id` links replies to the first comment of their thread. Group by it to rebuild threads.

## Threads with resolved and outdated state (GraphQL)

Save the query to `threads.graphql` (this avoids quoting problems in PowerShell):

```graphql
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 50) {
            nodes { databaseId author { login } body url }
          }
        }
      }
    }
  }
}
```

```bash
gh api graphql -F owner='{owner}' -F repo='{repo}' -F pr=123 -F query=@threads.graphql
```

This returns the first 100 threads. For a larger PR, page through the rest as described under GraphQL pagination in `gh api --help`.

## Reply in a thread

Use the `databaseId` of any comment in the thread (REST calls it `id`):

```bash
gh api repos/{owner}/{repo}/pulls/123/comments/<comment-id>/replies -f body="Fixed in abc1234: total() returns 0 for an empty cart."
```

For a longer reply, write it to a file and pass `-F body=@reply.md`.

## Resolve a thread

Only after a change was made or the reviewer agreed, and only where the team lets authors resolve threads. Use the thread `id` from the GraphQL query:

```bash
gh api graphql -f threadId='<thread-node-id>' -f query='mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } } }'
```

## Re-request review

```bash
gh pr edit 123 --add-reviewer <login>
```

## GitLab

```bash
glab mr view 123 --comments
```

For replying to and resolving GitLab discussions, use the merge request page or the GitLab API; check the current `glab` documentation before relying on a subcommand.
