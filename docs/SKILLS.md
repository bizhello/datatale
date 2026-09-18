# Agent skills and provenance

Canonical location: `.agents/skills`. `.claude/skills` is a relative symlink to the same files. Root AGENTS.md routes tasks; do not duplicate its instructions here or preload every skill.

| Upstream | Pinned commit | Installed skills |
| --- | --- | --- |
| [zhdanovme/skills](https://github.com/zhdanovme/skills) | `67dc435029ab081c3678b7903d5788dc180e8093` | codebase-map, dev-task, information-design, learn-from-pr-reviews |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `063bee94c3f4df8453406c830b0a7df0f2860278` | react-best-practices, composition-patterns, web-design-guidelines |
| [heroui-inc/heroui](https://github.com/heroui-inc/heroui/tree/v3/skills/heroui-react) | `ac71b5f644803b2107c878908e64f100d6a7d443` | heroui-react |

Read only the skill relevant to the task. Preserve complete pinned packages, upstream text and license notices. `.claude/skills` contains no duplicate copies.

Install project-local skills with the official installer using a pinned ref and `.agents/skills` destination. Review helpers before executing them. Update one package at a time, review its diff and update this table.

React/composition frontmatter declares MIT; HeroUI bundles an Apache license. Verify the applicable upstream license before public redistribution where none is provided.
