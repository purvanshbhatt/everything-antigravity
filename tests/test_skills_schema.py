"""
Tests for Skill Schema and Frontmatter Integrity across all EAG skills.
"""

from pathlib import Path
import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
SKILLS_DIR = ROOT_DIR / "skills"


def test_skills_directory_exists():
    assert SKILLS_DIR.exists()
    assert SKILLS_DIR.is_dir()


def test_all_skills_have_valid_skill_md():
    skill_folders = [d for d in SKILLS_DIR.iterdir() if d.is_dir()]
    assert len(skill_folders) >= 30, f"Expected at least 30 skills, found {len(skill_folders)}"

    for folder in skill_folders:
        skill_file = folder / "SKILL.md"
        assert skill_file.exists(), f"Skill directory {folder.name} is missing SKILL.md"

        content = skill_file.read_text(encoding="utf-8")
        assert content.startswith("---"), f"{folder.name}/SKILL.md must start with YAML frontmatter delimiter (---)"

        parts = content.split("---", 2)
        assert len(parts) >= 3, f"{folder.name}/SKILL.md has invalid frontmatter structure"

        frontmatter = parts[1]
        assert "name:" in frontmatter, f"{folder.name}/SKILL.md frontmatter must specify 'name'"
        assert "description:" in frontmatter, f"{folder.name}/SKILL.md frontmatter must specify 'description'"
