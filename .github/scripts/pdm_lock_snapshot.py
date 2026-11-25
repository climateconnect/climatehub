"""
Build a GitHub dependency submission snapshot from backend/pdm.lock.

GitHub's dependency graph does not read pdm.lock, only the version ranges in
pyproject.toml, so Dependabot cannot raise alerts for the backend. Submitting
the locked versions fixes that.

Usage: python pdm_lock_snapshot.py <lock file> <pyproject.toml> > snapshot.json
Reads GITHUB_SHA, GITHUB_REF, GITHUB_RUN_ID and GITHUB_SERVER_URL/REPOSITORY.
API: https://docs.github.com/en/rest/dependency-graph/dependency-submission
"""

import json
import os
import re
import sys
import tomllib
from datetime import UTC, datetime

NAME = re.compile(r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)")


def normalize(name):
    # PEP 503; also what the pypi purl type expects.
    return re.sub(r"[-_.]+", "-", name).lower()


def requirement_name(requirement):
    match = NAME.match(requirement)
    return normalize(match.group(1)) if match else None


def direct_names(pyproject):
    requirements = list(pyproject["project"].get("dependencies", []))
    for group in pyproject.get("dependency-groups", {}).values():
        requirements += [r for r in group if isinstance(r, str)]
    return {requirement_name(r) for r in requirements} - {None}


def build_snapshot(lock, pyproject, lock_path):
    direct = direct_names(pyproject)
    purls = {}
    for package in lock["package"]:
        name = normalize(package["name"])
        purls.setdefault(name, f"pkg:pypi/{name}@{package['version']}")

    resolved = {}
    for package in lock["package"]:
        name = normalize(package["name"])
        # Packages with extras appear once per extra set; keep the first.
        if name in resolved:
            continue
        dependencies = {
            purls[dep]
            for dep in map(requirement_name, package.get("dependencies", []))
            if dep in purls and dep != name
        }
        resolved[name] = {
            "package_url": purls[name],
            "relationship": "direct" if name in direct else "indirect",
            "scope": "development" if package.get("groups") == ["dev"] else "runtime",
            "dependencies": sorted(dependencies),
        }

    repo_url = "{}/{}".format(
        os.environ.get("GITHUB_SERVER_URL", "https://github.com"),
        os.environ.get("GITHUB_REPOSITORY", "climateconnect/climatehub"),
    )
    return {
        "version": 0,
        "sha": os.environ["GITHUB_SHA"],
        "ref": os.environ["GITHUB_REF"],
        "job": {
            "correlator": f"pdm-lock-snapshot {lock_path}",
            "id": os.environ.get("GITHUB_RUN_ID", "local"),
        },
        "detector": {
            "name": "pdm-lock-snapshot",
            "version": "1.0.0",
            "url": f"{repo_url}/blob/master/.github/scripts/pdm_lock_snapshot.py",
        },
        "scanned": datetime.now(UTC).isoformat(timespec="seconds"),
        "manifests": {
            lock_path: {
                "name": lock_path,
                "file": {"source_location": lock_path},
                "resolved": resolved,
            }
        },
    }


def main(lock_path, pyproject_path):
    with open(lock_path, "rb") as f:
        lock = tomllib.load(f)
    with open(pyproject_path, "rb") as f:
        pyproject = tomllib.load(f)
    json.dump(build_snapshot(lock, pyproject, lock_path), sys.stdout, indent=2)


if __name__ == "__main__":
    main(*sys.argv[1:])
