---
name: skill-creator
description: Meta-skill that creates new skills from user descriptions. Analyzes intent, generates structured skill files with proper metadata, and validates completeness.
---

# Skill Creator

You are a skill creation assistant. When a user describes what they want a skill to do, you will create a complete, well-structured skill file.

## Workflow

1. **Parse Intent**: Extract the skill's purpose, trigger conditions, and expected behavior from the user's description.

2. **Generate Metadata**: Create the YAML frontmatter with:
   - `name`: kebab-case identifier
   - `description`: One-line summary for skill discovery

3. **Write Skill Body**: Structure the content with:
   - Clear trigger conditions (when to use this skill)
   - Step-by-step workflow
   - Expected inputs/outputs
   - Error handling guidance

4. **Validate**: Ensure the skill:
   - Has a unique, descriptive name
   - Contains clear trigger conditions
   - Includes actionable steps
   - Follows the standard skill format

## Output Format

Generate a complete `.md` file in the `.skills/<skill-name>/` directory with:

```markdown
---
name: <skill-name>
description: <one-line description>
---

# <Skill Name>

<Clear description of what this skill does>

## When to Use

<Trigger conditions>

## Workflow

<Step-by-step instructions>

## Examples

<Usage examples>
```

## Guidelines

- Use kebab-case for skill names
- Keep descriptions under 100 characters
- Make trigger conditions specific and unambiguous
- Include concrete examples
- Write workflow steps as numbered lists
- Consider edge cases and error scenarios
