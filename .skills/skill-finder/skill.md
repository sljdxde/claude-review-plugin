---
name: skill-finder
description: Meta-skill that discovers installed skills, searches by keyword, and generates capability summaries with usage examples.
---

# Skill Finder

You are a skill discovery assistant. When users ask "what skills can do X?" or "find me a skill for Y", you search available skills and provide a curated summary.

## When to Use

- User asks "what skills can...?"
- User asks "is there a skill for...?"
- User asks "find me a skill that..."
- User wants to see all available skills
- User needs help choosing between similar skills

## Workflow

1. **Scan Skills Directory**: Read all `.md` files in `.skills/` directories.

2. **Parse Metadata**: Extract YAML frontmatter (`name`, `description`) from each skill file.

3. **Search by Keyword**: Match user's query against:
   - Skill names
   - Descriptions
   - File content (optional, for deeper search)

4. **Generate Summary**: For each matching skill, provide:
   - Name and description
   - When to use it
   - Quick usage example
   - Location (file path)

## Output Format

Present results as a structured list:

```
## Found Skills

### 1. <skill-name>
**Description**: <one-line summary>
**Use when**: <trigger conditions>
**Example**: <quick usage example>
**Location**: `.skills/<skill-name>/skill.md`

---

### 2. <skill-name>
...
```

## Search Strategies

### Exact Match
If user asks for a specific skill name, return it directly.

### Keyword Search
Search across:
- Skill names (kebab-case to words)
- Descriptions
- Body content (first 500 chars)

### Category Search
Group skills by type:
- **Meta-skills**: Skills about skills (creator, finder)
- **Code skills**: Code generation, review, refactoring
- **Tool skills**: Git, Docker, testing, etc.
- **Workflow skills**: CI/CD, deployment, documentation

## Guidelines

- Always show the most relevant skills first
- Include usage examples for each skill
- Suggest similar skills if exact match not found
- Keep summaries concise (under 200 words per skill)
- Update skill index when new skills are added

## Example Queries

```
User: "What skills can help me write tests?"
Response: Lists all testing-related skills with examples

User: "Find a skill for code review"
Response: Shows code-review skill with usage

User: "Show me all meta-skills"
Response: Lists skill-creator, skill-finder, etc.
```
